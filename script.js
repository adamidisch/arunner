// Examorio quiz engine

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxPgnfeiHKtJZ2x_y3ZEopgx1rzOrh1ksq0rmra9BIFBk_aBILohngFViARGkZuQwWW7w/exec';   // endpoint for questions
const ANSWERS_URL = 'https://script.google.com/macros/s/AKfycbx2cZydB4HWruvp9gW4Nu5tCgipjDcSbCJ5sgxpeLJulLcKxicuwb--xDd8pVGtEw5Q3A/exec'; // endpoint for saving answers

const EXTRACTS = {
  A: 'images/extractA.png',
  B: 'images/extractB.png'
};

let questions = [];
let currentIndex = 0;
let selectedAnswers = [];
let currentStudent = null;

let timerId = null;
let hasAnsweredCurrent = false;

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
const timerEl = document.getElementById('timerDisplay');
let timerSeconds = 90 * 60;

const nextBtn = document.getElementById('nextQuestion');
const finishBtn = document.getElementById('finishButton');

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
  if (loginOverlay) {
    loginOverlay.classList.add('hidden');
    loginOverlay.setAttribute('aria-hidden', 'true');
    loginOverlay.style.pointerEvents = 'none';
  }
  loadQuestions();
}

function formatTime(total){
  const m = Math.floor(total/60);
  const s = total%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function startTimer(){
  if(!timerEl) return;
  if(timerId) return;
  timerEl.textContent = formatTime(timerSeconds);
  timerId = setInterval(()=>{
    if(timerSeconds<=0) return;
    timerSeconds -= 1;
    timerEl.textContent = formatTime(timerSeconds);
  },1000);
}

function stopTimer(){
  if(!timerId) return;
  clearInterval(timerId);
  timerId = null;
}

let messageHideTimeout = null;

function showMessageBanner(message = 'Proceed to exam test', duration = 2000) {
  if (!messageBanner) return;

  messageBanner.textContent = message;
  messageBanner.classList.add('visible');

  if (messageHideTimeout) {
    clearTimeout(messageHideTimeout);
  }

  messageHideTimeout = setTimeout(() => {
    messageBanner.classList.remove('visible');
    messageHideTimeout = null;
  }, duration);
}

window.addEventListener('DOMContentLoaded', () => {
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      const name = (studentNameInput?.value || '').trim();
      const code = (studentCodeInput?.value || '').trim();
      const phone = (studentPhoneInput?.value || '').trim();

      if (!name || !code) {
        alert('Enter name and code');
        return;
      }

      const student = { name, code, phone };
      finishLogin(student);
    });
  }

  const saved = loadStudentFromStorage();
  if (saved) {
    finishLogin(saved);
  }

  showMessageBanner();
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
  const savedIndex = selectedAnswers[currentIndex];
      if (savedIndex !== null && buttons[savedIndex]) {
        buttons.forEach(b => b.classList.remove('selected'));
        buttons[savedIndex].classList.add('selected');
        hasAnsweredCurrent = true;
      } else {
        hasAnsweredCurrent = false;
      }
      feedbackEl.textContent = '';
    }
  }
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

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.justifyContent = 'space-between';
  controls.style.alignItems = 'center';
  controls.style.marginTop = '8px';
  controls.style.gap = '8px';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save answer';
  saveButton.className = 'nav-button';

  const modelButton = document.createElement('button');
  modelButton.type = 'button';
  modelButton.textContent = 'Model answer';
  modelButton.className = 'nav-button';

  controls.appendChild(saveButton);
  controls.appendChild(modelButton);

  answersEl.appendChild(textarea);
  answersEl.appendChild(controls);

  textarea.addEventListener('input', () => {
    saveLocalAnswer(q.id || '', {
      type: 'text',
      answerText: textarea.value,
      savedToServer: false,
      timestamp: new Date().toISOString()
    });
  });

  saveButton.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) {
      alert('Add an answer first');
      return;
    }
    hasAnsweredCurrent = true;

    saveLocalAnswer(q.id || '', {
      type: 'text',
      answerText: text,
      savedToServer: true,
      timestamp: new Date().toISOString()
    });

    feedbackEl.textContent = 'Your answer has been saved';

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
  });

  modelButton.addEventListener('click', () => {
    feedbackEl.textContent = q.explanation || 'No sample answer available';
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

function fetchWithTimeout(url, ms){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(()=>clearTimeout(t));
}

function startLoadingBar(){
  if(!loadBarInner) return null;
  let p = 0;
  loadBarInner.style.width = '0%';
  const id = setInterval(()=>{
    p += 6;
    if(p > 90) p = 42;
    loadBarInner.style.width = p + '%';
  }, 160);
  return id;
}

function stopLoadingBar(id){
  if(id) clearInterval(id);
  if(loadBarInner) loadBarInner.style.width = '100%';
  setTimeout(()=>{
    if(!loadingEl) return;
    loadingEl.classList.add('fade-out');
    setTimeout(()=>{
      loadingEl.classList.add('hidden');
      loadingEl.classList.remove('fade-out');
      loadingEl.setAttribute('aria-busy','false');
    }, 420);
  }, 220);
}

async function loadQuestions() {
  try {
    loadingEl.classList.remove('hidden');
    loadingEl.setAttribute('aria-busy','true');
    cardEl.classList.add('hidden');
    cardEl.classList.remove('fade-in');
    const loadId = startLoadingBar();

    if (SHEET_URL) {
      const response = await fetchWithTimeout(SHEET_URL, 20000);
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

    selectedAnswers = new Array(questions.length).fill(null);

    stopLoadingBar(loadId);
    setTimeout(()=>{
      cardEl.classList.remove('hidden');
      cardEl.classList.add('fade-in');
      currentIndex = 0;
      renderQuestion();
      startTimer();
    }, 520);
  } catch (err) {
    console.error(err);
    if(typeof loadId !== 'undefined') stopLoadingBar(loadId);
    if(loadingEl){
      loadingEl.classList.remove('hidden');
      const box = loadingEl.querySelector('.loading-box');
      if(box){
        box.innerHTML = `<div class="loading-title">Loading ...</div>
        <div style="color:#eaf2ff; margin-top:10px; font-size:14px;">Problem loading</div>
        <button id="retryLoad" class="btn" style="margin-top:12px; width:100%;">Try again</button>`;
        const retry = box.querySelector('#retryLoad');
        retry.addEventListener('click', ()=>{
          // restore box structure
          box.innerHTML = `<div class="loading-title">Loading ...</div>
            <div class="loading-bar"><div id="loadBar" class="loading-bar-inner"></div></div>`;
          // rebind bar element
          const newBar = box.querySelector('#loadBar');
          if(newBar) window.__examorioLoadBar = newBar;
          location.reload();
        });
      }
    }
  }
}



if (finishBtn) {
  finishBtn.addEventListener('click', () => {
    alert('Saved.');
  });
}
