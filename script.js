// Examorio quiz engine

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxPgnfeiHKtJZ2x_y3ZEopgx1rzOrh1ksq0rmra9BIFBk_aBILohngFViARGkZuQwWW7w/exec';
const ANSWERS_URL = 'https://script.google.com/macros/s/AKfycbx2cZydB4HWruvp9gW4Nu5tCgipjDcSbCJ5sgxpeLJulLcKxicuwb--xDd8pVGtEw5Q3A/exec';

const EXTRACTS = {
  A: 'images/extractA.png',
  B: 'images/extractB.png'
};

let questions = [];
let currentIndex = 0;
let selectedAnswers = [];
let currentStudent = null;
let timerId = null;
let timerSeconds = 90 * 60;

// elements
const loadingEl = document.getElementById('loading');
const loadBarInner = document.getElementById('loadBar');
const cardEl = document.getElementById('questionCard');
const questionNumberEl = document.getElementById('questionNumber');
const questionTextEl = document.getElementById('questionText');
const extractHolderEl = document.getElementById('extractHolder');
const answersEl = document.getElementById('answers');
const feedbackEl = document.getElementById('feedback');
const messageBanner = document.getElementById('messageBanner');

const prevBtn = document.getElementById('prevQuestion');
const nextBtn = document.getElementById('nextQuestion');
const finishBtn = document.getElementById('finishButton');
const timerEl = document.getElementById('timerDisplay');

// login
const loginOverlay = document.getElementById('loginOverlay');
let loginButton = document.getElementById('loginButton');
const studentNameInput = document.getElementById('studentName');
const studentCodeInput = document.getElementById('studentCode');
const studentPhoneInput = document.getElementById('studentPhone');

// ---------------- LOGIN ----------------

function loadStudentFromStorage() {
  try {
    const name = (localStorage.getItem('studentName') || '').trim();
    const code = (localStorage.getItem('studentCode') || '').trim();
    const phone = (localStorage.getItem('studentPhone') || '').trim();
    if (name && code) return { name, code, phone };
    return null;
  } catch {
    return null;
  }
}

function saveStudentToStorage(student) {
  localStorage.setItem('studentName', student.name);
  localStorage.setItem('studentCode', student.code);
  localStorage.setItem('studentPhone', student.phone || '');
}

function finishLogin(student) {
  currentStudent = student;
  saveStudentToStorage(student);

  if (loginOverlay) {
    loginOverlay.classList.add('hidden');
    loginOverlay.setAttribute('aria-hidden', 'true');
    loginOverlay.style.pointerEvents = 'none';
  }

  loadQuestions();
}

function handleLoginClick() {
  const name = (studentNameInput.value || '').trim();
  const code = (studentCodeInput.value || '').trim();
  const phone = (studentPhoneInput.value || '').trim();

  if (!name || !code) {
    alert('Enter student name and code');
    return;
  }

  finishLogin({ name, code, phone });
}

function attachLoginHandler() {
  if (!loginButton) return;
  const cleanBtn = loginButton.cloneNode(true);
  loginButton.replaceWith(cleanBtn);
  loginButton = cleanBtn;
  loginButton.addEventListener('click', handleLoginClick);
}

// ---------------- MESSAGE ----------------

let messageHideTimeout = null;
function showMessageBanner(text = 'Proceed to exam test', duration = 2000) {
  if (!messageBanner) return;
  messageBanner.textContent = text;
  messageBanner.classList.add('visible');
  clearTimeout(messageHideTimeout);
  messageHideTimeout = setTimeout(() => {
    messageBanner.classList.remove('visible');
  }, duration);
}

// ---------------- TIMER ----------------

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function startTimer() {
  if (timerId) return;
  timerEl.textContent = formatTime(timerSeconds);
  timerId = setInterval(() => {
    timerSeconds--;
    timerEl.textContent = formatTime(timerSeconds);
    if (timerSeconds <= 0) clearInterval(timerId);
  }, 1000);
}

// ---------------- QUESTIONS ----------------

function renderQuestion() {
  if (!questions.length) return;

  const q = questions[currentIndex];
  questionNumberEl.textContent = `Q${currentIndex + 1}/${questions.length}`;
  questionTextEl.textContent = q.question;
  answersEl.innerHTML = '';
  feedbackEl.textContent = '';
  extractHolderEl.innerHTML = '';

  if (q.type === 'mcq') renderMcqQuestion(q);
  else renderTextQuestion(q);

  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
}

function renderMcqQuestion(q) {
  const buttons = [];

  q.answers.forEach((ans, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-btn';
    btn.textContent = ans;

    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAnswers[currentIndex] = idx;
      feedbackEl.textContent = 'Answer saved';
    });

    buttons.push(btn);
    answersEl.appendChild(btn);
  });

  const saved = selectedAnswers[currentIndex];
  if (saved !== null && buttons[saved]) {
    buttons[saved].classList.add('selected');
  }
}

function renderTextQuestion(q) {
  const ta = document.createElement('textarea');
  ta.placeholder = 'Type your answer here';
  ta.rows = 5;
  answersEl.appendChild(ta);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save answer';
  saveBtn.type = 'button';
  answersEl.appendChild(saveBtn);

  saveBtn.addEventListener('click', () => {
    if (!ta.value.trim()) {
      alert('Add an answer first');
      return;
    }
    feedbackEl.textContent = 'Answer saved';
  });
}

// ---------------- LOAD ----------------

function startLoadingBar() {
  let p = 0;
  const id = setInterval(() => {
    p += 5;
    loadBarInner.style.width = `${p}%`;
    if (p >= 90) p = 30;
  }, 150);
  return id;
}

function stopLoadingBar(id) {
  clearInterval(id);
  loadBarInner.style.width = '100%';
  setTimeout(() => loadingEl.classList.add('hidden'), 300);
}

async function loadQuestions() {
  let loadId = null;
  try {
    loadingEl.classList.remove('hidden');
    loadId = startLoadingBar();

    const res = await fetch(SHEET_URL);
    const rows = await res.json();

    questions = rows.map((r, i) => ({
      id: r.id || `q${i + 1}`,
      type: r.type === 'text' ? 'text' : 'mcq',
      question: r.question,
      answers: [r.answerA, r.answerB, r.answerC, r.answerD].filter(Boolean)
    }));

    selectedAnswers = new Array(questions.length).fill(null);
    stopLoadingBar(loadId);
    renderQuestion();
    startTimer();
  } catch (e) {
    console.error(e);
    if (loadId) stopLoadingBar(loadId);
    alert('Problem loading questions');
  }
}

// ---------------- NAV ----------------

nextBtn.addEventListener('click', () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  }
});

prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
});

// ---------------- INIT ----------------

window.addEventListener('DOMContentLoaded', () => {
  attachLoginHandler();
  showMessageBanner();

  const saved = loadStudentFromStorage();
  if (saved) finishLogin(saved);
});