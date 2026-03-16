// ═══ 메인 앱 컨트롤러 V2 ═══
const App = {
  currentQuestion: 0,
  answers: new Array(QUESTIONS.length).fill(0),
  results: [],
  allScores: [],
  personality: null,
  selections: { first: '', second: '', third: '' },

  init() {
    this.bindEvents();
    this.showSection('intro');
  },

  bindEvents() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.currentQuestion = 0;
      this.answers.fill(0);
      this.showSection('survey');
      this.renderQuestion();
    });

    document.getElementById('btn-prev').addEventListener('click', () => this.prevQuestion());
    document.getElementById('btn-next').addEventListener('click', () => this.nextQuestion());

    document.getElementById('btn-to-selection').addEventListener('click', () => {
      this.showSection('selection');
      this.renderSelection();
    });

    document.getElementById('btn-guide').addEventListener('click', () => this.showGuide());
    document.getElementById('guide-close').addEventListener('click', () => this.hideGuide());
    document.getElementById('guide-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideGuide();
    });

    document.getElementById('btn-submit').addEventListener('click', () => this.submitSelection());

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.currentQuestion = 0;
      this.answers.fill(0);
      this.selections = { first: '', second: '', third: '' };
      this.showSection('intro');
    });
  },

  showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'result' || id === 'complete') {
      setTimeout(() => this.launchConfetti(), 300);
    }
  },

  // ─── 설문 ───
  renderQuestion() {
    const q = QUESTIONS[this.currentQuestion];
    const total = QUESTIONS.length;

    document.getElementById('progress-fill').style.width = `${((this.currentQuestion + 1) / total) * 100}%`;
    document.getElementById('progress-text').textContent = `${this.currentQuestion + 1} / ${total}`;
    document.getElementById('question-area').textContent = q.area;

    const card = document.getElementById('question-card');
    card.classList.remove('slide-in');
    void card.offsetWidth;
    card.classList.add('slide-in');

    document.getElementById('question-emoji').textContent = q.emoji;
    document.getElementById('question-text').textContent = q.text;
    this.renderLikert();

    document.getElementById('btn-prev').disabled = this.currentQuestion === 0;
    const btnNext = document.getElementById('btn-next');
    btnNext.textContent = this.currentQuestion === total - 1 ? '결과 보기 ✨' : '다음';
    btnNext.disabled = this.answers[this.currentQuestion] === 0;
  },

  renderLikert() {
    const container = document.getElementById('likert-buttons');
    const labels = [
      { score: 1, emoji: '😑', text: '전혀\n아니다' },
      { score: 2, emoji: '😐', text: '아니다' },
      { score: 3, emoji: '🙂', text: '보통' },
      { score: 4, emoji: '😊', text: '그렇다' },
      { score: 5, emoji: '🤩', text: '매우\n그렇다' },
    ];

    container.innerHTML = labels.map(l => `
      <button class="likert-btn ${this.answers[this.currentQuestion] === l.score ? 'selected' : ''}"
              data-score="${l.score}">
        <span class="likert-emoji">${l.emoji}</span>
        <span class="likert-label">${l.text}</span>
      </button>
    `).join('');

    container.querySelectorAll('.likert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const score = parseInt(btn.dataset.score);
        this.answers[this.currentQuestion] = score;
        this.renderLikert();
        document.getElementById('btn-next').disabled = false;
        btn.classList.add('bounce');
        setTimeout(() => {
          if (this.currentQuestion < QUESTIONS.length - 1) {
            this.nextQuestion();
          }
        }, 400);
      });
    });
  },

  prevQuestion() {
    if (this.currentQuestion > 0) {
      this.currentQuestion--;
      this.renderQuestion();
    }
  },

  nextQuestion() {
    if (this.answers[this.currentQuestion] === 0) return;
    if (this.currentQuestion < QUESTIONS.length - 1) {
      this.currentQuestion++;
      this.renderQuestion();
    } else {
      const { results, allScores } = getTopMajors(this.answers, 3);
      this.results = results;
      this.allScores = allScores;
      this.personality = buildPersonalityText(this.answers);
      this.showSection('result');
      this.renderResults();
    }
  },

  // ─── 결과 ───
  renderResults() {
    // 성격 프로파일
    const profileEl = document.getElementById('personality-profile');
    const p = this.personality;
    profileEl.innerHTML = `
      <div class="profile-summary">${p.summary}</div>
      <div class="profile-detail">${p.detail}</div>
    `;

    // 상위 3개 결과 카드
    const container = document.getElementById('result-cards');
    const rankLabels = ['1지망 추천', '2지망 추천', '3지망 추천'];
    const rankColors = ['#FF9AA2', '#FFB7B2', '#FFDAC1'];

    container.innerHTML = this.results.map((r, i) => `
      <div class="result-card" style="animation-delay: ${i * 0.2}s; border-left: 5px solid ${rankColors[i]}">
        <div class="result-rank" style="background: ${rankColors[i]}">${rankLabels[i]}</div>
        <div class="result-score-badge">${r.score}<span class="score-unit">점</span></div>
        <div class="result-emoji">${r.emoji}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-desc">${r.desc}</div>
        <div class="result-bar-wrap">
          <div class="result-bar" style="width: ${r.score}%; background: ${rankColors[i]}"></div>
        </div>
        <div class="result-reason">${r.reason}</div>
      </div>
    `).join('');

    // 전체 계열 점수 랭킹
    this.renderScoreBoard();

    // 교차 검증 메시지
    this.renderCrossCheck();

    // 예체능 안내
    document.getElementById('arts-notice').style.display = 'block';
  },

  renderScoreBoard() {
    const board = document.getElementById('score-board');
    const topN = this.allScores.slice(0, 10); // 상위 10개만

    board.innerHTML = `
      <div class="board-title">전체 계열 적합도 TOP 10</div>
      <div class="board-list">
        ${topN.map((s, i) => {
          const major = MAJORS.find(m => m.name === s.name);
          const isTop3 = i < 3;
          return `
            <div class="board-row ${isTop3 ? 'board-highlight' : ''}">
              <span class="board-rank">${i + 1}</span>
              <span class="board-emoji">${major ? major.emoji : '📋'}</span>
              <span class="board-name">${s.name}</span>
              <span class="board-score">${s.score}점</span>
              <div class="board-bar-wrap">
                <div class="board-bar" style="width: ${s.score}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderCrossCheck() {
    const topNames = this.results.map(r => r.name);
    const messages = getCrossCheckMessages(this.answers, topNames);
    const el = document.getElementById('cross-check');

    if (messages.length > 0) {
      el.style.display = 'block';
      el.innerHTML = `
        <div class="cross-title">💭 한 가지 더 생각해볼 점</div>
        ${messages.map(m => `
          <div class="cross-msg">
            <span class="cross-major">${m.major}</span>
            <span>${m.msg}</span>
          </div>
        `).join('')}
      `;
    } else {
      el.style.display = 'none';
    }
  },

  // ─── 가이드 ───
  showGuide() {
    const list = document.getElementById('guide-list');
    list.innerHTML = GUIDE_TIPS.map(t => `
      <li><span class="guide-emoji">${t.emoji}</span> ${t.text}</li>
    `).join('');
    document.getElementById('guide-overlay').classList.add('show');
  },

  hideGuide() {
    document.getElementById('guide-overlay').classList.remove('show');
  },

  // ─── 선택 ───
  renderSelection() {
    if (!this.selections.first && this.results[0]) this.selections.first = this.results[0].name;
    if (!this.selections.second && this.results[1]) this.selections.second = this.results[1].name;
    if (!this.selections.third && this.results[2]) this.selections.third = this.results[2].name;

    const selects = ['select-1st', 'select-2nd', 'select-3rd'];
    const keys = ['first', 'second', 'third'];

    selects.forEach((id, i) => {
      const select = document.getElementById(id);
      select.innerHTML = '<option value="">-- 선택해주세요 --</option>' +
        MAJORS.map(m => `<option value="${m.name}" ${this.selections[keys[i]] === m.name ? 'selected' : ''}>${m.emoji} ${m.name}</option>`).join('');
      select.addEventListener('change', (e) => {
        this.selections[keys[i]] = e.target.value;
        this.validateSelection();
      });
    });

    this.validateSelection();
  },

  validateSelection() {
    const { first, second, third } = this.selections;
    document.getElementById('btn-submit').disabled = !first || !second || !third;

    const warn = document.getElementById('duplicate-warn');
    if (first && second && third) {
      const set = new Set([first, second, third]);
      if (set.size < 3) {
        warn.style.display = 'block';
        warn.textContent = '같은 계열을 중복 선택했어요! 다른 계열도 골라보세요.';
      } else {
        warn.style.display = 'none';
      }
    } else {
      warn.style.display = 'none';
    }
  },

  submitSelection() {
    const { first, second, third } = this.selections;
    if (!first || !second || !third) return;

    const m1 = MAJORS.find(m => m.name === first);
    const m2 = MAJORS.find(m => m.name === second);
    const m3 = MAJORS.find(m => m.name === third);

    // 선택한 계열의 점수 찾기
    const findScore = (name) => {
      const found = this.allScores.find(s => s.name === name);
      return found ? found.score : '-';
    };

    const msg = `이렇게 선택할까요?\n\n` +
      `1지망: ${m1?.emoji || ''} ${first}\n` +
      `2지망: ${m2?.emoji || ''} ${second}\n` +
      `3지망: ${m3?.emoji || ''} ${third}`;

    if (confirm(msg)) {
      this.showSection('complete');
      document.getElementById('complete-summary').innerHTML = `
        <div class="complete-item">
          <span class="complete-rank">1지망</span>
          <span class="complete-major">${m1?.emoji || ''} ${first}</span>
          <span class="complete-score">${findScore(first)}점</span>
        </div>
        <div class="complete-item">
          <span class="complete-rank">2지망</span>
          <span class="complete-major">${m2?.emoji || ''} ${second}</span>
          <span class="complete-score">${findScore(second)}점</span>
        </div>
        <div class="complete-item">
          <span class="complete-rank">3지망</span>
          <span class="complete-major">${m3?.emoji || ''} ${third}</span>
          <span class="complete-score">${findScore(third)}점</span>
        </div>
      `;
      this.launchConfetti();
    }
  },

  // ─── Confetti ───
  launchConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';
    const colors = ['#FF9AA2','#FFB7B2','#FFDAC1','#B5EAD7','#C7CEEA','#E2F0CB','#FFDFD3'];
    const emojis = ['🎉','🎊','✨','💫','🌟','⭐','🎈'];

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      if (Math.random() > 0.5) {
        piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        piece.style.fontSize = (12 + Math.random() * 16) + 'px';
      } else {
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (6 + Math.random() * 8) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      }
      piece.style.left = Math.random() * 100 + '%';
      piece.style.animationDelay = Math.random() * 2 + 's';
      piece.style.animationDuration = (2 + Math.random() * 3) + 's';
      container.appendChild(piece);
    }
    setTimeout(() => { container.innerHTML = ''; }, 5000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
