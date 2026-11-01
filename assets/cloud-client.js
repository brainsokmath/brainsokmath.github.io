/* Shared database adapter. Remains inactive until a public project configuration exists. */
(() => {
  const config = window.BRAIN_CLOUD_CONFIG;
  if (!config?.url || !config?.anonKey) return;
  const sessionKey = 'brain-cloud-session-v1';
  let session = JSON.parse(localStorage.getItem(sessionKey) || 'null');
  let ready = false, version = 0, pending = null, saving = false, timer, conflicted = false, checking = false;
  let remoteCards = new Map(), requestId = 0;
  const originalRender = render, originalSave = save, originalShareLink = showShareLink;
  async function request(path, body, authenticated = true) {
    if (authenticated && session && Date.now() > session.expires_at * 1000 - 60000) {
      const refreshed = await raw('/auth/v1/token?grant_type=refresh_token', {refresh_token: session.refresh_token}, false);
      setSession(refreshed);
    }
    return raw(path, body, authenticated);
  }
  async function raw(path, body, authenticated) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(config.url.replace(/\/$/, '') + path, {method:'POST', headers:{apikey:config.anonKey,...(authenticated&&session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '로그인 또는 관리자 접근 권한을 확인해주세요.' : '서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return data;
    } catch(error) { if(error.name==='AbortError')throw new Error('서버 연결 시간이 초과되었습니다.'); throw error; }
    finally { clearTimeout(timeout); }
  }
  const rpc = (name, body = {}, auth = true) => request('/rest/v1/rpc/' + name, body, auth);
  function setSession(data) { session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in};localStorage.setItem(sessionKey,JSON.stringify(session)); }
  function status(message, error = false) {
    let el = document.getElementById('cloudStatus');
    if (!el && document.querySelector('.main')) { document.querySelector('.main').insertAdjacentHTML('afterbegin','<div id="cloudStatus" class="cloud-status" role="status"></div>');el=document.getElementById('cloudStatus'); }
    if(el){el.classList.toggle('cloud-error',error);el.innerHTML='<span>'+esc(message)+'</span><div class="actions"><button class="btn small" onclick="BrainCloud.retry()">다시 저장</button><button class="btn small" onclick="BrainCloud.reload()">다른 기기 변경 확인</button><button class="btn small" onclick="BrainCloud.logout()">로그아웃</button></div>';}
  }
  function storePending() { if(session?.user?.id)localStorage.setItem('brain-cloud-pending-'+session.user.id,JSON.stringify({version,payload:pending})); }
  function queue() { if(!ready)return;pending=structuredClone(db);storePending();status('서버에 저장 중입니다…');clearTimeout(timer);timer=setTimeout(flush,600); }
  async function flush() {
    if(saving||!pending||conflicted)return !pending;
    saving=true;let succeeded=false;const payload=pending;
    try {
      const result=await rpc('brain_save',{p_version:version,p_payload:compactWorkspace(payload)});
      if(result.conflict){conflicted=true;status('다른 기기에서 먼저 수정했습니다. 이 기기의 변경을 백업한 뒤 최신 기록을 불러와주세요.',true);return false;}
      succeeded=true;version=Number(result.version);if(pending===payload)pending=null;storePending();status(pending?'추가 변경 저장 중…':'서버 저장 완료 · PC와 모바일에서 같은 기록을 사용합니다.');return true;
    } catch(error){status(error.message+' 변경 내용은 이 기기에 보관했습니다. 다시 저장을 눌러주세요.',true);return false;}
    finally {saving=false;if(pending&&!conflicted&&succeeded){clearTimeout(timer);timer=setTimeout(flush,200);}}
  }
  function compactWorkspace(value) {
    const result=structuredClone(value);
    result.shares=result.shares.map(card=>card.cloudPublished?{id:card.id,title:card.title,date:card.date,period:card.period,passwordHash:card.passwordHash||null,cloudPublished:true}:card);
    return result;
  }
  async function storagePanel() {
    const content=document.querySelector('.main .content');if(!content)return;
    content.insertAdjacentHTML('beforeend','<section class="panel cloud-storage"><h2>공통 저장소</h2><p class="sub" id="cloudUsage">용량을 확인하고 있습니다…</p><p class="sub">관리자 로그인으로 PC·모바일 기록을 함께 사용합니다. 학부모에게는 생성한 카드만 공개됩니다. 무료 요금제는 사용량이 적으면 일시정지될 수 있습니다.</p></section>');
    try{const result=await rpc('brain_usage');const el=document.getElementById('cloudUsage');if(el)el.textContent='데이터베이스 약 '+(result.bytes/1024/1024).toFixed(1)+'MB / 무료 한도 500MB · 공유 카드 '+result.cards+'장';}catch(error){const el=document.getElementById('cloudUsage');if(el)el.textContent='용량 조회 실패 · '+error.message;}
  }
  function validDatabase(value) {return value && ['students','records','school','academy','units','shares','logs'].every(k=>Array.isArray(value[k]));}
  function applyRemote(result) {
    if(!validDatabase(result.payload))throw new Error('저장된 기록 형식이 올바르지 않습니다. 백업 복원 전 관리자에게 확인해주세요.');
    ready=false;db=result.payload;version=Number(result.version);const before=JSON.stringify(db);ensureClasses();migrateReportExperience();advance();ready=true;originalSave();render();if(JSON.stringify(db)!==before)queue();
  }
  async function load() {
    const result=await rpc('brain_load');
    if(!result.payload){initialSetup();return;}
    const saved=JSON.parse(localStorage.getItem('brain-cloud-pending-'+session.user.id)||'null');
    if(saved?.payload){
      if(validDatabase(saved.payload)){db=saved.payload;version=Number(saved.version);pending=saved.payload;ready=true;conflicted=Number(result.version)!==version;render();if(conflicted)status('다른 기기의 수정과 겹친 변경이 있습니다. 백업 후 최신 기록을 불러와주세요.',true);else await flush();return;}
    }
    applyRemote(result);
  }
  function login(error='') {
    ready=false;
    document.getElementById('app').innerHTML='<main class="cloud-login">'+brand()+'<section class="panel"><span class="tag">관리자 전용</span><h1>브레인 속 수학 로그인</h1><p class="sub">PC와 휴대폰에서 같은 계정으로 로그인하면 학생과 성적 기록이 연결됩니다.</p><form id="cloudLoginForm"><label class="field"><span>이메일</span><input name="email" type="email" required autocomplete="username"></label><label class="field"><span>비밀번호</span><input name="password" type="password" required autocomplete="current-password"></label><p id="cloudLoginError" role="alert">'+esc(error)+'</p><button class="btn primary" type="submit">로그인</button></form><p class="sub">학부모는 전달받은 카드 링크를 열어주세요. 관리자 계정으로 로그인할 필요가 없습니다.</p></section></main>';
    document.getElementById('cloudLoginForm').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const f=new FormData(event.target);setSession(await raw('/auth/v1/token?grant_type=password',{email:f.get('email'),password:f.get('password')},false));event.target.reset();await load();}catch(error){login(error.message);}finally{button.disabled=false;}};
  }
  function initialSetup() {
    document.getElementById('app').innerHTML='<main class="cloud-login">'+brand()+'<section class="panel"><h1>처음 한 번, 기록을 연결합니다</h1><p class="sub">이 기기에 보관된 학생 '+db.students.length+'명과 성적 '+db.records.length+'건을 서버에 등록하면 다른 기기에서도 사용할 수 있습니다. 기존 기록이 있는 PC에서 진행하세요.</p><div class="actions"><button class="btn primary" onclick="BrainCloud.initialize(false)">이 기기 기록으로 시작</button><button class="btn" onclick="BrainCloud.initialize(true)">학생 없이 새로 시작</button></div><p id="cloudSetupError" role="alert"></p></section></main>';
  }
  async function initialize(empty) {
    try{const result=await rpc('brain_load');if(result.payload){applyRemote(result);return;}if(empty){db=seed();db.students=[];db.records=[];db.shares=[];db.logs=[];db.writings=[];}ensureClasses();migrateReportExperience();version=0;ready=true;queue();await flush();render();}catch(error){const el=document.getElementById('cloudSetupError');if(el)el.textContent=error.message;}
  }
  async function reload() {
    if(checking)return;checking=true;
    try{
      if(pending){if(!confirm('이 기기의 미저장 변경을 JSON 백업으로 내려받고 서버의 최신 기록을 불러올까요?'))return;backup();}
      else if(document.getElementById('letterForm')||document.getElementById('internalNote')?.value!==undefined&&document.getElementById('internalNote').value!==student(selected)?.note){if(!confirm('작성 중인 내용을 저장하지 않고 최신 기록을 불러올까요?'))return;}
      const result=await rpc('brain_load');pending=null;conflicted=false;storePending();applyRemote(result);
    }catch(error){status(error.message,true);}finally{checking=false;}
  }
  render = function(){
    if(location.hash.startsWith('#share/'))return renderShared(location.hash.slice(7));
    if(!ready)return login();
    originalRender();if(page==='settings')storagePanel();if(!location.hash.startsWith('#report/')&&!location.hash.startsWith('#preview/'))status(conflicted?'다른 기기의 수정과 겹쳤습니다. 백업 후 최신 기록을 불러와주세요.':pending?'이 기기에 보관된 변경이 있습니다. 서버 저장을 확인해주세요.':'서버 연결됨 · PC·모바일 공통 기록',!!conflicted);
  };
  save = function(){originalSave();queue();};
  showShareLink = async function(card){
    if(!ready)return login();
    try{status('학부모 카드 공유 준비 중…');if(!card.cloudPublished)await rpc('brain_publish_card',{p_card:card});card.cloudPublished=true;save();await flush();originalShareLink(card);}catch(error){toast('카드를 공유하지 못했습니다. '+error.message);status(error.message,true);}
  };
  renderShared = async function(token){
    const id=++requestId;const current=()=>id===requestId&&location.hash==='#share/'+token;const draw=card=>{if(!current())return;period=card.period;reportPage(card.student,card,true);};
    if(remoteCards.has(token)){draw(remoteCards.get(token));return;}
    document.getElementById('app').innerHTML='<div class="report-shell"><header class="report-top">'+brand()+'</header><div class="empty" role="status">아이의 성장 이야기를 불러오고 있어요…</div></div>';
    try{
      const result=await rpc('brain_read_card',{p_token:token},false);if(!current())return;
      if(result.card){remoteCards.set(token,result.card);draw(result.card);return;}
      if(result.needsPassword){
        document.getElementById('app').innerHTML='<main class="cloud-login">'+brand()+'<section class="panel"><h1>우리 아이의 성장 이야기</h1><p class="sub">함께 안내받은 비밀번호를 입력해주세요.</p><form id="parentUnlockForm"><label class="field"><span>카드 비밀번호</span><input type="password" name="password" required maxlength="200" autocomplete="current-password"></label><p id="parentUnlockError" role="alert"></p><button class="btn yellow">카드 열기</button></form></section></main>';
        document.getElementById('parentUnlockForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const proof=await hashPassword(new FormData(e.target).get('password'));const unlocked=await rpc('brain_read_card',{p_token:token,p_proof:proof},false);if(unlocked.card){remoteCards.set(token,unlocked.card);draw(unlocked.card);}else document.getElementById('parentUnlockError').textContent=unlocked.error==='try_later'?'입력 횟수가 초과되었습니다. 15분 뒤 다시 시도해주세요.':'비밀번호를 확인해주세요.';}catch(error){document.getElementById('parentUnlockError').textContent=error.message;}finally{b.disabled=false;}};
      }else throw new Error(result.error==='try_later'?'입력 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.':'카드를 찾을 수 없습니다. 브레인 속 수학에 링크를 다시 확인해주세요.');
    }catch(error){document.getElementById('app').innerHTML='<main class="cloud-login">'+brand()+'<section class="panel"><h1>카드를 열지 못했어요</h1><p>'+esc(error.message)+'</p><button class="btn" onclick="location.reload()">다시 시도</button></section></main>';}
  };
  window.BrainCloud={initialize,reload,retry:flush,async logout(){if(pending){await flush();if(pending)return toast('아직 서버에 저장되지 않았습니다. 백업하거나 저장을 완료한 뒤 로그아웃해주세요.');}ready=false;session=null;remoteCards.clear();localStorage.removeItem(sessionKey);login();}};
  window.addEventListener('online',()=>{if(ready)flush();});
  window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
  setInterval(async()=>{if(!ready||pending||checking||document.hidden||location.hash)return;try{const remote=await rpc('brain_head');if(Number(remote.version)>version)status('다른 기기에서 변경한 기록이 있습니다. 변경 확인을 눌러 불러와주세요.');}catch(error){status('서버 연결을 확인해주세요. '+error.message,true);}},30000);
  window.addEventListener('hashchange', render);
  if(location.hash.startsWith('#share/'))renderShared(location.hash.slice(7));
  else if(session)load().catch(error=>login(error.message));else login();
})();
