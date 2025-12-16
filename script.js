// Examorio quiz engine

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxPgnfeiHKtJZ2x_y3ZEopgx1rzOrh1ksq0rmra9BIFBk_aBILohngFViARGkZuQwWW7w/exec';   
const HANDWRITE_API = 'https://script.google.com/macros/s/AKfycbxSoLeN2iSaQkNr-DCgA_C3u_b4KuudIxyN-laJdPWKnZiUIa7VWc4AiAIT_28G_v7U0g/exec';
// endpoint για ερωτήσεις
const ANSWERS_URL = 'https://script.google.com/macros/s/AKfycbx2cZydB4HWruvp9gW4Nu5tCgipjDcSbCJ5sgxpeLJulLcKxicuwb--xDd8pVGtEw5Q3A/exec'; // endpoint για αποθήκευση απαντήσεων

const EXTRACTS = {
  A: 'images/extractA.png',
  B: 'images/extractB.png'
};

let questions = [];
let currentIndex = 0;
let hasAnsweredCurrent = false;
let currentStudent = null;
let lastAttemptSnapshot = null;

const loadingEl = document.getElementById('loading');
const loadingOverlayEl = document.getElementById('loadingOverlay');
const loadingFillEl = document.querySelector('#loadingOverlay .loading-bar-fill');
let loadingProgress = 0;
let loadingProgressTimer = null;
const cardEl = document.getElementById('questionCard');
const questionNumberEl = document.getElementById('questionNumber');
const questionTextEl = document.getElementById('questionText');
const extractHolderEl = document.getElementById('extractHolder');
const answersEl = document.getElementById('answers');
const feedbackEl = document.getElementById('feedback');

const prevBtn = document.getElementById('prevQuestion');
const timerEl = document.getElementById('timerDisplay');
let timerSeconds = 60 * 60;
let timerIntervalId = null;
let timerStarted = false;

const nextBtn = document.getElementById('nextQuestion');
const finishBtn = document.getElementById('finishButton');


// report elements
const reportOverlay = document.getElementById('reportOverlay');
const reportBadgeEl = document.getElementById('reportBadge');
const reportStudentEl = document.getElementById('reportStudent');
const reportTotalEl = document.getElementById('reportTotal');
const reportAnsweredEl = document.getElementById('reportAnswered');
const reportCorrectEl = document.getElementById('reportCorrect');
const reportWrongEl = document.getElementById('reportWrong');
const reportSkippedEl = document.getElementById('reportSkipped');
const reportAccuracyEl = document.getElementById('reportAccuracy');
const reportTimeEl = document.getElementById('reportTime');
const reportRestartBtn = document.getElementById('reportRestart');
const reportExportPdfBtn = document.getElementById('reportExportPdf');

// login elements
const loginOverlay = document.getElementById('loginOverlay');
const loginButton = document.getElementById('loginButton');
const studentNameInput = document.getElementById('studentName');
const studentCodeInput = document.getElementById('studentCode');
const studentPhoneInput = document.getElementById('studentPhone');

// graph modal
const graphImg = document.getElementById('progressGraph');
const mediaWrap = document.querySelector('.media-wrap');
const graphModalImg = document.getElementById('graphModalImg');
const graphModal = document.getElementById('graphModal');
const graphCloseBtn = document.querySelector('.graph-close');
const graphBackdrop = graphModal.querySelector('.modal-backdrop');

// extract modal
const extractModal = document.getElementById('extractModal');
const extractModalImg = document.getElementById('extractModalImg');
const extractCloseBtn = document.querySelector('.extract-close');
const extractBackdrop = extractModal.querySelector('.modal-backdrop');

function openGraphModal() {
  if (graphModalImg && graphImg && graphImg.src) {
    graphModalImg.src = graphImg.src;
  }
  graphModal.classList.remove('hidden');
  graphModal.setAttribute('aria-hidden', 'false');
}

function closeGraphModal() {
  graphModal.classList.add('hidden');
  graphModal.setAttribute('aria-hidden', 'true');
}

