// ══════════════════════════════════════
//  삭제 권한 단축키 Ctrl+Shift+L
// ══════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    e.preventDefault();
    if (deleteUnlocked) {
      deleteUnlocked = false;
      showToast('🔒 삭제 권한 해제');
    } else {
      const pw = prompt('비밀번호를 입력하세요:');
      if (pw === 'engz1234') {
        deleteUnlocked = true;
        showToast('🔓 삭제 권한 활성화 (새로고침 시 해제)');
        setTimeout(() => {
          deleteUnlocked = false;
          showToast('🔒 삭제 권한 자동 해제');
        }, 5 * 60 * 1000);
      } else if (pw !== null) {
        showToast('❌ 비밀번호가 틀렸어요');
      }
    }
  }
});

// ══════════════════════════════════════
//  STATE
// ══════════════════════════════════════
let allPassages = [];
let currentPassage = null;
let paragraphs = [];
let sentences = [];
let meanings = [];
let hasMeaning = false;
let hasTyping = false;
let hasRecall = false;
let currentStep = 0;
let currentParaIdx = 0;
let readClicked = new Set();
let blankMap = {};
let paraOrderItems = [];
let orderItems = [];
let paraOrderItemsMap = {};
let typeStats = { correct: 0, wrong: 0 };
let blankTypeStats = { correct: 0, wrong: 0 };
let recallStats = { ok: 0, no: 0 };
let wordArrangeStats = { correct: 0, wrong: 0 };
let meaningTypeStats = { correct: 0, wrong: 0 };
let wordArrangeParaSentIdx = 0;
let meaningTypeParaSentIdx = 0;
let wordArrangeSelected = [];
let wordArrangeShuffled = [];
let homeTab = 'all';
let paraInputCount = 0;
let deleteUnlocked = false;

// ══════════════════════════════════════
//  초기화
// ══════════════════════════════════════
window.onload = () => {
  addPara();
  loadPassages();
};

// ══════════════════════════════════════
//  PAGE
// ══════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════════════
//  TOAST
// ══════════════════════════════════════
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ══════════════════════════════════════
//  FAQ
// ══════════════════════════════════════
function showFaq() { document.getElementById('faqModal').classList.add('open'); }
function closeFaq() { document.getElementById('faqModal').classList.remove('open'); }

// ══════════════════════════════════════
//  API
// ══════════════════════════════════════
async function apiFetch(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  return res.json();
}

// ══════════════════════════════════════
//  홈 탭
// ══════════════════════════════════════
function switchHomeTab(tab) {
  homeTab = tab;
  document.getElementById('tabAll').classList.toggle('active', tab === 'all');
  document.getElementById('tabFav').classList.toggle('active', tab === 'fav');
  filterPassages();
}

// ══════════════════════════════════════
//  지문 목록
// ══════════════════════════════════════
async function loadPassages() {
  const list = document.getElementById('passageList');
  list.innerHTML = '<div class="empty-state">불러오는 중...</div>';
  try {
    allPassages = await apiFetch('/api/passages');
    filterPassages();
  } catch {
    list.innerHTML = '<div class="empty-state">불러오기 실패. 서버를 확인하세요.</div>';
  }
}

function filterPassages() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  let list = allPassages.filter(p =>
    p.title.toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  );
  if (homeTab === 'fav') list = list.filter(p => isFav(p.id));
  renderPassageList(list);
}

