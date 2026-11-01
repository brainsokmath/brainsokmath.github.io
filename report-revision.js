/* Parent report experience: shared desktop/mobile markup and inline authoring. */
let letterEditing = null;
let letterHistoryOpen = null;
let historyPreview = null;
let previewDevice = 'desktop';
let loadedPreviewHash = null;
let loadedAdminCanvasHash = null;
let adminPreviewDevice = 'desktop';
function deleteType(kind, id) {
  const type = db[kind].find(t => t.id === id);
  if (!type || type.deletedAt) return;
  if (!type.archived && db[kind].filter(t => !t.archived).length < 2) return toast('사용할 유형을 최소 1개는 남겨주세요.');
  const count = db.records.filter(r => r.type === id).length;
  modal('유형 삭제', `<p><strong>${esc(type.name)}</strong> 유형을 삭제할까요?</p><p class="sub">삭제하면 휴지통으로 이동하며 새 성적 입력 시 선택 목록에서 제외됩니다. 휴지통에서 복원할 수 있습니다.</p><div class="alert">이 유형으로 입력한 성적 ${count}건과 기존 단원 연결, 공유한 학부모 전달 카드는 그대로 유지됩니다.</div>`, () => {
    type.deletedAt = new Date().toISOString(); type.archived = true;
    log(`${type.name} 유형 삭제 · 휴지통 이동`); $('#modal').close(); render(); toast('유형을 삭제했습니다. 휴지통에서 복원할 수 있습니다.');
  }, '삭제하기');
  $('#modalForm button[type="submit"]').classList.replace('primary', 'danger');
}
function deletedTypes(kind) {
  const list = db[kind].filter(t => t.deletedAt);
  modal('삭제한 유형 · 휴지통', list.length ? `<p class="sub">삭제한 유형을 복원할 수 있습니다. 과거 성적은 유지됩니다.</p>${list.map(t => `<div class="settings-item"><div class="grow"><strong>${esc(t.name)}</strong><p>삭제일 ${new Date(t.deletedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</p></div><button type="button" class="btn small" onclick="restoreDeletedType('${kind}','${t.id}')">복원</button></div>`).join('')}` : '<div class="empty">삭제한 유형이 없습니다.</div>', () => $('#modal').close(), '닫기');
}
function restoreDeletedType(kind, id) {
  const type = db[kind].find(t => t.id === id);
  if (!type || !type.deletedAt) return;
  type.archived = false;
  delete type.deletedAt; delete type.deletedFromArchive;
  log(`${type.name} 삭제한 유형 복원`); $('#modal').close(); render();
  toast('유형을 복원했습니다.');
}
function adminPreviewPage(screen) {
  const current = screen === 'entry' ? 'entry' : 'students';
  $('#app').innerHTML = `<div class="report-preview"><header class="preview-toolbar"><div><h1>관리자 화면 미리보기</h1><p>학생 목록과 성적 입력 화면을 기기별로 확인하세요.</p></div><div class="preview-controls"><div class="preview-device-switch" role="group" aria-label="관리자 미리보기 화면"><button class="btn ${current === 'students' ? 'primary' : ''}" aria-pressed="${current === 'students'}" onclick="location.hash='admin-preview/students'">학생 목록</button><button class="btn ${current === 'entry' ? 'primary' : ''}" aria-pressed="${current === 'entry'}" onclick="location.hash='admin-preview/entry'">성적 입력</button></div><div class="preview-device-switch" role="group" aria-label="관리자 미리보기 기기"><button id="adminDesktop" class="btn ${adminPreviewDevice === 'desktop' ? 'primary' : ''}" aria-pressed="${adminPreviewDevice === 'desktop'}" onclick="setAdminPreviewDevice('desktop')">PC 화면</button><button id="adminMobile" class="btn ${adminPreviewDevice === 'mobile' ? 'primary' : ''}" aria-pressed="${adminPreviewDevice === 'mobile'}" onclick="setAdminPreviewDevice('mobile')">모바일 화면</button></div><button class="btn" onclick="page='${current}';location.hash='';render()">관리자 화면으로</button></div></header><div class="preview-caption" id="adminPreviewCaption">${current === 'entry' ? '성적 입력' : '학생 목록'} · ${adminPreviewDevice === 'desktop' ? 'PC 화면 1280px' : '모바일 화면 390px'}</div><div class="preview-stage"><iframe id="adminPreviewFrame" class="report-preview-frame admin-preview-frame ${adminPreviewDevice}" title="관리자 ${current === 'entry' ? '성적 입력' : '학생 목록'} 미리보기" src="${esc(location.pathname)}#admin-canvas/${current}"></iframe></div></div>`;
  window.scrollTo(0, 0);
}
function setAdminPreviewDevice(device) {
  adminPreviewDevice = device;
  const frame = $('#adminPreviewFrame');
  frame.className = 'report-preview-frame admin-preview-frame ' + device;
  ['Desktop', 'Mobile'].forEach(name => {
    const active = name.toLowerCase() === device, button = $('#admin' + name);
    button.classList.toggle('primary', active); button.setAttribute('aria-pressed', String(active));
  });
  $('#adminPreviewCaption').textContent = (location.hash.endsWith('/entry') ? '성적 입력' : '학생 목록') + ' · ' + (device === 'desktop' ? 'PC 화면 1280px' : '모바일 화면 390px');
  window.scrollTo(0, 0);
}
function reportPreviewPage(s) {
  $('#app').innerHTML = `<div class="report-preview"><header class="preview-toolbar no-print"><div><h1>학부모 전달 카드 미리보기</h1><p>${esc(s.name)} · 학부모에게 보이는 화면입니다.</p></div><div class="preview-controls"><div class="preview-device-switch" role="group" aria-label="미리보기 화면 선택"><button type="button" id="previewDesktop" class="btn ${previewDevice === 'desktop' ? 'primary' : ''}" aria-pressed="${previewDevice === 'desktop'}" onclick="setReportPreview('desktop')">PC 화면</button><button type="button" id="previewMobile" class="btn ${previewDevice === 'mobile' ? 'primary' : ''}" aria-pressed="${previewDevice === 'mobile'}" onclick="setReportPreview('mobile')">모바일 화면</button></div><button type="button" class="btn" onclick="location.hash='';openProfile('${s.id}')">관리자 화면으로</button></div></header><div class="preview-caption no-print" id="previewCaption">${previewDevice === 'desktop' ? 'PC 화면 · 너비 1180px' : '모바일 화면 · 너비 390px'} · 화면 크기에 맞춰 배치만 바뀌며 내용은 동일합니다.</div><div class="preview-stage"><iframe id="reportPreviewFrame" class="report-preview-frame ${previewDevice}" title="${esc(s.name)} 학부모 전달 카드 미리보기" src="${esc(location.pathname)}#preview/${encodeURIComponent(s.id)}?period=${encodeURIComponent(period)}" onload="connectReportPreview(this)"></iframe></div></div>`;
}
function setReportPreview(device) {
  previewDevice = device;
  const frame = $('#reportPreviewFrame');
  frame.className = 'report-preview-frame ' + device;
  ['Desktop', 'Mobile'].forEach(name => {
    const button = $('#preview' + name), active = name.toLowerCase() === device;
    button.classList.toggle('primary', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('#previewCaption').textContent = (device === 'desktop' ? 'PC 화면 · 너비 1180px' : '모바일 화면 · 너비 390px') + ' · 화면 크기에 맞춰 배치만 바뀌며 내용은 동일합니다.';
  requestAnimationFrame(() => resizeReportPreview(frame));
  window.scrollTo(0, 0);
}
function resizeReportPreview(frame) {
  const shell = frame.contentDocument?.querySelector('.report-shell');
  if (shell) frame.style.height = Math.ceil(shell.getBoundingClientRect().height + 4) + 'px';
}
function connectReportPreview(frame) {
  const shell = frame.contentDocument?.querySelector('.report-shell');
  if (!shell) return;
  frame._reportObserver?.disconnect();
  frame._reportObserver = new ResizeObserver(() => resizeReportPreview(frame));
  frame._reportObserver.observe(shell);
  frame.contentDocument.fonts?.ready.then(() => resizeReportPreview(frame));
  resizeReportPreview(frame);
}

function childName(s) {
  const n = s.name.length > 1 ? s.name.slice(1) : s.name;
  const last = n.charCodeAt(n.length - 1);
  return n + (last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '이' : '');
}
function ageBand(grade) {
  return grade.includes('세') ? 0 : Number(grade.slice(1)) <= 3 ? 1 : 2;
}
function character(s, extra = '') {
  if (!s.gender) return `<div class="character-placeholder ${extra}" role="img" aria-label="성별 선택 후 캐릭터가 표시됩니다">🌱</div>`;
  const band = ageBand(s.grade);
  return `<div class="child-character band-${band} gender-${s.gender} ${extra}" role="img" aria-label="${['6~7세', '초1~3', '초4~6'][band]} ${s.gender === 'boy' ? '남자' : '여자'} 캐릭터"></div>`;
}
function reportPeriodLabel(data = db) {
  return period.startsWith('month:') ? period.slice(6).replace('-', '년 ') + '월 성장기록' : period === 'year' ? (data.asOf || data.date || today()).slice(0,4) + '년 누적 성장기록' : period === 'all' ? '전체 성장기록' : '최근 ' + period + '개월 성장기록';
}
function latestAcademyRecord(id, data = db) {
  return data.records.slice().reverse().filter(r => r.student === id && r.kind === 'academy' && r.score !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}
function latestExam(s, data) {
  const latest = data.latestAcademy || latestAcademyRecord(s.id, data);
  return `<section class="latest-exam" aria-label="가장 최근 브레인 속 수학 시험"><div class="exam-icon">🏆</div><div class="latest-exam-body"><div class="latest-label">가장 최근 브레인 속 수학 시험</div><div class="latest-exam-details"><strong class="latest-number">${latest ? esc(latest.score) : '—'}<small>${latest ? '점' : ''}</small></strong><div>${latest ? `<b>${esc(latest.title || '브레인 속 수학 평가')}</b><p>${esc(latest.date.replaceAll('-', '. '))}. ${dateText(latest.date).match(/\(.+\)/)?.[0] || ''} · ${esc(typeName(latest.type, data))}</p>` : '<b>아직 브레인 속 수학 평가 기록이 없어요.</b>'}</div></div><p class="latest-caption">최근 한 번의 시험 결과예요. 아래 그래프는 선택 기간의 누적 변화입니다.</p></div></section>`;
}
function letterData(s, data) {
  if (data !== db) return s;
  return db.writings.filter(w => w.student === s.id && w.period === period).sort((a, b) => b.date.localeCompare(a.date))[0] || s;
}
function letterSection(s, data, admin) {
  const n = childName(s), current = letterData(s, data);
  const parts = [
    ['evaluation', `요즘 ${n}의 수학 성장 이야기`, current.evaluation || '아이의 배움을 살피며 성장 이야기를 준비하고 있습니다.', '♡'],
    ['message', '가정에서 함께해 주세요', current.message || '아이의 작은 도전과 스스로 해낸 순간을 함께 응원해 주세요.', '⌂'],
    ['plan', '앞으로 이렇게 함께할게요', current.plan || '아이의 속도를 존중하며 한 걸음씩 함께하겠습니다.', '🌱']
  ];
  const history = admin && letterHistoryOpen === s.id ? writingHistory(s) : '';
  const writing = admin && letterEditing === s.id ? `<form class="inline-letter-editor no-print" id="letterForm" onsubmit="saveLetter(event,'${s.id}')"><div class="editor-notice">이 화면에서 작성하고 저장해주세요. 저장할 때마다 날짜별 작성내역이 남습니다.</div>${parts.map(([key, title, text]) => `<label class="field"><span>${esc(title)}</span><textarea name="${key}" required maxlength="5000">${esc((historyPreview && historyPreview.student === s.id ? historyPreview[key] : current[key]) || '')}</textarea></label>`).join('')}<div class="actions" style="justify-content:flex-end"><button type="button" class="btn" onclick="letterEditing=null;historyPreview=null;render()">취소</button><button class="btn yellow" type="submit">글 저장하기</button></div></form>` : '';
  return `<section id="parentLetter"><div class="section-title letter-heading"><h2>💬 학부모님께 드리는 글</h2>${admin ? `<div class="actions no-print"><button class="btn primary small" onclick="beginLetter('${s.id}')">작성하기</button><button class="btn small" onclick="toggleWritingHistory('${s.id}')">이전 작성내역 보기</button></div>` : ''}</div>${history}${writing}<div class="evaluation warm-letter"><div class="letter-overline"><span>🌱</span> ${esc(n)}의 작은 성장을 함께 나눕니다</div>${parts.map(([key, title, text, icon]) => `<div class="letter-part"><span class="letter-part-icon" aria-hidden="true">${icon}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></div>`).join('')}<div class="signature">진심을 담아 사랑하는 마음으로 아이를 가르치는,<br><strong>브레인 속 수학</strong></div></div></section>`;
}
function beginLetter(id) {
  letterEditing = id; historyPreview = null; render();
  document.getElementById('parentLetter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function toggleWritingHistory(id) {
  letterHistoryOpen = letterHistoryOpen === id ? null : id; render();
  document.getElementById('parentLetter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function writingHistory(s) {
  const entries = db.writings.filter(w => w.student === s.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="writing-history no-print"><h3>날짜별 작성내역 <span class="count">${entries.length}</span></h3>${entries.length ? entries.map(w => `<details class="writing-history-entry"><summary><span>${new Date(w.date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span><span class="tag">${w.period.startsWith('month:') ? w.period.slice(6) + ' 기록' : '학부모 전달 카드'}</span></summary><div class="history-letter">${[['evaluation', `요즘 ${childName(s)}의 수학 성장 이야기`], ['message', '가정에서 함께해 주세요'], ['plan', '앞으로 이렇게 함께할게요']].map(([k, title]) => `<h4>${esc(title)}</h4><p>${esc(w[k])}</p>`).join('')}<button type="button" class="btn small" onclick="editPreviousLetter('${w.id}')">이 글을 불러와 새로 작성</button></div></details>`).join('') : '<p class="sub">아직 저장한 작성내역이 없습니다.</p>'}</div>`;
}
function editPreviousLetter(id) {
  historyPreview = db.writings.find(w => w.id === id); letterEditing = historyPreview.student; render();
  document.getElementById('letterForm').scrollIntoView({ behavior: 'smooth' });
}
function saveLetter(event, id) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  if (Object.values(values).some(v => !v.trim())) return toast('세 가지 글을 모두 작성해주세요.');
  const entry = { ...values, id: crypto.randomUUID(), student: id, date: new Date().toISOString(), period };
  db.writings.push(entry); Object.assign(student(id), values);
  letterEditing = null; historyPreview = null;
  log(`${student(id).name} 학부모님께 드리는 글 저장`); render();
  document.getElementById('parentLetter').scrollIntoView({ behavior: 'smooth' });
  toast('글을 저장했습니다. 날짜별 작성내역에 보관됩니다.');
}
function reportContent(s, data, admin = false) {
  let html = originalReportContent(s, data, admin);
  const heroEnd = html.indexOf('<div class="report-intro">');
  html = `<div class="report-hero report-hero-character"><div class="report-hero-copy"><span class="report-kicker">${period.startsWith('month:') ? '월간 학부모 전달 카드' : '학부모 전달 카드'}</span><h1>${period.startsWith('month:') ? Number(period.slice(11)) + '월, ' : ''}${esc(childName(s))}의<br class="mobile-title-break"> 수학 성장 이야기</h1><p class="sub">${esc(s.grade)} ${s.school ? '· ' + esc(s.school) : ''} <span class="report-separator"></span> ${esc(reportPeriodLabel(data))}</p><p class="hero-message">작은 도전도, 스스로 해낸 순간도 소중히 기록합니다.</p></div><div class="character-scene">${character(s, 'hero-character')}</div></div>` + html.slice(heroEnd);
  html = html.replace(/<div class="report-intro">[\s\S]*?<\/div><\/div>/, `<div class="report-intro"><span class="notice-symbol" aria-hidden="true">ⓘ</span><div><h3>${esc(childName(s))}의 성장을 함께 살펴봐요</h3><p>점수와 함께, 아이가 생각하고 도전한 과정도 살펴봐 주세요.</p></div></div>`);
  const graphStart = '<div class="section-title"><div><h2>📈 성적 변화';
  html = html.replace(graphStart, latestExam(s, data) + graphStart);
  const letterStart = html.indexOf('<div class="section-title"><h2>💬 관리자의 한마디');
  const recordsStart = html.indexOf('<div class="section-title"><h2>평가 기록');
  let recordSection = html.slice(recordsStart);
  if (!admin) {
    const tableStart = recordSection.indexOf('<section class="panel">');
    recordSection = `<details class="assessment-records"><summary><span>전체 평가 기록 보기</span><span class="assessment-record-count">${recordsFor(s.id, null, data).length}건 <span class="assessment-record-chevron" aria-hidden="true">⌄</span></span></summary><div class="assessment-record-content">${recordSection.slice(tableStart)}</div></details>`;
  }
  html = html.slice(0, letterStart) + letterSection(s, data, admin) + recordSection;
  return admin ? html : parentBrandWording(html);
}
function parentBrandWording(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    node.nodeValue = node.nodeValue.replaceAll('학원', '브레인 속 수학');
  }
  template.content.querySelectorAll('[aria-label], [title]').forEach(element => {
    ['aria-label', 'title'].forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, value.replaceAll('학원', '브레인 속 수학'));
    });
  });
  return template.innerHTML;
}
function activeStudents() { return db.students.filter(s => !s.deletedAt); }
function activeStudentRecords() {
  const ids = new Set(activeStudents().map(s => s.id));
  return db.records.filter(r => ids.has(r.student));
}
/* Student selection and recoverable batch actions. Included in report-revision.js. */
function studentSelectionPanel(list, action) {
  return `<div class="student-pick-toolbar"><label class="field"><span>학생 검색</span><input type="search" id="studentPickSearch" aria-label="삭제·복원 학생 검색" placeholder="이름·학교·연령/학년으로 검색" oninput="filterStudentSelection(this.value)"></label><div class="student-pick-controls"><label><input id="studentPickAll" type="checkbox" onchange="toggleVisibleStudentSelection(this.checked)">검색 결과 전체 선택</label><strong id="studentPickCount" aria-live="polite">0명 선택</strong></div><p class="field-help">여러 명을 선택할 수 있습니다. 전체 선택은 현재 검색 결과에 적용되며, 검색어를 바꿔도 이미 선택한 학생은 유지됩니다.</p></div><div class="student-pick-list">${list.map(s => `<label class="student-choice" data-search="${esc((s.name + ' ' + s.grade + ' ' + (s.school || '')).toLocaleLowerCase())}"><input type="checkbox" name="studentIds" value="${esc(s.id)}" onchange="updateStudentSelection()"><span class="student-choice-info"><strong>${esc(s.name)} <span class="tag">${esc(s.grade)}</span></strong><span>${esc(s.school || '브레인 속 수학')} · 성적 ${db.records.filter(r => r.student === s.id).length}건 · 작성한 글 ${db.writings.filter(w => w.student === s.id).length}건</span>${action === 'restore' ? `<span>삭제일 ${new Date(s.deletedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>` : ''}</span></label>`).join('')}<p id="studentPickEmpty" class="empty" hidden>검색 결과가 없습니다.</p></div>`;
}
function filterStudentSelection(query) {
  const text = query.trim().toLocaleLowerCase(); let visible = 0;
  document.querySelectorAll('.student-choice').forEach(row => { row.hidden = !row.dataset.search.includes(text); if (!row.hidden) visible++; });
  $('#studentPickEmpty').hidden = visible > 0; updateStudentSelection();
}
function toggleVisibleStudentSelection(checked) {
  document.querySelectorAll('.student-choice').forEach(row => { if (!row.hidden) row.querySelector('input').checked = checked; });
  updateStudentSelection();
}
function updateStudentSelection() {
  const choices = [...document.querySelectorAll('.student-choice input[name="studentIds"]')];
  const selected = choices.filter(input => input.checked).length;
  const visible = choices.filter(input => !input.closest('.student-choice').hidden);
  const master = $('#studentPickAll');
  if (master) { master.checked = visible.length > 0 && visible.every(input => input.checked); master.indeterminate = visible.some(input => input.checked) && !master.checked; }
  if ($('#studentPickCount')) $('#studentPickCount').textContent = `${selected}명 선택`;
  const submit = $('#modalForm button[type="submit"]');
  if (submit && $('#studentPickCount')) { submit.disabled = selected === 0; submit.textContent = selected ? `선택한 ${selected}명 확인` : '학생을 선택해주세요'; }
}
function chooseStudentToDelete() {
  const list = activeStudents();
  if (!list.length) return toast('삭제할 학생이 없습니다.');
  modal('학생 삭제 · 여러 명 선택', `<p class="sub">삭제할 학생을 선택한 뒤 다음 화면에서 명단과 기록 수를 확인합니다. 아직 이 단계에서는 삭제되지 않습니다.</p>${studentSelectionPanel(list, 'delete')}`, form => {
    const ids = form.getAll('studentIds'); if (!ids.length) return toast('삭제할 학생을 선택해주세요.');
    $('#modal').close(); confirmStudentBatch('delete', ids);
  }, '선택 학생 확인');
  updateStudentSelection();
}
function studentTrash() {
  const list = db.students.filter(s => s.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  if (!list.length) return modal('삭제 학생 휴지통', '<p class="sub">학생 관리에서 삭제한 학생이 이곳에 표시됩니다. 복원 시 성적·글·내부 메모가 함께 돌아옵니다.</p><div class="empty">삭제한 학생이 없습니다.</div>', () => $('#modal').close(), '닫기');
  modal('삭제 학생 휴지통 · 여러 명 복원', `<p class="sub">복원할 학생을 여러 명 선택하세요. 학생 정보와 기존 성적·공개 글·작성 이력·내부 메모가 함께 복원됩니다.</p>${studentSelectionPanel(list, 'restore')}`, form => {
    const ids = form.getAll('studentIds'); if (!ids.length) return toast('복원할 학생을 선택해주세요.');
    $('#modal').close(); confirmStudentBatch('restore', ids);
  }, '선택 학생 확인');
  updateStudentSelection();
}
function selectedStudentBatch(action, ids) {
  return [...new Set(ids)].map(id => student(id)).filter(s => s && (action === 'restore' ? Boolean(s.deletedAt) : !s.deletedAt));
}
function confirmStudentBatch(action, ids) {
  const list = selectedStudentBatch(action, ids), restore = action === 'restore';
  if (!list.length) return toast('처리할 학생이 없습니다. 목록을 다시 확인해주세요.');
  const selected = new Set(list.map(s => s.id));
  const records = db.records.filter(r => selected.has(r.student)).length;
  const writings = db.writings.filter(w => selected.has(w.student)).length;
  modal(restore ? '학생·성적 일괄 복원 확인' : '학생 일괄 삭제 확인', `<p><strong>${list.length}명</strong>의 학생을 ${restore ? '복원' : '삭제'}할까요?</p><ul class="student-batch-names">${list.map(s => `<li><strong>${esc(s.name)}</strong><span>${esc(s.grade)}</span></li>`).join('')}</ul><div class="batch-record-summary"><span>학생 <b>${list.length}명</b></span><span>성적 <b>${records}건</b></span><span>작성한 글 <b>${writings}건</b></span></div>${helpBox(restore ? '성적까지 함께 복원됩니다' : '기록은 지우지 않고 휴지통에 함께 보관합니다', restore ? '학생 목록과 성적 입력에 다시 표시되며, 기존 성적·공개 평가·작성 이력·내부 메모를 그대로 사용할 수 있습니다.' : '선택한 학생은 일반 목록과 성적 입력에서 제외됩니다. 성적·공개 평가·작성 이력·내부 메모는 유지되어 삭제 학생 휴지통에서 함께 복원할 수 있습니다. 이미 생성한 공유 학부모 전달 카드는 그대로 유지됩니다.')}`, () => {
    const count = commitStudentBatch(action, list.map(s => s.id));
    letterEditing = null; letterHistoryOpen = null; historyPreview = null;
    $('#modal').close(); page = 'students'; render(); toast(`${count}명의 학생과 기록을 ${restore ? '복원했습니다.' : '휴지통으로 이동했습니다.'}`);
  }, restore ? `${list.length}명 학생·성적 복원하기` : `${list.length}명 삭제하기`);
  if (!restore) $('#modalForm button[type="submit"]').classList.replace('primary', 'danger');
}
function commitStudentBatch(action, ids) {
  const list = selectedStudentBatch(action, ids), deletedAt = new Date().toISOString();
  list.forEach(s => { if (action === 'restore') delete s.deletedAt; else s.deletedAt = deletedAt; });
  if (list.length) log(`${list.length}명 학생 ${action === 'restore' ? '성적 포함 복원' : '삭제 · 휴지통 이동'}: ${list.map(s => s.name).join(', ')}`);
  return list.length;
}

function studentUnavailable() {
  $('#app').innerHTML = `<div class="report-shell"><header class="report-top">${brand()}</header><div class="empty"><h2>학생 기록을 확인할 수 없습니다.</h2><p class="sub">삭제한 학생은 학생 관리의 휴지통에서 복원해주세요.</p><a href="#" class="btn primary" onclick="page='students'">학생 관리로</a></div></div>`;
}
function defaultLearningContents(name) {
  let values;
  if (/문장제|문제해결/.test(name)) values = [
    '그림 속 상황 이야기하기, 같은 것 찾기', '그림에 맞는 수식 만들기, 조건에 따라 분류하기',
    '그림과 짧은 문장에서 덧셈·뺄셈식 만들기', '조건을 읽고 덧셈·뺄셈·곱셈으로 해결하기',
    '문제의 조건 정리하기, 곱셈·나눗셈으로 해결하기', '두 단계 문제 해결하기, 풀이 과정 설명하기',
    '분수·소수 문제의 해결 전략 세우기, 답 확인하기', '비와 비율을 활용한 문제 해결, 여러 풀이 비교하기'
  ];
  else if (/수 감각|수 개념/.test(name)) values = [
    '사물 세기, 수량 비교, 수와 양 연결하기', '수의 순서, 수의 크기 비교, 수 가르기와 모으기',
    '100까지의 수, 수의 순서와 크기 비교', '네 자리 수, 자리값, 수의 크기 비교',
    '분수와 소수의 의미, 수직선에서 수 비교하기', '큰 수의 자리값, 분수·소수의 크기 비교',
    '약수와 배수의 관계, 분수의 크기, 수의 어림', '분수·소수의 관계와 수 감각, 비의 의미 이해'
  ];
  else if (/연산/.test(name)) values = [
    '구체물로 수 모으기와 가르기', '덧셈·뺄셈의 뜻, 구체물로 계산하기',
    '수 가르기와 모으기, 덧셈과 뺄셈', '받아올림·받아내림이 있는 계산, 곱셈구구',
    '세 자리 수의 덧셈·뺄셈, 곱셈과 나눗셈', '큰 수의 곱셈·나눗셈, 분수·소수의 덧셈과 뺄셈',
    '자연수 혼합 계산, 분수·소수의 덧셈·뺄셈과 곱셈', '분수와 소수의 나눗셈, 계산 결과 어림과 확인'
  ];
  else if (/입체|공간/.test(name)) values = [
    '블록 쌓기, 같은 입체 모양 찾기', '쌓기나무로 모양 만들기, 위치와 방향 말하기',
    '상자·공 모양 살펴보기, 쌓기나무로 만들기', '입체 모양 분류하기, 위치와 방향 표현하기',
    '입체 모양 관찰과 구성, 공간 속 위치 설명하기', '쌓기나무 구성하기, 여러 방향에서 모양 관찰하기',
    '직육면체의 성질과 전개도, 입체 모양 구성하기', '각기둥·각뿔·원기둥·원뿔·구, 위·앞·옆에서 본 모양'
  ];
  else if (/도형/.test(name)) values = [
    '동그라미·세모·네모 찾기, 모양 맞추기', '모양의 공통점 찾기, 조각으로 모양 만들기',
    '여러 가지 모양 찾기와 만들기', '삼각형·사각형·원의 특징, 도형으로 모양 만들기',
    '평면도형의 요소, 직각, 원의 중심과 반지름', '삼각형·사각형의 성질, 평면도형의 이동',
    '합동과 대칭, 도형의 대응 관계', '입체도형의 성질, 공간과 입체, 도형의 구성'
  ];
  else if (/측정/.test(name)) values = [
    '길이·크기·높이 비교하기', '길이·무게·들이 비교, 하루의 시간 알아보기',
    '길이와 양 비교하기, 시각 읽기', '센티미터·미터, 길이 재기, 시각과 시간',
    '길이와 시간, 들이와 무게, 단위 바꾸기', '각도 재기, 각도의 합, 측정 단위 활용',
    '다각형의 둘레와 넓이, 단위와 어림', '직육면체의 부피·겉넓이, 원의 넓이'
  ];
  else if (/관계|규칙/.test(name)) values = [
    '색·모양의 반복 규칙 찾기', '규칙에 따라 배열하기, 다음 모양 예상하기',
    '물체·무늬·수의 간단한 규칙 찾기', '수 배열과 곱셈표에서 규칙 찾기',
    '수와 모양의 변화 규칙, 수 사이의 관계 설명하기', '규칙 찾기, 같은 크기의 관계, 수 배열의 관계',
    '규칙과 대응, 두 양 사이의 관계 표현하기', '비와 비율, 비례식과 비례배분'
  ];
  else if (/자료|가능성/.test(name)) values = [
    '색·모양에 따라 같은 것끼리 모으기', '기준에 따라 분류하기, 개수 비교하기',
    '같은 것끼리 분류하고 개수 세기', '분류하기, 표와 그래프로 나타내기',
    '자료를 모아 표와 그림그래프로 정리하기', '막대그래프와 꺾은선그래프 읽기',
    '평균 구하기, 일이 일어날 가능성 비교하기', '띠그래프·원그래프 해석, 자료로 설명하고 판단하기'
  ];
  else values = grades.map(() => '기본 개념 익히기, 배운 내용을 문제에 적용하고 풀이 설명하기');
  return Object.fromEntries(grades.map((grade, i) => [grade, values[i]]));
}
function learningExample(type, grade) {
  return type.learningContents?.[grade] ?? defaultLearningContents(type.name)[grade] ?? '기본 개념 익히기와 문제 해결';
}
function typeModal(kind, id) {
  const type = db[kind].find(t => t.id === id) || { name: '', desc: '' };
  const contents = { ...defaultLearningContents(type.name), ...type.learningContents };
  modal(id ? '유형 설명·학습 내용 수정' : '새 유형 추가', `<div class="form-grid">${field('유형 이름', `<input name="name" value="${esc(type.name)}" required maxlength="30">`, true)}${field('학부모용 쉬운 설명', `<textarea name="desc" required maxlength="1000">${esc(type.desc)}</textarea>`, true)}</div><div class="learning-editor-heading"><h3>연령·학년별 학습 내용</h3><p class="sub">학생의 연령·학년에 맞는 내용이 성장기록과 공유 학부모 전달 카드에 표시됩니다. 기본 내용을 직접 수정할 수 있습니다.</p></div><div class="form-grid learning-editor-fields">${grades.map((grade, i) => field(grade, `<textarea name="content_${i}" required maxlength="500">${esc(contents[grade])}</textarea>`)).join('')}</div>`, form => {
    const values = Object.fromEntries(form);
    const updated = { name: values.name.trim(), desc: values.desc.trim(), learningContents: Object.fromEntries(grades.map((grade, i) => [grade, values['content_' + i].trim()])) };
    if (!updated.name || !updated.desc || Object.values(updated.learningContents).some(v => !v)) return toast('유형 설명과 학습 내용을 모두 입력해주세요.');
    if (id) Object.assign(type, updated); else db[kind].push({ ...updated, id: crypto.randomUUID() });
    log(`${updated.name} 유형 설명·학습 내용 수정`); $('#modal').close(); render(); toast('유형 설명과 연령·학년별 학습 내용을 저장했습니다.');
  });
}
function studentModal(id) {
  ensureClasses();
  if (id && student(id)?.deletedAt) return toast('삭제 학생 휴지통에서 먼저 복원해주세요.');
  const s = student(id) || { name: '', grade: '초1', gender: '', school: '', entry: '', status: '재원' };
  modal(id ? '학생 정보 수정' : '새로운 성장의 시작', `<div class="form-grid">${field('학생 이름 *', `<input name="name" value="${esc(s.name)}" required maxlength="30" placeholder="이름을 입력하세요">`)}${field('연령·학년 *', `<select name="grade" id="studentGrade" onchange="updateCharacterPreview()">${options(grades, s.grade)}</select>`)}<fieldset class="gender-field"><legend>성별 *</legend><label><input type="radio" name="gender" value="boy" required ${s.gender === 'boy' ? 'checked' : ''} onchange="updateCharacterPreview()"><span>남자</span></label><label><input type="radio" name="gender" value="girl" required ${s.gender === 'girl' ? 'checked' : ''} onchange="updateCharacterPreview()"><span>여자</span></label></fieldset><div id="characterPreview" class="registration-preview"></div>${field('학교명', `<input name="school" value="${esc(s.school)}" placeholder="선택 입력">`)}${field('입학 예정 연도', `<input name="entry" type="number" min="2026" max="2040" value="${s.entry || ''}" placeholder="6세·7세 학생 선택 입력">`)}${field('소속 반', `<select name="classId"><option value="">미배정</option>${options(db.classes, s.classId)}</select>`)}${field('재원 상태', `<select name="status">${options(['재원', '휴원', '졸업'], s.status)}</select>`)}</div><p class="sub">선택한 성별과 연령·학년에 맞는 캐릭터가 PC·모바일 학부모 전달 카드에 동일하게 표시됩니다.</p>`, f => {
    const values = Object.fromEntries(f); values.name = values.name.trim(); if (!values.name) return;
    values.entry = Number(values.entry) || null;
    if (id) Object.assign(s, values); else db.students.push({ ...values, id: crypto.randomUUID(), note: '', evaluation: '', plan: '', message: '' });
    log(`${values.name} 학생 ${id ? '수정' : '등록'}`); $('#modal').close(); render(); toast('학생 정보를 저장했습니다.');
  });
  updateCharacterPreview();
}
function updateCharacterPreview() {
  const gender = document.querySelector('input[name="gender"]:checked')?.value || '';
  const grade = $('#studentGrade').value;
  $('#characterPreview').innerHTML = character({ grade, gender }) + `<span>${['6~7세', '초등 저학년 · 초1~3', '초등 고학년 · 초4~6'][ageBand(grade)]}<small>${gender ? (gender === 'boy' ? '남자' : '여자') + ' 캐릭터' : '성별을 선택해주세요'}</small></span>`;
}
function selectScore(value) {
  $('#scoreValue').value = value;
  document.querySelectorAll('#scoreChips button').forEach(b => b.classList.toggle('selected', Number(b.dataset.score) === value));
}
function openBatchScore(id) {
  modal('5점 단위 점수 선택', `<p class="sub">${esc(student(id).name)} · 직접 입력도 사용할 수 있습니다.</p><div class="chips batch-score-choices">${Array.from({ length: 21 }, (_, i) => 100 - i * 5).map(n => `<button type="button" onclick="setBatchScore('${id}',${n})">${n}점</button>`).join('')}</div>`, () => $('#modal').close(), '닫기');
}
function setBatchScore(id, value) {
  document.querySelector(`.batch-score[data-student="${id}"]`).value = value; $('#modal').close();
}
function growthNewsModal() {
  ensureClasses();
  if (!activeStudents().length) return toast('학생을 등록하거나 휴지통에서 복원해주세요.');
  modal('학부모 전달 카드 작성하기', `<div class="form-grid">${field('반 선택', `<select id="cardStudentClass" onchange="filterCardStudents()"><option value="">전체 반</option><option value="unassigned">미배정</option>${options(db.classes)}</select>`)}${field('학생 이름 검색', '<input type="search" id="cardStudentSearch" placeholder="학생 이름을 입력하세요" oninput="filterCardStudents()">')}${field('학생', `<select name="student" id="cardStudentSelect" required><option value="" disabled selected>학생을 선택하세요</option>${cardStudentOptions(activeStudents())}</select><span class="card-student-count" id="cardStudentCount" role="status">${activeStudents().length}명 · 학생을 선택해주세요.</span>`)}${field('조회 기간', '<select name="newsPeriod"><option value="all">전체 기록</option><option value="year">'+today().slice(0,4)+'년 기록</option><option value="3">최근 3개월</option><option value="6">최근 6개월</option></select>')}</div>${monthlyCardFields(false)}<p class="sub">필요할 때 언제든 작성하고 공유할 수 있습니다. 선택한 기간의 성적을 확인한 뒤, 학생 화면에서 학부모님께 드리는 글을 작성하세요.</p>`, f => {
    const id = f.get('student'); if(!activeStudents().some(s=>s.id===id))return toast('작성할 학생을 선택해주세요.'); period = f.get('monthlyCard') ? 'month:' + f.get('cardMonth') : f.get('newsPeriod'); $('#modal').close(); openProfile(id); beginLetter(id);
  }, '학부모 전달 카드 작성 화면 열기');
}
function migrateReportExperience() {
  if (!Array.isArray(db.writings)) db.writings = [];
  const sampleGender = { st0: 'girl', st1: 'boy', st2: 'girl', st3: 'boy', st4: 'boy', st5: 'girl' };
  db.students.forEach(s => {
    if (!('gender' in s)) s.gender = sampleGender[s.id] || '';
    if (!db.writings.some(w => w.student === s.id) && (s.evaluation || s.plan || s.message)) db.writings.push({ id: crypto.randomUUID(), student: s.id, date: new Date().toISOString(), period: 'year', evaluation: s.evaluation, message: s.message, plan: s.plan, migrated: true });
  });
  // Previously shared reports retain their saved content, with sample character metadata only.
  db.shares.forEach(share => { if (!('gender' in share.student)) share.student.gender = sampleGender[share.student.id] || ''; });
  [...db.school, ...db.academy].forEach(t => {
    // Old archived types return to the list; deleted types stay in the trash.
    t.archived = Boolean(t.deletedAt);
    const defaults = defaultLearningContents(t.name);
    if (!t.learningContents || typeof t.learningContents !== 'object') t.learningContents = {};
    grades.forEach(g => { if (!(g in t.learningContents)) t.learningContents[g] = defaults[g]; });
  });
  save();
}
if (typeof window === 'undefined' || !window.BRAIN_CLOUD_CONFIG?.url || !window.BRAIN_CLOUD_CONFIG?.anonKey) {
ensureClasses();
migrateReportExperience();
advance();
window.addEventListener('hashchange', render);
render();
}

function ensureClasses() {
  if (!Array.isArray(db.classes)) { db.classes = Array.from({length:10}, (_,i)=>({id:'class'+(i+1),name:(i+1)+'반'})); save(); }
}
function className(id) { return db.classes?.find(c=>c.id===id)?.name || '미배정'; }
function filterBatchStudents() {
  const classId=$('#batchClass').value, query=$('#batchStudentSearch').value.trim().toLocaleLowerCase();
  let visible=0, hiddenScores=0;
  document.querySelectorAll('[data-batch-student]').forEach(row=>{
    const s=student(row.dataset.batchStudent);
    row.hidden=!!((classId==='unassigned'?!!s.classId:classId&&s.classId!==classId)||!s.name.toLocaleLowerCase().includes(query));
    if(!row.hidden) visible++; else if(row.querySelector('.batch-score').value!=='') hiddenScores++;
  });
  $('#batchStudentCount').textContent=visible+'명 표시'+(visible?' · 현재 보이는 학생 중 점수를 입력한 학생만 저장됩니다.':' · 검색 결과가 없습니다. 반이나 이름을 바꿔주세요.')+(hiddenScores?' 숨겨진 학생 '+hiddenScores+'명의 입력 점수는 유지되며 이번 저장에서는 제외됩니다.':'');
}
function classManager() { navigate('classes'); }
function addClassField() {
  const n=$('#classEditor').querySelectorAll('input').length+1;
  $('#classEditor').insertAdjacentHTML('beforeend',field('반 이름','<input name="'+crypto.randomUUID()+'" value="'+n+'반" required maxlength="30">'));
  document.querySelector('#classEditor .field:last-child input').focus();
}

function managementStudents() {
  return activeStudents().filter(s=>(s.name.includes(filter)||(s.school||'').includes(filter))&&(!gradeFilter||s.grade===gradeFilter)&&(page!=='students'||!managementClassFilter||(managementClassFilter==='unassigned'?!s.classId:s.classId===managementClassFilter)));
}
function managementSelectionToolbar() {
  const list=managementStudents(), selected=list.filter(s=>managementSelection.has(s.id)).length;
  return '<div class="management-selection-toolbar"><label><input id="managementSelectAll" type="checkbox" '+(list.length&&selected===list.length?'checked':'')+' onchange="selectAllManagementStudents(this.checked)">현재 목록 전체 선택</label><strong id="managementSelectionCount" aria-live="polite">'+managementSelection.size+'명 선택</strong><div class="actions"><button id="managementAssignButton" class="btn primary" '+(!managementSelection.size?'disabled':'')+' onclick="assignSelectedClass()">선택 학생 반 배정·이동</button><button class="btn" onclick="clearManagementSelection()">선택 해제</button></div><p id="managementSelectionHint" class="sub">검색·반 필터를 바꿔도 선택은 유지됩니다. 배정 전 전체 명단을 확인할 수 있습니다.</p></div>';
}
function selectManagementStudent(id,checked) { if(checked)managementSelection.add(id);else managementSelection.delete(id);updateManagementSelection(); }
function selectAllManagementStudents(checked) { managementStudents().forEach(s=>{if(checked)managementSelection.add(s.id);else managementSelection.delete(s.id)});updateRows(); }
function clearManagementSelection(){managementSelection.clear();updateRows();}
function updateManagementSelection() {
  for(const id of managementSelection)if(!student(id)||student(id).deletedAt)managementSelection.delete(id);
  if(!$('#managementSelectAll'))return;
  const list=managementStudents(), count=list.filter(s=>managementSelection.has(s.id)).length;
  $('#managementSelectAll').checked=!!list.length&&count===list.length;
  $('#managementSelectAll').indeterminate=count>0&&count<list.length;
  $('#managementSelectionCount').textContent=managementSelection.size+'명 선택';
  $('#managementAssignButton').disabled=!managementSelection.size;
  const hidden=managementSelection.size-count;
  $('#managementSelectionHint').textContent=list.length+'명 표시 · '+(hidden?'다른 검색·반에서 선택한 '+hidden+'명도 포함됩니다. ':'')+'배정 전 전체 명단을 확인할 수 있습니다.';
}
function assignSelectedClass() {
  const list=activeStudents().filter(s=>managementSelection.has(s.id));
  if(!list.length)return toast('반을 배정할 학생을 선택해주세요.');
  modal('선택 학생 반 배정·이동', '<p class="sub">선택한 '+list.length+'명의 소속 반을 한 번에 변경합니다. 성적·작성 글·내부 메모는 그대로 유지됩니다.</p><ul class="student-batch-names">'+list.map(s=>'<li><strong>'+esc(s.name)+' · '+esc(s.grade)+'</strong><span>현재 '+esc(className(s.classId))+'</span></li>').join('')+'</ul>'+field('배정할 반','<select name="targetClass" required><option value="" disabled selected>이동할 반을 선택하세요</option>'+options(db.classes)+'<option value="unassigned">미배정으로 변경</option></select>'), f=>{
    const target=f.get('targetClass');if(target!=='unassigned'&&!db.classes.some(c=>c.id===target))return toast('배정할 반을 선택해주세요.');
    const count=assignStudentClasses(list.map(s=>s.id),target==='unassigned'?'':target);
    managementSelection.clear();$('#modal').close();render();toast(count+'명의 학생을 '+(target==='unassigned'?'미배정':className(target))+'으로 변경했습니다.');
  },list.length+'명 반 배정·이동 저장');
}
function assignStudentClasses(ids,classId) {
  if(classId&&!db.classes.some(c=>c.id===classId))return 0;
  const unique=new Set(ids), list=activeStudents().filter(s=>unique.has(s.id));
  list.forEach(s=>s.classId=classId);log(list.length+'명 소속 반 변경: '+className(classId));return list.length;
}

function settingsHome(){
  return heading('WORKSPACE SETTINGS','설정','교육과정과 반 이름을 한곳에서 관리하세요.','')+'<div class="settings-home-grid"><section class="panel settings-home-card"><span class="tag">교육과정</span><h2>교육과정 설정</h2><p class="sub">학교 단원과 학교·브레인 속 수학의 유형, 학부모용 설명과 학습 내용을 설정합니다.</p><button class="btn primary" onclick="navigate(&quot;curriculum&quot;)">교육과정 설정 열기 →</button></section><section class="panel settings-home-card"><span class="tag yellow">반 관리</span><h2>반 이름 설정</h2><p class="sub">1반·2반 등의 이름을 수정하거나 새로운 반을 추가합니다. 학생 배정은 학생 관리에서 합니다.</p><button class="btn primary" onclick="navigate(&quot;classes&quot;)">반 이름 설정 열기 →</button></section></div>'+footer();
}
function classSettingsPage(){
  ensureClasses();return heading('CLASS SETTINGS','반 이름 설정','학생 관리와 반별 성적 입력에서 사용하는 반 이름입니다.','<button class="btn" onclick="navigate(&quot;settings&quot;)">← 설정</button>')+'<section class="panel" style="padding:24px"><form onsubmit="event.preventDefault();saveClassSettings(new FormData(this))"><div class="panel-head"><h2>반 이름 목록</h2><span class="tag">관리자 전용</span></div><div id="classEditor">'+db.classes.map(c=>field('반 이름','<input name="'+c.id+'" value="'+esc(c.name)+'" required maxlength="30">')).join('')+'</div><div class="actions"><button type="button" class="btn" onclick="addClassField()">＋ 반 추가</button><button type="submit" class="btn primary">반 이름 저장</button></div></form></section>'+footer();
}
function saveClassSettings(form){
  const values=[...form].map(([id,name])=>({id,name:name.trim()}));
  if(values.some(c=>!c.name))return toast('반 이름을 입력해주세요.');
  if(new Set(values.map(c=>c.name)).size!==values.length)return toast('반 이름이 겹치지 않도록 입력해주세요.');
  db.classes=values;log('반 이름 설정 수정');render();toast('반 이름을 저장했습니다. 학생의 기존 반 배정은 유지됩니다.');
}
function openClassEntry(){
  modal('반별 성적 입력','<p class="sub">반을 선택하면 빠른 입력에 해당 학생들만 표시됩니다.</p>'+field('입력할 반','<select name="entryClass" required><option value="" selected disabled>반을 선택하세요</option>'+db.classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · '+activeStudents().filter(s=>s.classId===c.id).length+'명</option>').join('')+'<option value="unassigned">미배정 · '+activeStudents().filter(s=>!s.classId).length+'명</option></select>'),f=>{
    $('#batchClass').value=f.get('entryClass');$('#batchStudentSearch').value='';filterBatchStudents();$('#modal').close();$('#batchClass').scrollIntoView({block:'center',behavior:'smooth'});$('#batchClass').focus();
  },'선택한 반 입력하기');
}

function monthlyCardFields(enabled,month=today().slice(0,7)) {
  return '<div class="monthly-card-option"><label><input type="checkbox" name="monthlyCard" '+(enabled?'checked':'')+' onchange="toggleMonthlyCardFields(this)">월간 표시</label><label class="field" id="monthlyCardMonth" '+(!enabled?'hidden':'')+'><span>표시할 월</span><input type="month" name="cardMonth" value="'+esc(month)+'" '+(!enabled?'disabled':'')+' required></label><p class="sub">선택하면 해당 월의 성적과 제목에 월이 표시됩니다. 해제하면 월간 표시 없이 선택한 조회 기간으로 보여줍니다.</p></div>';
}
function toggleMonthlyCardFields(input) {
  const form=input.closest('form'), box=form.querySelector('#monthlyCardMonth');box.hidden=!input.checked;box.querySelector('input').disabled=!input.checked;
  const range=form.querySelector('[name="newsPeriod"]');if(range)range.disabled=input.checked;
}
function monthlyCardSettings(){
  modal('월간 표시 설정',monthlyCardFields(period.startsWith('month:'),period.startsWith('month:')?period.slice(6):today().slice(0,7)),f=>{
    period=f.get('monthlyCard')?'month:'+f.get('cardMonth'):'all';$('#modal').close();render();
  },'적용하기');
}

function findCardStudents(query,classId) {
  const q=query.trim().toLocaleLowerCase();
  return activeStudents().filter(s=>s.name.toLocaleLowerCase().includes(q)&&(!classId||(classId==='unassigned'?!s.classId:s.classId===classId)));
}
function cardStudentOptions(list) {
  return list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(s.grade)+' · '+esc(className(s.classId))+'</option>').join('');
}
function filterCardStudents() {
  const select=$('#cardStudentSelect'), previous=select.value, list=findCardStudents($('#cardStudentSearch').value,$('#cardStudentClass').value);
  select.innerHTML='<option value="" disabled selected>'+(list.length?'학생을 선택하세요':'검색 결과가 없습니다')+'</option>'+cardStudentOptions(list);
  if(list.some(s=>s.id===previous))select.value=previous;
  select.disabled=!list.length;
  $('#modalForm button[type="submit"]').disabled=!list.length;
  $('#cardStudentCount').textContent=list.length?list.length+'명 · 이름·학년·반을 확인하고 선택해주세요.':'일치하는 학생이 없습니다. 이름이나 반을 바꿔주세요.';
}