graphImg.addEventListener('click', () => {
  if (!graphImg.src) return;
  openGraphModal();
});

// ===== Handwritten (QR) helpers =====
function openQrModal() {
  const m = document.getElementById('qrModal');
  if (!m) return;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
}

function closeQrModal() {
  const m = document.getElementById('qrModal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('qr-close')) closeQrModal();
  if (e.target && e.target.closest && e.target.closest('#qrModal .modal-backdrop')) closeQrModal();
});

async function hwCreateCapture({ student, examId, questionId }) {
  const url = new URL(HANDWRITE_API);
  url.searchParams.set('action', 'createCapture');
  url.searchParams.set('studentName', student?.name || '');
  url.searchParams.set('studentCode', student?.code || '');
  url.searchParams.set('studentPhone', student?.phone || '');
  url.searchParams.set('examId', examId || 'default');
  url.searchParams.set('questionId', questionId || '');
  const res = await fetch(url.toString());
  return await res.json();
}

async function hwGetStatus(cid) {
  const url = new URL(HANDWRITE_API);
  url.searchParams.set('action', 'getCaptureStatus');
  url.searchParams.set('cid', cid);
  const res = await fetch(url.toString());
  return await res.json();
}

function hwStartPolling(cid, onUploaded) {
  let tries = 0;
  const t = setInterval(async () => {
    tries++;
    try {
      const st = await hwGetStatus(cid);
      if (st && st.ok && st.status === 'uploaded' && st.fileUrl) {
        clearInterval(t);
        onUploaded(st);
      }
    } catch (_) {}

    if (tries > 90) clearInterval(t);
  }, 2000);

  return () => clearInterval(t);
}
graphCloseBtn.addEventListener('click', closeGraphModal);
graphBackdrop.addEventListener('click', closeGraphModal);

function openExtractModal(extractKey) {
  const url = EXTRACTS[extractKey];
  if (!url) return;
  extractModalImg.src = url;
  extractModal.classList.remove('hidden');
  extractModal.setAttribute('aria-hidden', 'false');
}

function closeExtractModal() {
  extractModal.classList.add('hidden');
  extractModal.setAttribute('aria-hidden', 'true');
}

extractCloseBtn.addEventListener('click', closeExtractModal);
extractBackdrop.addEventListener('click', closeExtractModal);

// login helpers

