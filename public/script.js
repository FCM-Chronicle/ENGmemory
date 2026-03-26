// ══════════════════════════════════════
//  STATE
// ══════════════════════════════════════
let allPassages = [];
let currentPassage = null;
let sentences = [];
let currentStep = 0;
let readClicked = new Set();
let blankMap = {};
let orderItems = [];
let typeStats = { correct: 0, wrong: 0 };
let recallStats = { ok: 0, no: 0 };

// ══════════════════════════════════════
//  PAGE 전환
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
//  API 호출
// ══════════════════════════════════════
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// ══════════════════════════════════════
//  홈: 지문 목록
// ══════════════════════════════════════
async function loadPassages() {
  const list = document.getElementById('passageList');
  list.innerHTML = '<div class="empty-state">불러오는 중...</div>';
  try {
    allPassages = await apiFetch('/api/passages');
    renderPassageList(allPassages);
  } catch {
    list.innerHTML = '<div class="empty-state">불러오기 실패. 서버를 확인하세요.</div>';
  }
}

function renderPassageList(passages) {
  const list = document.getElementById('passageList');
  if (!passages.length) {
    list.innerHTML = '<div class="empty-state">아직 지문이 없어요. 첫 지문을 올려보세요!</div>';
    return;
  }
  list.innerHTML = passages.map(p => {
    const progress = getProgress(p.id);
    const badge = progress ? `<div class="progress-badge">${progress.currentStep + 1}단계 진행중</div>` : '';
    const tags = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    return `
      <div class="passage-card" onclick="startStudy('${p.id}')">
        ${badge}
        <h3>${p.title}</h3>
        <div class="meta">
          <span>✍ ${p.author || '익명'}</span>
          <span>${formatDate(p.createdAt)}</span>
        </div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn-delete" onclick="deletePassage('${p.id}')">삭제</button>
        </div>
      </div>`;
  }).join('');
}

function filterPassages() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allPassages.filter(p =>
    p.title.toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  );
  renderPassageList(filtered);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

async function deletePassage(id) {
  if (!confirm('이 지문을 삭제할까요?')) return;
  await apiFetch(`/api/passages/${id}`, { method: 'DELETE' });
  showToast('삭제되었어요');
  loadPassages();
}

// ══════════════════════════════════════
//  업로드
// ══════════════════════════════════════
function previewSentences() {
  const content = document.getElementById('upContent').value.trim();
  if (!content) return;
  const sents = parseSentences(content);
  const area = document.getElementById('previewArea');
  area.style.display = 'block';
  area.innerHTML = sents.map((s, i) => `
    <div class="preview-sentence">
      <span class="num">${i + 1}</span>
      <span>${s}</span>
    </div>`).join('');
}

