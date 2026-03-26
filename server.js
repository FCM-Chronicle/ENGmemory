const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 환경변수 (Render 대시보드에서 설정) ──
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;   // 예: "username/repo-name"
const GITHUB_FILE = process.env.GITHUB_FILE || 'passages.json';

const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
const HEADERS = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
};

// GitHub에서 현재 JSON 읽기
async function readPassages() {
  const url = `${API_BASE}?t=${Date.now()}`;
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 404) return { passages: [], sha: null };
  const data = await res.json();
  if (!data.content) return { passages: [], sha: null };
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { passages: JSON.parse(content), sha: data.sha };
}

// GitHub에 JSON 덮어쓰기
async function writePassages(passages, sha) {
  const content = Buffer.from(JSON.stringify(passages, null, 2)).toString('base64');
  const body = {
    message: 'update passages',
    content,
    ...(sha && { sha }),
  };
  await fetch(API_BASE, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

// ── API ──

// 지문 전체 목록
app.get('/api/passages', async (req, res) => {
  try {
    const { passages } = await readPassages();
    res.json(passages);
  } catch (e) {
    res.status(500).json({ error: '불러오기 실패' });
  }
});

// 지문 하나
app.get('/api/passages/:id', async (req, res) => {
  try {
    const { passages } = await readPassages();
    const found = passages.find(p => p.id === req.params.id);
    if (!found) return res.status(404).json({ error: '없음' });
    res.json(found);
  } catch (e) {
    res.status(500).json({ error: '불러오기 실패' });
  }
});

// 지문 추가
app.post('/api/passages', async (req, res) => {
  try {
    const { title, content, author, tags, paragraphs, hasMeaning, hasTyping, hasRecall } = req.body;
    if (!title) return res.status(400).json({ error: '제목은 필수' });

    const { passages, sha } = await readPassages();
    const newPassage = {
    id: Date.now().toString(),
    title,
    content: content || '',
    paragraphs: paragraphs || [],
    author: author || '익명',
    tags: tags || [],
    hasMeaning: hasMeaning || false,   // ← 추가
    hasTyping: hasTyping !== false,     // ← 추가
    hasRecall: hasRecall !== false,     // ← 추가
    createdAt: new Date().toISOString(),
  };
    passages.push(newPassage);
    await writePassages(passages, sha);
    res.json(newPassage);
  } catch (e) {
    res.status(500).json({ error: '저장 실패' });
  }
});

// 지문 삭제
app.delete('/api/passages/:id', async (req, res) => {
  try {
    const { passages, sha } = await readPassages();
    const filtered = passages.filter(p => p.id !== req.params.id);
    await writePassages(filtered, sha);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '삭제 실패' });
  }
});

// 프론트 라우팅 (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행중 : ${PORT}`));