function loadStudentFromStorage() {
  try {
    const raw = localStorage.getItem('examorio_student');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveStudentToStorage(student) {
  try {
    localStorage.setItem('examorio_student', JSON.stringify(student));
  } catch (_) {}
}

function finishLogin(student) {
  currentStudent = student;
  saveStudentToStorage(student);
  loginOverlay.classList.add('hidden');
  loadQuestions();
}

loginButton.addEventListener('click', () => {
  const name = studentNameInput.value.trim();
  const code = studentCodeInput.value.trim();
  const phone = studentPhoneInput.value.trim();

  if (!name || !code) {
    alert('Enter your name and code');
    return;
  }

  const student = { name, code, phone };
  finishLogin(student);
});

function formatTime(total){
  const m = Math.floor(total/60);
  const s = total%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function startTimer(){
  if(!timerEl) return;
  if (timerStarted) return;
  timerStarted = true;
  timerEl.textContent = formatTime(timerSeconds);
  timerIntervalId = setInterval(()=>{
    if(timerSeconds<=0) return;
    timerSeconds -= 1;
    timerEl.textContent = formatTime(timerSeconds);
  },1000);
}

function showLoadingOverlay(){
  if (!loadingOverlayEl) return;
  loadingOverlayEl.classList.remove('is-hidden');
  loadingOverlayEl.setAttribute('aria-hidden', 'false');

  // one-way progress fill (no looping)
  if (loadingFillEl) loadingFillEl.style.width = '0%';
  loadingProgress = 0;
  if (loadingProgressTimer) {
    clearInterval(loadingProgressTimer);
    loadingProgressTimer = null;
  }
  loadingProgressTimer = setInterval(() => {
    // ease towards 92% while we wait for real completion
    if (loadingProgress >= 92) return;
    const remaining = 92 - loadingProgress;
    loadingProgress += Math.max(0.6, remaining * 0.06);
    if (loadingProgress > 92) loadingProgress = 92;
    if (loadingFillEl) loadingFillEl.style.width = `${loadingProgress.toFixed(1)}%`;
  }, 120);
}

function hideLoadingOverlay(){
  if (!loadingOverlayEl) return;
  if (loadingProgressTimer) {
    clearInterval(loadingProgressTimer);
    loadingProgressTimer = null;
  }
  // snap to 100 then fade out
  if (loadingFillEl) loadingFillEl.style.width = '100%';
  setTimeout(() => {
    loadingOverlayEl.classList.add('is-hidden');
    loadingOverlayEl.setAttribute('aria-hidden', 'true');
  }, 180);
}

function revealQuestionCard(){
  if (!cardEl) return;
  cardEl.classList.remove('hidden');
  // allow DOM paint then animate in
  requestAnimationFrame(() => {
    cardEl.classList.add('show');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const saved = loadStudentFromStorage();
  if (saved) {
    finishLogin(saved);
  }
});

// nav helpers

function updateNavButtons() {
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
}

function goToNextQuestion() {
  if (currentIndex < questions.length - 1) {
    currentIndex += 1;
    renderQuestion();
  }
}

function goToPrevQuestion() {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderQuestion();
  }
}

nextBtn.addEventListener('click', goToNextQuestion);
prevBtn.addEventListener('click', goToPrevQuestion);

// keyboard arrows
document.addEventListener('keydown', (event) => {
  const el = document.activeElement;
  const typing =
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.isContentEditable);

  // allow arrows to work inside text inputs
  if (typing) return;

  if (event.key === 'ArrowRight') {
    goToNextQuestion();
  } else if (event.key === 'ArrowLeft') {
    goToPrevQuestion();
  }
});

// send answers to backend

async function sendAnswerToServer(payload) {
  if (!ANSWERS_URL || !currentStudent) return;

  const fullPayload = {
    ...payload,
    student: currentStudent
  };

  try {
    await fetch(ANSWERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload)
    });
  } catch (err) {
    console.error('Error sending answer', err);
  }
}


function studentKeyPrefix(){
  const code = (currentStudent && currentStudent.code) ? currentStudent.code : 'anon';
  return `examorio_${code}_`;
}