async function uploadPassage() {
  const title = document.getElementById('upTitle').value.trim();
  const content = document.getElementById('upContent').value.trim();
  const author = document.getElementById('upAuthor').value.trim();
  const tagsRaw = document.getElementById('upTags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (!title || !content) { showToast('제목과 지문은 필수예요!'); return; }

  try {
    await apiFetch('/api/passages', {
      method: 'POST',
      body: JSON.stringify({ title, content, author, tags }),
    });
    showToast('지문이 공유되었어요!');
    document.getElementById('upTitle').value = '';
    document.getElementById('upContent').value = '';
    document.getElementById('upAuthor').value = '';
    document.getElementById('upTags').value = '';
    document.getElementById('previewArea').style.display = 'none';
    await loadPassages();
    showPage('page-home');
  } catch {
    showToast('저장 실패. 다시 시도해보세요.');
  }
}

// ══════════════════════════════════════
//  학습 시작
// ══════════════════════════════════════
function startStudy(id) {
  currentPassage = allPassages.find(p => p.id === id);
  if (!currentPassage) return;
  sentences = parseSentences(currentPassage.content);
  document.getElementById('studyTitle').textContent = currentPassage.title;
  typeStats = { correct: 0, wrong: 0 };
  recallStats = { ok: 0, no: 0 };
  readClicked = new Set();

  buildStep0();
  buildStep2();
  buildStep3();
  buildStep4();

  // 탭 초기화
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active', 'done'));
  document.querySelector('.step-tab[data-step="0"]').classList.add('active');
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step-0').classList.add('active');
  currentStep = 0;

  showPage('page-study');
}

// ══════════════════════════════════════
//  단계 이동
// ══════════════════════════════════════
function goStep(n) {
  if (n === 1) buildStep1(); // 순서 매번 새로 섞기
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
//  유틸
// ══════════════════════════════════════
function parseSentences(text) {
  const sents = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sents.map(s => s.trim()).filter(s => s.length > 4);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ══════════════════════════════════════
//  STEP 0: 정독
// ══════════════════════════════════════
function buildStep0() {
  readClicked = new Set();
  const area = document.getElementById('readArea');
  area.innerHTML = sentences.map((s, i) => `
    <div class="read-sentence" id="rs${i}" onclick="clickSentence(${i})">
      <span class="snum">${i + 1}</span>
      <span>${s}</span>
    </div>`).join('');
  document.getElementById('readProgress').style.width = '0%';
}

function clickSentence(i) {
  document.getElementById('rs' + i).classList.toggle('clicked');
  readClicked.add(i);
  const pct = (readClicked.size / sentences.length * 100);
  document.getElementById('readProgress').style.width = Math.min(pct, 100) + '%';
}

// ══════════════════════════════════════
//  STEP 1: 문장 순서
// ══════════════════════════════════════
function buildStep1() {
  orderItems = shuffle(sentences.map((s, i) => ({ s, origIdx: i })));
  renderOrderArea();
}

function renderOrderArea() {
  const area = document.getElementById('orderArea');
  area.innerHTML = orderItems.map((item, i) => `
    <div class="order-card" id="oc${i}" draggable="true"
      ondragstart="dragStart(${i})" ondragover="dragOver(event,${i})" ondrop="dragDrop(event,${i})">
      <span class="drag-handle">⠿</span>
      <span style="flex:1;line-height:1.6;font-size:.88rem">${item.s}</span>
      <div class="order-btns">
        <button onclick="moveCard(${i},-1)">▲</button>
        <button onclick="moveCard(${i},1)">▼</button>
      </div>
    </div>`).join('');
}

let dragSrcIdx = null;
function dragStart(i) { dragSrcIdx = i; }
function dragOver(e, i) { e.preventDefault(); }
function dragDrop(e, i) {
  e.preventDefault();
  if (dragSrcIdx === null || dragSrcIdx === i) return;
  const tmp = orderItems[dragSrcIdx];
  orderItems.splice(dragSrcIdx, 1);
  orderItems.splice(i, 0, tmp);
  dragSrcIdx = null;
  renderOrderArea();
}

function moveCard(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= orderItems.length) return;
  [orderItems[i], orderItems[j]] = [orderItems[j], orderItems[i]];
  renderOrderArea();
}

function checkOrder() {
  let allCorrect = true;
  orderItems.forEach((item, i) => {
    const card = document.getElementById('oc' + i);
    card.classList.remove('correct', 'wrong');
    if (item.origIdx === i) {
      card.classList.add('correct');
    } else {
      card.classList.add('wrong');
      allCorrect = false;
    }
  });
  if (allCorrect) showToast('완벽해요! 🎉');
  else showToast('틀린 문장이 있어요. 다시 해보세요!');
}

// ══════════════════════════════════════
//  STEP 2: 빈칸
// ══════════════════════════════════════
function buildStep2() {
  blankMap = {};
  sentences.forEach((s, i) => {
    const words = s.split(/\s+/);
    const n = Math.max(1, Math.round(words.length * 0.35));
    blankMap[i] = shuffle([...Array(words.length).keys()]).slice(0, n);
  });
  renderBlanks();
}

function renderBlanks() {
  const area = document.getElementById('blankArea');
  area.innerHTML = sentences.map((s, i) => {
    const words = s.split(/\s+/);
    const html = words.map((w, j) => {
      if (blankMap[i].includes(j)) {
        const clean = w.replace(/[.,!?;:]/g, '');
        const punct = w.slice(clean.length);
        return `<span class="blank-word" id="bw${i}_${j}" onclick="toggleBlank(${i},${j})">${clean}</span>${punct} `;
      }
      return w + ' ';
    }).join('');
    return `<div class="blank-sentence"><span class="blank-num">${i + 1}</span>${html}</div>`;
  }).join('');
}

function toggleBlank(si, wi) {
  document.getElementById(`bw${si}_${wi}`).classList.toggle('revealed');
}
function revealAllBlanks() { document.querySelectorAll('.blank-word').forEach(el => el.classList.add('revealed')); }
function hideAllBlanks() { document.querySelectorAll('.blank-word').forEach(el => el.classList.remove('revealed')); }
function reshuffleBlanks() { buildStep2(); }

// ══════════════════════════════════════
//  STEP 3: 타이핑
// ══════════════════════════════════════
function buildStep3() {
  typeStats = { correct: 0, wrong: 0 };
  updateTypeStats();
  const area = document.getElementById('typeArea');
  area.innerHTML = sentences.map((s, i) => {
    const firstWord = s.split(/\s+/)[0];
    return `
      <div class="type-item">
        <div class="type-hint">힌트: <span class="first">${firstWord}</span> ...</div>
        <input class="type-input" id="ti${i}" placeholder="문장 전체를 타이핑하세요..."
          onkeydown="if(event.key==='Enter') checkType(${i})" />
        <div class="type-feedback" id="tf${i}" style="display:none"></div>
      </div>`;
  }).join('');
}

function checkType(i) {
  const input = document.getElementById('ti' + i);
  const fb = document.getElementById('tf' + i);
  const userVal = input.value.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  const correct = sentences[i].trim().toLowerCase().replace(/[.,!?;:]/g, '');

  fb.style.display = 'block';
  if (userVal === correct) {
    fb.className = 'type-feedback correct';
    fb.textContent = '✓ 정답!';
    typeStats.correct++;
    input.disabled = true;
  } else {
    fb.className = 'type-feedback wrong';
    // 글자별 diff
    const diff = correct.split('').map((c, j) => {
      if (userVal[j] === c) return `<span class="char-ok">${c}</span>`;
      return `<span class="char-err">${c}</span>`;
    }).join('');
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
//  STEP 4: 암송
// ══════════════════════════════════════
function buildStep4() {
  recallStats = { ok: 0, no: 0 };
  updateRecallStats();
  const area = document.getElementById('recallArea');
  area.innerHTML = sentences.map((s, i) => `
    <div class="recall-item">
      <div class="recall-header" onclick="toggleRecall(${i})">
        <span>문장 ${i + 1}</span>
        <span style="font-size:.75rem">클릭해서 보기 ▾</span>
      </div>
      <div class="recall-body" id="rb${i}">
        <p>${s}</p>
        <div class="recall-btns">
          <button class="btn-knew" onclick="markRecall(${i}, true)">✓ 외웠어요</button>
          <button class="btn-unknown" onclick="markRecall(${i}, false)">✗ 몰랐어요</button>
        </div>
      </div>
    </div>`).join('');
}

function toggleRecall(i) {
  document.getElementById('rb' + i).classList.toggle('open');
}

function markRecall(i, knew) {
  if (knew) recallStats.ok++;
  else { recallStats.no++; addWrongSentence(i); }
  updateRecallStats();
  const body = document.getElementById('rb' + i);
  body.querySelector('.recall-btns').innerHTML =
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
  saveProgress(currentPassage.id, { currentStep: 4, done: true });
  const msg = pct >= 80 ? `🎉 ${pct}% 암기! 거의 다 외웠어요!` : `${pct}% 암기했어요. 복습해봐요!`;
  if (confirm(msg + '\n\n틀린 문장만 복습할까요?')) {
    showReview();
  } else {
    showPage('page-home');
  }
}

// ══════════════════════════════════════
//  복습 페이지
// ══════════════════════════════════════
function showReview() {
  const wrong = getWrongSentences(currentPassage.id);
  const area = document.getElementById('reviewArea');
  if (!wrong.length) {
    area.innerHTML = '<div class="empty-state">틀린 문장이 없어요! 완벽해요 🎉</div>';
    showPage('page-review');
    return;
  }
  area.innerHTML = wrong.map((idx) => {
    const s = sentences[idx];
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
  const userVal = input.value.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  const correct = sentences[i].trim().toLowerCase().replace(/[.,!?;:]/g, '');
  fb.style.display = 'block';
  if (userVal === correct) {
    fb.className = 'type-feedback correct';
    fb.textContent = '✓ 정답!';
    input.disabled = true;
  } else {
    fb.className = 'type-feedback wrong';
    fb.innerHTML = `✗ 정답: ${correct}`;
  }
}

// ══════════════════════════════════════
//  localStorage - 학습 기록
// ══════════════════════════════════════
function getProgress(passageId) {
  const raw = localStorage.getItem('progress_' + passageId);
  return raw ? JSON.parse(raw) : null;
}

function saveProgress(passageId, data) {
  localStorage.setItem('progress_' + passageId, JSON.stringify(data));
}

function getWrongSentences(passageId) {
  const raw = localStorage.getItem('wrong_' + passageId);
  return raw ? JSON.parse(raw) : [];
}

function addWrongSentence(idx) {
  if (!currentPassage) return;
  const key = 'wrong_' + currentPassage.id;
  const arr = getWrongSentences(currentPassage.id);
  if (!arr.includes(idx)) arr.push(idx);
  localStorage.setItem(key, JSON.stringify(arr));
}

// ══════════════════════════════════════
//  초기 로드
// ══════════════════════════════════════
loadPassages();

