/* Only published card links are passed to Kakao; no scores, names or notes. */
(() => {
  const imageUrl = 'https://brainsokmath.github.io/assets/kakao-share-cover-v2.png';
  const title = '우리 아이의 수학 성장 이야기';
  const description = '아이의 수학 성장 기록을 보내드립니다.';
  let loading;
  function cardUrl(value) {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin || !/^#share\/[a-f0-9-]{36}$/i.test(url.hash)) throw new Error('먼저 학부모 전달 카드를 만들어주세요.');
    return url.href;
  }
  function sdk() {
    if (window.Kakao) return Promise.resolve(window.Kakao);
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => window.Kakao ? resolve(window.Kakao) : reject(new Error('카카오톡 공유 기능을 불러오지 못했습니다.'));
      script.onerror = () => { script.remove(); loading = null; reject(new Error('카카오톡 연결을 확인해주세요.')); };
      document.head.appendChild(script);
    });
    return loading;
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); toast('링크를 복사했습니다. 카카오톡 대화창에 붙여넣어주세요.'); }
    catch { toast('공유 창의 링크를 길게 눌러 복사해주세요.'); }
  }
  function fallback(url, reason) {
    modal('카카오톡으로 성장 이야기 보내기', `<p class="sub">${esc(reason)}</p><p>아래 링크를 복사해 카카오톡 대화창에 붙여넣으면 됩니다.</p><input id="kakaoFallbackUrl" readonly aria-label="학부모 전달 카드 링크" style="width:100%" value="${esc(url)}"><div class="actions" style="margin-top:20px"><button class="btn kakao" type="button" onclick="BrainKakao.copy(document.getElementById('kakaoFallbackUrl').value)">링크 복사</button>${navigator.share?'<button class="btn" type="button" onclick="BrainKakao.nativeShare(document.getElementById(\'kakaoFallbackUrl\').value)">공유 앱 선택</button>':''}</div>`, () => document.getElementById('modal').close(), '닫기');
  }
  async function nativeShare(value) {
    try { await navigator.share({title, text:description, url:cardUrl(value)}); }
    catch(error) { if(error.name!=='AbortError')toast('링크 복사로 공유해주세요.'); }
  }
  async function shareUrl(value) {
    let url;
    try {
      url = cardUrl(value);
      const key = window.BRAIN_CLOUD_CONFIG?.kakaoJavaScriptKey;
      if (!key) return fallback(url, '카카오톡 전용 공유 연결을 준비하고 있습니다. 지금은 링크를 복사해서 보낼 수 있어요.');
      const kakao = await sdk();
      if (!kakao.isInitialized()) kakao.init(key);
      kakao.Share.sendDefault({objectType:'feed', content:{title,description,imageUrl,imageWidth:1200,imageHeight:630,link:{mobileWebUrl:url,webUrl:url}}, buttons:[{title:'성장 이야기 보기',link:{mobileWebUrl:url,webUrl:url}}]});
    } catch(error) { if(url)fallback(url,'카카오톡 공유 창을 열지 못했습니다. 링크 복사로 전달해주세요.');else toast(error.message); }
  }
  window.BrainKakao = {shareUrl, copy, nativeShare};
  if(window.BRAIN_CLOUD_CONFIG?.kakaoJavaScriptKey)sdk().catch(()=>{});
})();