function loadLocalAnswer(questionId){
  try{
    const raw = localStorage.getItem(studentKeyPrefix() + 'ans_' + questionId);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(_){ return null; }
}

function saveLocalAnswer(questionId, data){
  try{
    localStorage.setItem(studentKeyPrefix() + 'ans_' + questionId, JSON.stringify(data));
  }catch(_){}
}

function attemptsKey(){
  const code = (currentStudent && currentStudent.code) ? currentStudent.code : 'anon';
  return `examorio_${code}_attempts`;
}

function loadAttempts(){
  try{
    const raw = localStorage.getItem(attemptsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveAttempts(list){
  try{
    localStorage.setItem(attemptsKey(), JSON.stringify(Array.isArray(list) ? list : []));
  } catch (_) {}
}

function letterFromIndex(i){
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (typeof i === 'number' && i >= 0) ? (letters[i] || String(i + 1)) : '';
}

function buildAttemptDetails(){
  const now = new Date();
  const attemptId = `${now.toISOString()}_${Math.random().toString(16).slice(2)}`;
  const summary = buildReport();

  const detailRows = questions.map((q, idx) => {
    const saved = loadLocalAnswer(q.id || '');
    if (!saved) {
      return {
        n: idx + 1,
        id: q.id || `q${idx + 1}`,
        topic: q.topic || '',
        type: q.type || 'mcq',
        question: q.question || '',
        answers: Array.isArray(q.answers) ? q.answers : [],
        selectedIndex: null,
        selectedLetter: '',
        selectedText: '',
        textAnswer: ''
      };
    }

    if (saved.type === 'mcq') {
      const si = (typeof saved.selectedIndex === 'number') ? saved.selectedIndex : null;
      return {
        n: idx + 1,
        id: q.id || `q${idx + 1}`,
        topic: q.topic || '',
        type: 'mcq',
        question: q.question || '',
        answers: Array.isArray(q.answers) ? q.answers : [],
        selectedIndex: si,
        selectedLetter: si === null ? '' : letterFromIndex(si),
        selectedText: (typeof saved.selectedText === 'string') ? saved.selectedText : '',
        textAnswer: ''
      };
    }

    // text
    return {
      n: idx + 1,
      id: q.id || `q${idx + 1}`,
      topic: q.topic || '',
      type: 'text',
      question: q.question || '',
      answers: [],
      selectedIndex: null,
      selectedLetter: '',
      selectedText: '',
      textAnswer: (typeof saved.answerText === 'string') ? saved.answerText : ''
    };
  });

  return {
    attemptId,
    createdAt: now.toISOString(),
    student: currentStudent,
    summary,
    details: detailRows
  };
}

function persistAttempt(){
  if (!currentStudent) return;
  const attempt = buildAttemptDetails();
  const list = loadAttempts();
  list.push(attempt);
  // keep last 20 attempts per student to avoid bloating localStorage
  const trimmed = list.slice(-20);
  saveAttempts(trimmed);
  return attempt;
}

function escapeHtml(str){
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function exportAttemptToPdf(attempt){
  if (!attempt) attempt = buildAttemptDetails();

  const studentName = attempt.student && attempt.student.name ? attempt.student.name : '';
  const studentCode = attempt.student && attempt.student.code ? attempt.student.code : '';
  const studentPhone = attempt.student && attempt.student.phone ? attempt.student.phone : '';
  const when = attempt.createdAt ? new Date(attempt.createdAt) : new Date();
  const dateText = `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const s = attempt.summary;

  const rowsHtml = attempt.details.map((d) => {
    const header = `
      <div class="q-head">
        <div class="q-num">Q${d.n}</div>
        <div class="q-topic">${escapeHtml(d.topic || '')}</div>
      </div>
      <div class="q-text">${escapeHtml(d.question || '')}</div>
    `;

    if (d.type === 'text') {
      const ans = (d.textAnswer || '').trim();
      return `
        <section class="q-block">
          ${header}
          <div class="ans">
            <div class="ans-label">Student answer</div>
            <div class="ans-text">${ans ? escapeHtml(ans).replaceAll('\n','<br>') : '<span class="muted">No answer</span>'}</div>
          </div>
        </section>
      `;
    }

    const selected = (typeof d.selectedIndex === 'number') ? d.selectedIndex : null;
    const options = (d.answers || []).slice(0, 6).map((opt, i) => {
      const letter = letterFromIndex(i);
      const isSel = selected === i;
      return `
        <div class="opt ${isSel ? 'sel' : ''}">
          <div class="opt-letter">${letter}</div>
          <div class="opt-text">${escapeHtml(opt)}</div>
          <div class="opt-mark">${isSel ? '✓' : ''}</div>
        </div>
      `;
    }).join('');

    const chosenLine = selected === null
      ? '<span class="muted">No answer</span>'
      : `${escapeHtml(d.selectedLetter)} (${escapeHtml(d.selectedText || '')})`;

    return `
      <section class="q-block">
        ${header}
        <div class="chosen">Chosen: <strong>${chosenLine}</strong></div>
        <div class="opts">${options}</div>
      </section>
    `;
  }).join('');

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ARUNNER Report</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;font-family:Arial,system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1220;color:#eaf2ff}
      .page{max-width:980px;margin:0 auto;padding:22px 18px}
      .card{border:2px solid #f5c84b;border-radius:18px;background:rgba(7,20,45,.55);padding:16px 16px 14px}
      .title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .title h1{margin:0;font-size:20px;color:#f5c84b;letter-spacing:.02em}
      .meta{color:#c7d2fe;font-size:12px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
      .stat{border:1px solid rgba(96,165,250,.45);border-radius:14px;padding:10px 12px;background:rgba(2,10,24,.35)}
      .stat .k{font-size:11px;color:#c7d2fe}
      .stat .v{font-size:18px;font-weight:900;margin-top:4px}
      .good{color:#22c55e}
      .bad{color:#fb7185}
      .q-block{margin-top:14px;border:1px solid rgba(96,165,250,.35);border-radius:14px;padding:12px;background:rgba(2,10,24,.25);page-break-inside:avoid}
      .q-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
      .q-num{font-weight:900;color:#f5c84b}
      .q-topic{color:#c7d2fe;font-size:12px;text-align:right}
      .q-text{margin-top:6px;font-size:14px;font-weight:700}
      .chosen{margin-top:8px;font-size:13px;color:#eaf2ff}
      .opts{margin-top:10px;display:grid;gap:8px}
      .opt{display:grid;grid-template-columns:30px 1fr 20px;gap:10px;align-items:flex-start;border:1px solid rgba(96,165,250,.35);border-radius:12px;padding:8px 10px;background:rgba(0,0,0,.12)}
      .opt.sel{border-color:#f5c84b}
      .opt-letter{font-weight:900;color:#f5c84b}
      .opt-text{font-size:13px;line-height:1.35}
      .opt-mark{font-weight:900;color:#22c55e;text-align:right}
      .ans{margin-top:10px;border:1px dashed rgba(96,165,250,.45);border-radius:12px;padding:10px 10px;background:rgba(0,0,0,.10)}
      .ans-label{font-size:11px;color:#c7d2fe}
      .ans-text{margin-top:6px;font-size:13px;line-height:1.4;white-space:normal}
      .muted{color:#94a3b8}
      @media print{
        body{background:#fff;color:#111}
        .card{border-color:#111;background:#fff}
        .stat{background:#fff}
        .q-block{background:#fff}
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="card">
        <div class="title">
          <h1>ARUNNER Full Report</h1>
          <div class="meta">${escapeHtml(dateText)}</div>
        </div>
        <div class="meta">
          Student: <strong>${escapeHtml(studentName || '')}</strong>
          ${studentCode ? ` • Code: <strong>${escapeHtml(studentCode)}</strong>` : ''}
          ${studentPhone ? ` • Phone: <strong>${escapeHtml(studentPhone)}</strong>` : ''}
        </div>

        <div class="grid">
          <div class="stat"><div class="k">Total</div><div class="v">${s.total}</div></div>
          <div class="stat"><div class="k">Answered</div><div class="v">${s.answered}</div></div>
          <div class="stat"><div class="k">Skipped</div><div class="v">${s.skipped}</div></div>
          <div class="stat"><div class="k">Correct</div><div class="v good">${s.correct}</div></div>
          <div class="stat"><div class="k">Wrong</div><div class="v bad">${s.wrong}</div></div>
          <div class="stat"><div class="k">Time used</div><div class="v">${escapeHtml(s.timeText)}</div></div>
        </div>

        ${rowsHtml}
      </div>
    </div>
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 120);
      });
    </script>
  </body>
  </html>
  `;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup blocked. Allow popups to export PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}



// rendering

function renderQuestion() {
  if (!questions.length) return;

  const q = questions[currentIndex];

  questionNumberEl.textContent = `Q${currentIndex + 1} / ${questions.length}`;
    questionTextEl.textContent = q.question || '';

  // image per question
  const imgUrl = (q.imageUrl || '').trim();
  if (mediaWrap && graphImg) {
    if (imgUrl) {
      graphImg.src = imgUrl;
      mediaWrap.classList.remove('hidden');
    } else {
      graphImg.src = '';
      mediaWrap.classList.add('hidden');
    }
  }

  extractHolderEl.innerHTML = '';
  answersEl.innerHTML = '';
  feedbackEl.textContent = '';
  hasAnsweredCurrent = false;

  renderExtractButton(q);

  if (q.type === 'text') {
    renderTextQuestion(q);
  } else {
    renderMcqQuestion(q);
  }

  updateNavButtons();
}

function renderExtractButton(q) {
  if (!q.extraData || !q.extraData.extract) return;

  const key = q.extraData.extract;
  if (!EXTRACTS[key]) return;

  const wrap = document.createElement('div');
  wrap.className = 'extract-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'extract-button';
  btn.textContent = `View Extract ${key}`;

  btn.addEventListener('click', () => openExtractModal(key));

  wrap.appendChild(btn);
  extractHolderEl.appendChild(wrap);
}

function renderMcqQuestion(q) {
  const saved = loadLocalAnswer(q.id || '');
  const savedIndex = saved && typeof saved.selectedIndex === 'number' ? saved.selectedIndex : null;

  q.answers.forEach((answerText, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-option';
    btn.textContent = answerText;

    // restore selection
    if (savedIndex !== null && index === savedIndex) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => {
      // allow changing selection anytime
      const correctIndex = q.correctIndex;
      const isCorrect = index === correctIndex;

      // UI: single selected state only
      const all = answersEl.querySelectorAll('.answer-option');
      all.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      feedbackEl.textContent = '';

      // persist locally
      saveLocalAnswer(q.id || '', {
        type: 'mcq',
        selectedIndex: index,
        selectedText: answerText,
        isCorrect,
        timestamp: new Date().toISOString()
      });

      // send to server (used later for report)
      const payload = {
        type: 'mcq',
        questionId: q.id || '',
        topic: q.topic || '',
        question: q.question || '',
        selectedIndex: index,
        selectedText: answerText,
        correctIndex,
        correctText: q.answers[correctIndex],
        isCorrect,
        explanation: q.explanation || '',
        timestamp: new Date().toISOString()
      };

      sendAnswerToServer(payload);
    });

    answersEl.appendChild(btn);
  });
}

function renderTextQuestion(q) {
  const textarea = document.createElement('textarea');
  const saved = loadLocalAnswer(q.id || '');
  if (saved && saved.answerText) {
    textarea.value = saved.answerText;
  }

  textarea.className = 'text-answer';
  textarea.rows = 5;
  textarea.placeholder = 'Type your answer here';

  answersEl.appendChild(textarea);


// handwritten upload button (QR -> phone -> upload -> show image)
const handBtn = document.createElement('button');
handBtn.type = 'button';
handBtn.className = 'upload-hand-btn';
handBtn.textContent = 'Upload handwritten answer';
answersEl.appendChild(handBtn);

const previewWrap = document.createElement('div');
answersEl.appendChild(previewWrap);

// show stored handwritten image when navigating back
const saved2 = loadLocalAnswer(q.id || '');
if (saved2 && saved2.handwrittenUrl) {
  const img0 = document.createElement('img');
  img0.src = saved2.handwrittenUrl;
  img0.alt = 'Handwritten answer';
  img0.className = 'handwritten-preview';
  previewWrap.appendChild(img0);
  handBtn.textContent = 'Handwritten uploaded ✅';
}

handBtn.addEventListener('click', async () => {
  if (!currentStudent) return;

  handBtn.disabled = true;
  handBtn.textContent = 'Preparing QR...';

  const created = await hwCreateCapture({
    student: currentStudent,
    examId: 'exam1',
    questionId: q.id || ''
  });

  if (!created || !created.ok || !created.cid || !created.captureUrl) {
    handBtn.disabled = false;
    handBtn.textContent = 'Upload handwritten answer';
    return;
  }

  const cid = created.cid;
  const captureUrl = location.origin + '/' + created.captureUrl;

  openQrModal();
  const hint = document.getElementById('qrHint');
  if (hint) hint.textContent = 'Scan with phone and upload a photo. It will appear here automatically.';
  const imgEl = document.getElementById('qrImg');
  const hint2 = document.getElementById('qrHint');

  const qcUrl = 'https://quickchart.io/qr';
  const googleUrl = 'https://chart.googleapis.com/chart';

  const buildQuickChart = (text) =>
    qcUrl + '?size=420&text=' + encodeURIComponent(text);

  const buildGoogleChart = (text) =>
    googleUrl + '?cht=qr&chs=420x420&chld=M|1&chl=' + encodeURIComponent(text);

  if (imgEl) {
    imgEl.onload = null;
    imgEl.onerror = null;
    imgEl.src = buildQuickChart(captureUrl);
    imgEl.onerror = () => {
      imgEl.src = buildGoogleChart(captureUrl);
    };
  }

  if (hint2) hint2.textContent = 'Tip: move your phone slightly back if scan fails. Or open this link on your phone: ' + captureUrl;

  handBtn.textContent = 'Waiting for upload...';

  hwStartPolling(cid, (st) => {
    previewWrap.innerHTML = '';
    const img = document.createElement('img');
    img.src = st.fileUrl;
    img.alt = 'Handwritten answer';
    img.className = 'handwritten-preview';
    previewWrap.appendChild(img);

    saveLocalAnswer(q.id || '', {
      ...(loadLocalAnswer(q.id || '') || {}),
      handwrittenCid: cid,
      handwrittenUrl: st.fileUrl,
      timestamp: new Date().toISOString()
    });

    closeQrModal();
    handBtn.disabled = false;
    handBtn.textContent = 'Handwritten uploaded ✅';
  });
});


  // auto-save (local + server) with debounce
  let saveTimeout = null;
  let lastSent = '';

  textarea.addEventListener('input', () => {
    const textNow = textarea.value;
    saveLocalAnswer(q.id || '', {
      type: 'text',
      answerText: textNow,
      savedToServer: false,
      timestamp: new Date().toISOString()
    });

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const text = (textarea.value || '').trim();
      if (!text) return;
      if (text === lastSent) return;
      lastSent = text;

      const payload = {
        type: 'text',
        questionId: q.id || '',
        topic: q.topic || '',
        question: q.question || '',
        answerText: text,
        modelAnswer: q.explanation || '',
        timestamp: new Date().toISOString()
      };

      sendAnswerToServer(payload);
    }, 900);
  });
}

// data

function parseExtraData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function getFallbackQuestions() {
  return [
    {
      id: 'q1',
      type: 'mcq',
      topic: 'Demand and supply',
      question: 'What happens to equilibrium price if demand increases and supply stays the same',
      answers: [
        'Price and quantity both increase',
        'Price falls and quantity rises',
        'Price rises and quantity falls',
        'Price and quantity both fall'
      ],
      correctIndex: 0,
      explanation: 'When demand shifts right and supply is unchanged both equilibrium price and quantity rise.',
      extraData: {},
      imageUrl: ''
    },
    {
      id: 'q2',
      type: 'text',
      topic: 'Elasticity',
      question: 'Explain why goods with many close substitutes tend to have price elastic demand',
      answers: [],
      correctIndex: 0,
      explanation: 'When there are many substitutes consumers can easily switch when price changes so the percentage change in quantity demanded is larger than the percentage change in price.',
      extraData: { extract: 'A' }
    }
  ];
}

async function loadQuestions() {
  try {
    showLoadingOverlay();
    loadingEl.classList.remove('hidden');
    loadingEl.setAttribute('aria-hidden', 'false');
    cardEl.classList.add('hidden');
    cardEl.classList.remove('show');

    if (SHEET_URL) {
      const response = await fetch(SHEET_URL);
      const data = await response.json();

      const rows = Array.isArray(data) ? data : (data.items || []);

      questions = (rows || []).map((row, index) => {
        const rawType = (row.type || 'mcq').toString().toLowerCase();
        const qType = rawType === 'text' ? 'text' : 'mcq';

        return {
          id: row.id || `q${index + 1}`,
          type: qType,
          topic: row.topic || '',
          question: row.question || '',
          answers: [row.answerA, row.answerB, row.answerC, row.answerD].filter(Boolean),
          correctIndex: Number(row.correctIndex ?? 0),
          explanation: row.explanation || '',
          extraData: parseExtraData(row.extraData),
          imageUrl: row.imageUrl || ''
        };
      });
    } else {
      questions = getFallbackQuestions();
    }

    loadingEl.classList.add('hidden');
    loadingEl.setAttribute('aria-hidden', 'true');

    currentIndex = 0;
    renderQuestion();

    // start time only after questions are loaded and first render is ready
    startTimer();

    // hide overlay then fade in
    hideLoadingOverlay();
    revealQuestionCard();
  } catch (err) {
    console.error(err);
    loadingEl.textContent = 'Error loading questions.';
  }
}


if (reportRestartBtn) {
  reportRestartBtn.addEventListener('click', () => {
    // back to login
    if (reportOverlay) {
      reportOverlay.classList.remove('show');
      reportOverlay.classList.add('hidden');
  document.body.classList.remove('no-scroll');
      reportOverlay.setAttribute('aria-hidden', 'true');
    }
    loginOverlay.classList.remove('hidden');
  });
}

if (reportExportPdfBtn) {
  reportExportPdfBtn.addEventListener('click', () => {
    exportAttemptToPdf(lastAttemptSnapshot || null);
  });
}

function formatTimeMMSS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function buildReport() {
  const total = questions.length;

  let answered = 0;
  let correct = 0;

  questions.forEach(q => {
    const id = q.id || '';
    if (!id) return;

    const saved = loadLocalAnswer(id);
    if (!saved) return;

    // MCQ
    if (saved.type === 'mcq' && typeof saved.selectedIndex === 'number') {
      answered += 1;
      if (saved.isCorrect) correct += 1;
      return;
    }

    // Text
    if (saved.type === 'text' && typeof saved.answerText === 'string') {
      const txt = saved.answerText.trim();
      if (txt.length > 0) answered += 1;
    }
  });

  const wrong = Math.max(0, answered - correct);
  const skipped = Math.max(0, total - answered);
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const elapsed = (60 * 60) - timerSeconds;
  const timeText = formatTimeMMSS(elapsed);

  return { total, answered, correct, wrong, skipped, accuracy, timeText };
}

function showReport() {
  const r = buildReport();

  if (reportBadgeEl) reportBadgeEl.textContent = `${r.accuracy}%`;

  if (reportStudentEl) {
    const name = currentStudent && currentStudent.name ? currentStudent.name : '';
    const code = currentStudent && currentStudent.code ? currentStudent.code : '';
    reportStudentEl.textContent = name || code ? `${name}${name && code ? ' • ' : ''}${code}` : '';
  }

  if (reportTotalEl) reportTotalEl.textContent = String(r.total);
  if (reportAnsweredEl) reportAnsweredEl.textContent = String(r.answered);
  if (reportCorrectEl) reportCorrectEl.textContent = String(r.correct);
  if (reportWrongEl) reportWrongEl.textContent = String(r.wrong);
  if (reportSkippedEl) reportSkippedEl.textContent = String(r.skipped);
  if (reportAccuracyEl) reportAccuracyEl.textContent = `${r.accuracy}%`;
  if (reportTimeEl) reportTimeEl.textContent = r.timeText;

  if (reportOverlay) {
    reportOverlay.classList.remove('hidden');
    // next tick for transition
    requestAnimationFrame(() => {
      reportOverlay.classList.add('show');
      document.body.classList.add('no-scroll');
      reportOverlay.setAttribute('aria-hidden', 'false');
    });
  }
}

if (finishBtn) {
  finishBtn.addEventListener('click', () => {
    const frameInner = document.querySelector('.frame-inner');

    closeGraphModal();
    closeExtractModal();

    // completion animation then report
    if (frameInner) frameInner.classList.add('finish-anim');

    setTimeout(() => {
      if (frameInner) frameInner.classList.remove('finish-anim');
      // snapshot answers with date for this student
      lastAttemptSnapshot = persistAttempt() || buildAttemptDetails();
      showReport();
    }, 680);
  });
}