function renderPassageList(passages) {
  const list = document.getElementById('passageList');
  if (!passages.length) {
    list.innerHTML = `<div class="empty-state">${homeTab === 'fav' ? '즐겨찾기한 지문이 없어요.' : '아직 지문이 없어요. 첫 지문을 올려보세요!'}</div>`;
    return;
  }
  list.innerHTML = passages.map(p => {
    const progress = getProgress(p.id);
    const badge = progress ? `<div class="progress-badge">${progress.currentStep + 1}단계</div>` : '';
    const fav = isFav(p.id) ? `<div class="fav-badge">⭐</div>` : '';
    const tags = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    const meaningBadge = p.hasMeaning ? `<span class="tag" style="border-color:var(--accent);color:var(--accent)">뜻포함</span>` : '';
    return `
      <div class="passage-card" onclick="startStudy('${p.id}')">
        ${badge}${fav}
        <h3>${p.title}</h3>
        <div class="meta">
          <span>✍ ${p.author || '익명'}</span>
          <span>${formatDate(p.createdAt)}</span>
          <span>${(p.paragraphs || []).length}문단</span>
        </div>
        <div class="tags">${meaningBadge}${tags}</div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn-delete" onclick="deletePassage('${p.id}')">삭제</button>
        </div>
      </div>`;
  }).join('');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

async function deletePassage(id) {
  if (!deleteUnlocked) {
    showToast('🔒 삭제 권한이 없어요. Ctrl+Shift+L을 누르세요.');
    return;
  }
  if (!confirm('이 지문을 삭제할까요?')) return;
  await apiFetch(`/api/passages/${id}`, { method: 'DELETE' });
  showToast('삭제되었어요');
  loadPassages();
}

// ══════════════════════════════════════
//  즐겨찾기
// ══════════════════════════════════════
function getFavs() { return JSON.parse(localStorage.getItem('favs') || '[]'); }
function isFav(id) { return getFavs().includes(id); }
function toggleFav() {
  if (!currentPassage) return;
  const favs = getFavs();
  const idx = favs.indexOf(currentPassage.id);
  if (idx === -1) favs.push(currentPassage.id);
  else favs.splice(idx, 1);
  localStorage.setItem('favs', JSON.stringify(favs));
  updateFavBtn();
  showToast(isFav(currentPassage.id) ? '즐겨찾기 추가!' : '즐겨찾기 해제');
}
function updateFavBtn() {
  const btn = document.getElementById('favBtn');
  if (!btn || !currentPassage) return;
  btn.textContent = isFav(currentPassage.id) ? '⭐' : '☆';
  btn.classList.toggle('active', isFav(currentPassage.id));
}

// ══════════════════════════════════════
//  업로드 옵션 토글
// ══════════════════════════════════════
function toggleMeaningMode() {
  const on = document.getElementById('meaningToggle').checked;
  document.getElementById('meaningHint').style.display = on ? 'block' : 'none';
}

// ══════════════════════════════════════
//  문단 입력 UI
// ══════════════════════════════════════
function addPara() {
  const container = document.getElementById('paragraphInputs');
  const idx = paraInputCount++;
  const div = document.createElement('div');
  div.className = 'para-input-wrap';
  div.dataset.idx = idx;
  div.innerHTML = `
    <div class="para-input-header">
      <span class="para-label">문단 ${container.children.length + 1}</span>
      <button class="btn-remove-para" onclick="removePara(this)">✕</button>
    </div>
    <textarea class="para-textarea" placeholder="문단 붙여넣기..."></textarea>`;
  container.appendChild(div);
  updateParaLabels();
}

function removePara(btn) {
  const wrap = btn.closest('.para-input-wrap');
  if (document.getElementById('paragraphInputs').children.length <= 1) {
    showToast('문단이 최소 1개는 있어야 해요');
    return;
  }
  wrap.remove();
  updateParaLabels();
}

function updateParaLabels() {
  document.querySelectorAll('.para-input-wrap').forEach((el, i) => {
    el.querySelector('.para-label').textContent = `문단 ${i + 1}`;
  });
}

// ══════════════════════════════════════
//  업로드
// ══════════════════════════════════════
async function uploadPassage() {
  const title = document.getElementById('upTitle').value.trim();
  const author = document.getElementById('upAuthor').value.trim();
  const tagsRaw = document.getElementById('upTags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const withMeaning = document.getElementById('meaningToggle').checked;
  const withTyping = document.getElementById('typingToggle').checked;
  const withRecall = document.getElementById('recallToggle').checked;

  const paraTexts = [...document.querySelectorAll('.para-textarea')]
    .map(t => t.value.trim()).filter(Boolean);

  if (!title || !paraTexts.length) { showToast('제목과 문단은 필수예요!'); return; }

  const parasData = paraTexts.map(text => parseParaWithMeaning(text, withMeaning));

  try {
    await apiFetch('/api/passages', {
      method: 'POST',
      body: JSON.stringify({
        title, author, tags,
        paragraphs: parasData,
        hasMeaning: withMeaning,
        hasTyping: withTyping,
        hasRecall: withRecall,
      }),
    });
    showToast('지문이 공유되었어요!');
    document.getElementById('upTitle').value = '';
    document.getElementById('upAuthor').value = '';
    document.getElementById('upTags').value = '';
    document.getElementById('paragraphInputs').innerHTML = '';
    paraInputCount = 0;
    addPara();
    await loadPassages();
    showPage('page-home');
  } catch {
    showToast('저장 실패. 다시 시도해보세요.');
  }
}

// ══════════════════════════════════════
//  파싱 유틸
// ══════════════════════════════════════
function parseParaWithMeaning(text, withMeaning) {
  if (!withMeaning) {
    return { sentences: parseSentences(text), meanings: null };
  }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sentList = [];
  const meanList = [];
  for (let i = 0; i < lines.length; i += 2) {
    const eng = lines[i];
    const kor = lines[i + 1] || '';
    if (eng) { sentList.push(eng); meanList.push(kor); }
  }
  return { sentences: sentList, meanings: meanList };
}

function parseSentences(text) {
  const sents = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sents.map(s => s.trim()).filter(s => s.length > 3);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(str) {
  return str.trim().toLowerCase()
    .replace(/[.,!?;:'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ══════════════════════════════════════
//  학습 시작
// ══════════════════════════════════════
function startStudy(id) {
  currentPassage = allPassages.find(p => p.id === id);
  if (!currentPassage) return;

  hasMeaning = !!currentPassage.hasMeaning;
  hasTyping = currentPassage.hasTyping !== false;
  hasRecall = currentPassage.hasRecall !== false;

  if (currentPassage.paragraphs && currentPassage.paragraphs.length) {
    paragraphs = currentPassage.paragraphs;
  } else if (currentPassage.content) {
    paragraphs = [{ sentences: parseSentences(currentPassage.content), meanings: null }];
  }

  sentences = paragraphs.flatMap(p => p.sentences || p);
  meanings = hasMeaning
    ? paragraphs.flatMap(p => p.meanings || (p.sentences || p).map(() => null))
    : sentences.map(() => null);

  document.getElementById('studyTitle').textContent = currentPassage.title;
  typeStats = { correct: 0, wrong: 0 };
  blankTypeStats = { correct: 0, wrong: 0 };
  recallStats = { ok: 0, no: 0 };
  wordArrangeStats = { correct: 0, wrong: 0 };
  meaningTypeStats = { correct: 0, wrong: 0 };
  readClicked = new Set();

  updateFavBtn();
  updateStepTabs();

  buildStep0();
  buildStep3();
  buildStep4();
  if (hasMeaning) { buildStep5(); buildStep6(); }
  if (hasTyping) buildStep7();
  if (hasRecall) buildStep8();

  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active', 'done'));
  document.querySelector('.step-tab[data-step="0"]').classList.add('active');
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step-0').classList.add('active');
  currentStep = 0;

  showPage('page-study');
}

// ══════════════════════════════════════
//  스텝 탭 상태 업데이트
// ══════════════════════════════════════
function updateStepTabs() {
  ['5', '6'].forEach(n => {
    const tab = document.querySelector(`.step-tab[data-step="${n}"]`);
    if (!tab) return;
    if (!hasMeaning) {
      tab.classList.add('disabled');
      tab.setAttribute('title', '뜻 포함 지문에서만 사용 가능');
    } else {
      tab.classList.remove('disabled');
      tab.removeAttribute('title');
    }
  });
  const tab7 = document.querySelector('.step-tab[data-step="7"]');
  if (tab7) {
    if (!hasTyping) { tab7.classList.add('disabled'); tab7.setAttribute('title', '업로드 시 미선택'); }
    else { tab7.classList.remove('disabled'); tab7.removeAttribute('title'); }
  }
  const tab8 = document.querySelector('.step-tab[data-step="8"]');
  if (tab8) {
    if (!hasRecall) { tab8.classList.add('disabled'); tab8.setAttribute('title', '업로드 시 미선택'); }
    else { tab8.classList.remove('disabled'); tab8.removeAttribute('title'); }
  }
}

// ══════════════════════════════════════
//  단계 이동
// ══════════════════════════════════════
function goStep(n) {
  const tab = document.querySelector(`.step-tab[data-step="${n}"]`);
  if (tab && tab.classList.contains('disabled')) {
    showToast('이 단계는 사용할 수 없어요');
    return;
  }
  if (n === 1) buildParaOrder();
  if (n === 2) buildOrder();
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  document.querySelectorAll('.step-tab').forEach((t, i) => {
    t.classList.remove('active', 'done');
    if (i < n) t.classList.add('done');
  });
  document.querySelector(`.step-tab[data-step="${n}"]`).classList.add('active');
  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════════════
//  문단별 공통 유틸
// ══════════════════════════════════════
function resetParaIdx() { currentParaIdx = 0; }

function getParaOffset(paraIdx) {
  return paragraphs.slice(0, paraIdx).reduce((acc, p) => acc + (p.sentences || p).length, 0);
}

function getCurrentParaSentences() {
  const p = paragraphs[currentParaIdx];
  return p ? (p.sentences || p) : [];
}

function getCurrentParaMeanings() {
  const p = paragraphs[currentParaIdx];
  return (p && p.meanings) ? p.meanings : [];
}

function paraNavHTML(stepNum) {
  const total = paragraphs.length;
  const dots = paragraphs.map((_, i) =>
    `<span class="para-dot ${i < currentParaIdx ? 'done' : i === currentParaIdx ? 'active' : ''}"
      onclick="jumpToPara(${i}, ${stepNum})" style="cursor:pointer">${i + 1}</span>`
  ).join('');
  const isLast = currentParaIdx >= total - 1;
  return `
    <div class="para-nav">
      <div class="para-dots">${dots}</div>
      <div class="para-nav-label">문단 ${currentParaIdx + 1} / ${total}</div>
      <button class="btn-para-next" onclick="nextPara(${stepNum})">
        ${isLast ? '✓ 이 단계 완료' : '다음 문단 →'}
      </button>
    </div>`;
}

function jumpToPara(idx, stepNum) {
  if (idx === currentParaIdx) return;
  currentParaIdx = idx;
  switch (stepNum) {
    case 0: renderStep0Para(); break;
    case 2: renderStep2Para(); break;
    case 3: renderStep3Para(); break;
    case 4: renderStep4Para(); break;
    case 5: wordArrangeParaSentIdx = 0; renderStep5Card(); break;
    case 6: meaningTypeParaSentIdx = 0; renderStep6Card(); break;
    case 7: renderStep7Para(); break;
    case 8: renderStep8Para(); break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setBlankRatio(ratio) {
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  paraSents.forEach((s, i) => {
    const globalIdx = offset + i;
    const words = s.split(/\s+/);
    const n = ratio >= 1 ? words.length : Math.max(1, Math.round(words.length * ratio));
    blankMap[globalIdx] = shuffle([...Array(words.length).keys()]).slice(0, n);
  });
  buildStep4();
}

function nextPara(stepNum) {
  if (currentParaIdx < paragraphs.length - 1) {
    currentParaIdx++;
    switch (stepNum) {
      case 0: renderStep0Para(); break;
      case 2: renderStep2Para(); break;
      case 3: renderStep3Para(); break;
      case 4: renderStep4Para(); break;
      case 5: renderStep5Para(); break;
      case 6: renderStep6Para(); break;
      case 7: renderStep7Para(); break;
      case 8: renderStep8Para(); break;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showToast('🎉 모든 문단 완료!');
    const nextStep = getNextActiveStep(stepNum);
    if (nextStep !== null) {
      if (confirm('이 단계를 완료했어요! 다음 단계로 넘어갈까요?')) goStep(nextStep);
    } else {
      finishStudy();
    }
  }
}

function getNextActiveStep(current) {
  for (let n = current + 1; n <= 8; n++) {
    const tab = document.querySelector(`.step-tab[data-step="${n}"]`);
    if (tab && !tab.classList.contains('disabled')) return n;
  }
  return null;
}

// ══════════════════════════════════════
//  STEP 0: 정독 (문단별)
// ══════════════════════════════════════
function buildStep0() {
  resetParaIdx();
  readClicked = new Set();
  renderStep0Para();
}

function renderStep0Para() {
  const paraSents = getCurrentParaSentences();
  const paraMeans = getCurrentParaMeanings();
  const offset = getParaOffset(currentParaIdx);
  const area = document.getElementById('readArea');
  area.innerHTML =
    paraNavHTML(0) +
    paraSents.map((s, i) => {
      const globalIdx = offset + i;
      const meaning = paraMeans[i] ? `<div class="read-meaning">${paraMeans[i]}</div>` : '';
      return `
        <div class="read-sentence" id="rs${globalIdx}" onclick="clickSentence(${globalIdx})">
          <span class="snum">${globalIdx + 1}</span>
          <div><span>${s}</span>${meaning}</div>
        </div>`;
    }).join('');
  document.getElementById('readProgress').style.width = '0%';
}

function clickSentence(i) {
  document.getElementById('rs' + i).classList.toggle('clicked');
  readClicked.add(i);
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  const paraClicked = paraSents.filter((_, j) => readClicked.has(offset + j)).length;
  document.getElementById('readProgress').style.width =
    Math.min(paraClicked / paraSents.length * 100, 100) + '%';
}

// ══════════════════════════════════════
//  STEP 1: 문단 순서
// ══════════════════════════════════════
function buildParaOrder() {
  paraOrderItems = shuffle(paragraphs.map((para, i) => ({
    para: para.sentences || para,
    origIdx: i
  })));
  renderParaOrderArea();
}

function renderParaOrderArea() {
  const area = document.getElementById('paraOrderArea');
  area.innerHTML = paraOrderItems.map((item, i) => {
    const firstSent = item.para[0] || '';
    return `
      <div class="order-card" id="poc${i}">
        <span class="drag-handle"
          onmousedown="startDrag(event,'para',${i})"
          ontouchstart="startDrag(event,'para',${i})">⠿⠿</span>
        <span class="order-card-text">${firstSent}</span>
        <div class="order-btns">
          <button onclick="moveParaCard(${i},-1)">▲</button>
          <button onclick="moveParaCard(${i},1)">▼</button>
        </div>
      </div>`;
  }).join('');
}

function moveParaCard(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= paraOrderItems.length) return;
  [paraOrderItems[i], paraOrderItems[j]] = [paraOrderItems[j], paraOrderItems[i]];
  renderParaOrderArea();
}

function checkParaOrder() {
  let allCorrect = true;
  paraOrderItems.forEach((item, i) => {
    const card = document.getElementById('poc' + i);
    card.classList.remove('correct', 'wrong');
    if (item.origIdx === i) card.classList.add('correct');
    else { card.classList.add('wrong'); allCorrect = false; }
  });
  showToast(allCorrect ? '완벽해요! 🎉' : '틀린 문단이 있어요. 다시 해보세요!');
}

// ══════════════════════════════════════
//  STEP 2: 문장 순서 (문단별)
// ══════════════════════════════════════
function buildOrder() {
  resetParaIdx();
  paraOrderItemsMap = {};
  renderStep2Para();
}

function renderStep2Para() {
  const paraSents = getCurrentParaSentences();
  if (!paraOrderItemsMap[currentParaIdx]) {
    paraOrderItemsMap[currentParaIdx] = shuffle(
      paraSents.map((s, i) => ({ s, origIdx: i }))
    );
  }
  orderItems = paraOrderItemsMap[currentParaIdx];
  const area = document.getElementById('orderArea');
  area.innerHTML =
    paraNavHTML(2) +
    orderItems.map((item, i) => `
      <div class="order-card" id="oc${i}">
        <span class="drag-handle"
          onmousedown="startDrag(event,'sent',${i})"
          ontouchstart="startDrag(event,'sent',${i})">⠿⠿</span>
        <span class="order-card-text">${item.s}</span>
        <div class="order-btns">
          <button onclick="moveCard(${i},-1)">▲</button>
          <button onclick="moveCard(${i},1)">▼</button>
        </div>
      </div>`).join('');
}

function moveCard(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= orderItems.length) return;
  [orderItems[i], orderItems[j]] = [orderItems[j], orderItems[i]];
  paraOrderItemsMap[currentParaIdx] = orderItems;
  renderStep2Para();
}

function checkOrder() {
  let allCorrect = true;
  orderItems.forEach((item, i) => {
    const card = document.getElementById('oc' + i);
    card.classList.remove('correct', 'wrong');
    if (item.origIdx === i) card.classList.add('correct');
    else { card.classList.add('wrong'); allCorrect = false; }
  });
  showToast(allCorrect ? '완벽해요! 🎉' : '틀린 문장이 있어요. 다시 해보세요!');
}

// ══════════════════════════════════════
//  드래그 (마우스 + 터치)
// ══════════════════════════════════════
let dragType = null, dragIdx = null, dragEl = null, dragClone = null, dragOffY = 0;

function startDrag(e, type, idx) {
  e.preventDefault();
  dragType = type;
  dragIdx = idx;
  dragEl = e.currentTarget.closest('.order-card');
  const rect = dragEl.getBoundingClientRect();
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragOffY = clientY - rect.top;
  dragClone = dragEl.cloneNode(true);
  dragClone.style.cssText = `position:fixed;left:${rect.left}px;width:${rect.width}px;opacity:.85;pointer-events:none;z-index:999;border-color:var(--accent);`;
  dragClone.style.top = (clientY - dragOffY) + 'px';
  document.body.appendChild(dragClone);
  dragEl.style.opacity = '0.3';
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
  e.preventDefault();
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragClone.style.top = (clientY - dragOffY) + 'px';
}

function onDragEnd(e) {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchend', onDragEnd);
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  dragClone.remove();
  dragEl.style.opacity = '';
  const area = document.getElementById(dragType === 'para' ? 'paraOrderArea' : 'orderArea');
  const cards = [...area.querySelectorAll('.order-card')];
  let targetIdx = null;
  cards.forEach((card, i) => {
    const rect = card.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) targetIdx = i;
  });
  if (targetIdx !== null && targetIdx !== dragIdx) {
    if (dragType === 'para') {
      const tmp = paraOrderItems[dragIdx];
      paraOrderItems.splice(dragIdx, 1);
      paraOrderItems.splice(targetIdx, 0, tmp);
      renderParaOrderArea();
    } else {
      const tmp = orderItems[dragIdx];
      orderItems.splice(dragIdx, 1);
      orderItems.splice(targetIdx, 0, tmp);
      paraOrderItemsMap[currentParaIdx] = orderItems;
      renderStep2Para();
    }
  }
  dragType = dragIdx = dragEl = dragClone = null;
}

// ══════════════════════════════════════
//  STEP 3: 빈칸 보기 (문단별)
// ══════════════════════════════════════
function buildStep3() {
  blankMap = {};
  sentences.forEach((s, i) => {
    const words = s.split(/\s+/);
    const n = Math.max(1, Math.round(words.length * 0.35));
    blankMap[i] = shuffle([...Array(words.length).keys()]).slice(0, n);
  });
  resetParaIdx();
  renderStep3Para();
}

function renderStep3Para() {
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  const area = document.getElementById('blankArea');
  area.innerHTML =
    paraNavHTML(3) +
    paraSents.map((s, i) => {
      const globalIdx = offset + i;
      const words = s.split(/\s+/);
      const html = words.map((w, j) => {
        if ((blankMap[globalIdx] || []).includes(j)) {
          const clean = w.replace(/[.,!?;:]/g, '');
          const punct = w.slice(clean.length);
          return `<span class="blank-word" id="bw${globalIdx}_${j}" onclick="toggleBlank(${globalIdx},${j})">${clean}</span>${punct} `;
        }
        return w + ' ';
      }).join('');
      return `<div class="blank-sentence"><span class="blank-num">${globalIdx + 1}</span>${html}</div>`;
    }).join('');
}

function toggleBlank(si, wi) { document.getElementById(`bw${si}_${wi}`).classList.toggle('revealed'); }
function revealAllBlanks() { document.querySelectorAll('.blank-word').forEach(el => el.classList.add('revealed')); }
function hideAllBlanks() { document.querySelectorAll('.blank-word').forEach(el => el.classList.remove('revealed')); }
function reshuffleBlanks() {
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  paraSents.forEach((s, i) => {
    const globalIdx = offset + i;
    const words = s.split(/\s+/);
    const n = Math.max(1, Math.round(words.length * 0.35));
    blankMap[globalIdx] = shuffle([...Array(words.length).keys()]).slice(0, n);
  });
  renderStep3Para();
}

// ══════════════════════════════════════
//  STEP 4: 빈칸 타이핑 (문단별) — 버그 수정됨
// ══════════════════════════════════════
function buildStep4() {
  blankTypeStats = { correct: 0, wrong: 0 };
  updateBlankTypeStats();
  resetParaIdx();
  renderStep4Para();
}

function renderStep4Para() {
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  const area = document.getElementById('blankTypeArea');
  area.innerHTML =
    paraNavHTML(4) +
    `<div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn-secondary sm" onclick="setBlankRatio(0.35)">일부 빈칸</button>
      <button class="btn-secondary sm" onclick="setBlankRatio(1)">전체 빈칸</button>
    </div>` +
    paraSents.map((s, i) => {
      const globalIdx = offset + i;
      const words = s.split(/\s+/);
      const blanks = blankMap[globalIdx] || [];
      const html = words.map((w, j) => {
        if (blanks.includes(j)) {
          const clean = w.replace(/[.,!?;:]/g, '');
          const punct = w.slice(clean.length);
          const width = Math.max(70, clean.length * 10);
          // ✅ 수정: onblur 제거, Enter/Space 키만 체크
          return `<input class="blank-type-input" id="bti${globalIdx}_${j}" data-answer="${clean}"
            style="width:${width}px"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();checkBlankType(${globalIdx},${j})}" />${punct} `;
        }
        return w + ' ';
      }).join('');
      return `<div class="blank-sentence"><span class="blank-num">${globalIdx + 1}</span>${html}</div>`;
    }).join('');
}

function checkBlankType(si, wi) {
  const input = document.getElementById(`bti${si}_${wi}`);
  if (!input || input.disabled) return;
  const answer = input.dataset.answer;
  const user = normalize(input.value);
  const correct = normalize(answer);
  if (!user) return;

  if (user === correct) {
    input.disabled = true;
    input.classList.remove('wrong');
    input.classList.add('correct');
    blankTypeStats.correct++;
    updateBlankTypeStats();

    // ✅ 수정: 현재 문단의 모든 빈칸이 완료됐으면 자동으로 다음 문단 이동
    const allDone = [...document.querySelectorAll('.blank-type-input')]
      .every(inp => inp.disabled);
    if (allDone) {
      setTimeout(() => nextPara(4), 600);
    }
  } else {
    input.classList.remove('correct');
    input.classList.add('wrong');
    input.title = `정답: ${answer}`;
    blankTypeStats.wrong++;
    updateBlankTypeStats();
  }
}

function updateBlankTypeStats() {
  document.getElementById('blankTypeCorrect').textContent = blankTypeStats.correct;
  document.getElementById('blankTypeWrong').textContent = blankTypeStats.wrong;
}

// ══════════════════════════════════════
//  STEP 5: 뜻보고 단어 배열 (문단별, 한 화면에 하나)
// ══════════════════════════════════════
function buildStep5() {
  wordArrangeStats = { correct: 0, wrong: 0 };
  resetParaIdx();
  wordArrangeParaSentIdx = 0;
  renderStep5Card();
}

function renderStep5Para() {
  wordArrangeParaSentIdx = 0;
  renderStep5Card();
}

function renderStep5Card() {
  const paraSents = getCurrentParaSentences();
  const paraMeans = getCurrentParaMeanings();
  const offset = getParaOffset(currentParaIdx);
  const total = paraSents.length;
  const i = wordArrangeParaSentIdx;
  if (i >= total) { nextPara(5); return; }

  const globalIdx = offset + i;
  const meaning = paraMeans[i] || '';
  const words = sentences[globalIdx].replace(/[.,!?;:]/g, '').split(/\s+/).filter(Boolean);
  wordArrangeShuffled = shuffle(words.map((w, j) => ({ w, id: j })));
  wordArrangeSelected = [];

  const dotsHTML = paragraphs.map((_, pi) =>
    `<span class="para-dot ${pi < currentParaIdx ? 'done' : pi === currentParaIdx ? 'active' : ''}"
      onclick="jumpToPara(${pi}, 5)" style="cursor:pointer">${pi + 1}</span>`
  ).join('');

  const area = document.getElementById('wordArrangeArea');
  area.innerHTML = `
    <div class="para-nav">
      <div class="para-dots">${dotsHTML}</div>
      <div class="para-nav-label">문단 ${currentParaIdx + 1} / ${paragraphs.length}</div>
    </div>
    <div class="word-arrange-progress">${i + 1} / ${total}</div>
    <div class="word-arrange-meaning">${meaning}</div>
    <div class="word-arrange-answer-area" id="waAnswer"></div>
    <div class="word-arrange-words" id="waWords">
      ${wordArrangeShuffled.map(item =>
        `<button class="word-card" id="wc${item.id}" onclick="selectWord(${item.id}, '${escapeAttr(item.w)}')">${item.w}</button>`
      ).join('')}
    </div>
    <div class="word-arrange-actions">
      <button class="btn-secondary sm" onclick="resetWordArrange()">↺ 초기화</button>
      <button class="btn-accent" onclick="checkWordArrange(${globalIdx})">확인</button>
    </div>
    <div class="type-feedback" id="waFeedback" style="display:none"></div>`;
}

function selectWord(id, word) {
  const btn = document.getElementById('wc' + id);
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.classList.add('used');
  wordArrangeSelected.push({ id, word });
  renderAnswerArea();
}

function renderAnswerArea() {
  const area = document.getElementById('waAnswer');
  if (!area) return;
  area.innerHTML = wordArrangeSelected.map((item, i) =>
    `<span class="answer-word" onclick="deselectWord(${i})">${item.word}</span>`
  ).join('');
}

function deselectWord(idx) {
  const item = wordArrangeSelected[idx];
  wordArrangeSelected.splice(idx, 1);
  const btn = document.getElementById('wc' + item.id);
  if (btn) { btn.disabled = false; btn.classList.remove('used'); }
  renderAnswerArea();
}

function resetWordArrange() {
  wordArrangeSelected = [];
  wordArrangeShuffled.forEach(item => {
    const btn = document.getElementById('wc' + item.id);
    if (btn) { btn.disabled = false; btn.classList.remove('used'); }
  });
  renderAnswerArea();
}

function checkWordArrange(globalIdx) {
  const fb = document.getElementById('waFeedback');
  const userSentence = wordArrangeSelected.map(i => i.word).join(' ');
  const correct = sentences[globalIdx].replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
  fb.style.display = 'block';
  if (normalize(userSentence) === normalize(correct)) {
    fb.className = 'type-feedback correct';
    fb.textContent = '✓ 정답!';
    wordArrangeStats.correct++;
    setTimeout(() => goNextWordArrange(), 800);
  } else {
    fb.className = 'type-feedback wrong';
    fb.innerHTML = `✗ 정답: <span style="color:var(--text)">${sentences[globalIdx]}</span>`;
    wordArrangeStats.wrong++;
    addWrongSentence(globalIdx);
  }
}

function goNextWordArrange() {
  wordArrangeParaSentIdx++;
  if (wordArrangeParaSentIdx >= getCurrentParaSentences().length) {
    nextPara(5);
  } else {
    renderStep5Card();
  }
}

// ══════════════════════════════════════
//  STEP 6: 뜻보고 문장 타이핑 (문단별, 한 화면에 하나)
// ══════════════════════════════════════
function buildStep6() {
  meaningTypeStats = { correct: 0, wrong: 0 };
  resetParaIdx();
  meaningTypeParaSentIdx = 0;
  renderStep6Card();
}

function renderStep6Para() {
  meaningTypeParaSentIdx = 0;
  renderStep6Card();
}

function renderStep6Card() {
  const paraSents = getCurrentParaSentences();
  const paraMeans = getCurrentParaMeanings();
  const offset = getParaOffset(currentParaIdx);
  const total = paraSents.length;
  const i = meaningTypeParaSentIdx;
  if (i >= total) { nextPara(6); return; }

  const globalIdx = offset + i;
  const meaning = paraMeans[i] || '';

  const dotsHTML = paragraphs.map((_, pi) =>
    `<span class="para-dot ${pi < currentParaIdx ? 'done' : pi === currentParaIdx ? 'active' : ''}"
      onclick="jumpToPara(${pi}, 6)" style="cursor:pointer">${pi + 1}</span>`
  ).join('');

  const area = document.getElementById('meaningTypeArea');
  area.innerHTML = `
    <div class="para-nav">
      <div class="para-dots">${dotsHTML}</div>
      <div class="para-nav-label">문단 ${currentParaIdx + 1} / ${paragraphs.length}</div>
    </div>
    <div class="word-arrange-progress">${i + 1} / ${total}</div>
    <div class="word-arrange-meaning">${meaning}</div>
    <input class="type-input" id="mti${globalIdx}" placeholder="영어 문장을 입력하세요..."
      onkeydown="if(event.key==='Enter') checkMeaningType(${globalIdx})" style="margin-top:12px" />
    <div class="type-feedback" id="mtf${globalIdx}" style="display:none;margin-top:8px"></div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn-accent" onclick="checkMeaningType(${globalIdx})">확인</button>
    </div>`;

  setTimeout(() => {
    const inp = document.getElementById('mti' + globalIdx);
    if (inp) inp.focus();
  }, 100);
}

function checkMeaningType(globalIdx) {
  const input = document.getElementById('mti' + globalIdx);
  const fb = document.getElementById('mtf' + globalIdx);
  if (!input || input.disabled) return;
  const user = normalize(input.value);
  const correct = normalize(sentences[globalIdx]);
  fb.style.display = 'block';
  if (user === correct) {
    fb.className = 'type-feedback correct';
    fb.textContent = '✓ 정답!';
    meaningTypeStats.correct++;
    input.disabled = true;
    setTimeout(() => goNextMeaningType(), 800);
  } else {
    fb.className = 'type-feedback wrong';
    const diff = correct.split('').map((c, j) =>
      user[j] === c ? `<span class="char-ok">${c}</span>` : `<span class="char-err">${c}</span>`
    ).join('');
    fb.innerHTML = `✗ 정답: ${diff}`;
    meaningTypeStats.wrong++;
    addWrongSentence(globalIdx);
  }
}

function goNextMeaningType() {
  meaningTypeParaSentIdx++;
  if (meaningTypeParaSentIdx >= getCurrentParaSentences().length) {
    nextPara(6);
  } else {
    renderStep6Card();
  }
}

// ══════════════════════════════════════
//  STEP 7: 문장 타이핑 (문단별)
// ══════════════════════════════════════
function buildStep7() {
  typeStats = { correct: 0, wrong: 0 };
  updateTypeStats();
  resetParaIdx();
  renderStep7Para();
}

function renderStep7Para() {
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  const area = document.getElementById('typeArea');
  area.innerHTML =
    paraNavHTML(7) +
    paraSents.map((s, i) => {
      const globalIdx = offset + i;
      const firstWord = s.split(/\s+/)[0];
      return `
        <div class="type-item">
          <div class="type-hint">힌트: <span class="first">${firstWord}</span> ...</div>
          <input class="type-input" id="ti${globalIdx}" placeholder="문장 전체를 타이핑하세요..."
            onkeydown="if(event.key==='Enter') checkType(${globalIdx})" />
          <div class="type-feedback" id="tf${globalIdx}" style="display:none"></div>
        </div>`;
    }).join('');
}

function checkType(i) {
  const input = document.getElementById('ti' + i);
  const fb = document.getElementById('tf' + i);
  if (input.disabled) return;
  const user = normalize(input.value);
  const correct = normalize(sentences[i]);
  fb.style.display = 'block';
  if (user === correct) {
    fb.className = 'type-feedback correct';
    fb.textContent = '✓ 정답!';
    typeStats.correct++;
    input.disabled = true;
  } else {
    fb.className = 'type-feedback wrong';
    const diff = correct.split('').map((c, j) =>
      user[j] === c ? `<span class="char-ok">${c}</span>` : `<span class="char-err">${c}</span>`
    ).join('');
    fb.innerHTML = `✗ 정답: ${diff}`;
    typeStats.wrong++;
    addWrongSentence(i);
  }
  updateTypeStats();
}

function updateTypeStats() {
  const total = typeStats.correct + typeStats.wrong;
  document.getElementById('typeCorrect').textContent = typeStats.correct;
  document.getElementById('typeWrong').textContent = typeStats.wrong;
  document.getElementById('typeAcc').textContent = total ? Math.round(typeStats.correct / total * 100) + '%' : '—';
}

// ══════════════════════════════════════
//  STEP 8: 암송 (문단별)
// ══════════════════════════════════════
function buildStep8() {
  recallStats = { ok: 0, no: 0 };
  updateRecallStats();
  resetParaIdx();
  renderStep8Para();
}

function renderStep8Para() {
  const paraSents = getCurrentParaSentences();
  const offset = getParaOffset(currentParaIdx);
  const area = document.getElementById('recallArea');
  area.innerHTML =
    paraNavHTML(8) +
    paraSents.map((s, i) => {
      const globalIdx = offset + i;
      return `
        <div class="recall-item">
          <div class="recall-header" onclick="toggleRecall(${globalIdx})">
            <span>문장 ${globalIdx + 1}</span>
            <span style="font-size:.75rem">클릭해서 보기 ▾</span>
          </div>
          <div class="recall-body" id="rb${globalIdx}">
            <p>${s}</p>
            <div class="recall-btns">
              <button class="btn-knew" onclick="markRecall(${globalIdx}, true)">✓ 외웠어요</button>
              <button class="btn-unknown" onclick="markRecall(${globalIdx}, false)">✗ 몰랐어요</button>
            </div>
          </div>
        </div>`;
    }).join('');
}

function toggleRecall(i) { document.getElementById('rb' + i).classList.toggle('open'); }

function markRecall(i, knew) {
  if (knew) recallStats.ok++; else { recallStats.no++; addWrongSentence(i); }
  updateRecallStats();
  document.getElementById('rb' + i).querySelector('.recall-btns').innerHTML =
    knew ? '<span style="color:var(--green);font-size:.85rem">✓ 외움</span>'
         : '<span style="color:var(--red);font-size:.85rem">✗ 모름</span>';
}

function updateRecallStats() {
  const total = recallStats.ok + recallStats.no;
  const pct = total ? Math.round(recallStats.ok / total * 100) : 0;
  document.getElementById('recallPct').textContent = pct + '%';
  document.getElementById('recallProgress').style.width = pct + '%';
}

// ══════════════════════════════════════
//  완료
// ══════════════════════════════════════
function finishStudy() {
  const total = recallStats.ok + recallStats.no;
  const pct = total ? Math.round(recallStats.ok / total * 100) : 0;
  saveProgress(currentPassage.id, { currentStep: 8 });
  const msg = pct >= 80 ? `🎉 ${pct}% 암기! 거의 다 외웠어요!` : `${pct}% 암기했어요. 복습해봐요!`;
  if (confirm(msg + '\n\n틀린 문장만 복습할까요?')) showReview();
  else showPage('page-home');
}

// ══════════════════════════════════════
//  복습
// ══════════════════════════════════════
function showReview() {
  const wrong = getWrongSentences(currentPassage.id);
  const area = document.getElementById('reviewArea');
  if (!wrong.length) {
    area.innerHTML = '<div class="empty-state">틀린 문장이 없어요! 완벽해요 🎉</div>';
    showPage('page-review');
    return;
  }
  area.innerHTML = wrong.map(idx => {
    const s = sentences[idx];
    if (!s) return '';
    const firstWord = s.split(/\s+/)[0];
    return `
      <div class="type-item">
        <div class="type-hint">문장 ${idx + 1} / 힌트: <span class="first">${firstWord}</span> ...</div>
        <input class="type-input" id="ri${idx}" placeholder="문장을 타이핑하세요..."
          onkeydown="if(event.key==='Enter') checkReview(${idx})" />
        <div class="type-feedback" id="rf${idx}" style="display:none"></div>
      </div>`;
  }).join('');
  showPage('page-review');
}

function checkReview(i) {
  const input = document.getElementById('ri' + i);
  const fb = document.getElementById('rf' + i);
  if (!input || input.disabled) return;
  const user = normalize(input.value);
  const correct = normalize(sentences[i]);
  fb.style.display = 'block';
  if (user === correct) {
    fb.className = 'type-feedback correct';
    fb.textContent = '✓ 정답!';
    input.disabled = true;
  } else {
    fb.className = 'type-feedback wrong';
    fb.textContent = `✗ 정답: ${sentences[i]}`;
  }
}

// ══════════════════════════════════════
//  localStorage
// ══════════════════════════════════════
function getProgress(id) { const r = localStorage.getItem('progress_' + id); return r ? JSON.parse(r) : null; }
function saveProgress(id, data) { localStorage.setItem('progress_' + id, JSON.stringify(data)); }
function getWrongSentences(id) { const r = localStorage.getItem('wrong_' + id); return r ? JSON.parse(r) : []; }
function addWrongSentence(idx) {
  if (!currentPassage) return;
  const key = 'wrong_' + currentPassage.id;
  const arr = getWrongSentences(currentPassage.id);
  if (!arr.includes(idx)) arr.push(idx);
  localStorage.setItem(key, JSON.stringify(arr));
}
