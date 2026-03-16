// 메인 앱 컨트롤러
const App = {
  currentQuestion: 0,
  answers: new Array(QUESTIONS.length).fill(0),
  results: [],
  selections: { first: '', second: '', third: '' },

  init() {
    this.bindEvents();
    this.showSection('intro');
  },

  bindEvents() {
    // 시작 버튼
    document.getElementById('btn-start').addEventListener('click', () => {
      this.currentQuestion = 0;
      this.answers.fill(0);
      this.showSection('survey');
      this.renderQuestion();
    });

    // 이전/다음 버튼
    document.getElementById('btn-prev').addEventListener('click', () => this.prevQuestion());
    document.getElementById('btn-next').addEventListener('click', () => this.nextQuestion());

    // 결과에서 선택으로
    document.getElementById('btn-to-selection').addEventListener('click', () => {
      this.showSection('selection');
      this.renderSelection();
    });

    // 가이드 팝업
    document.getElementById('btn-guide').addEventListener('click', () => this.showGuide());
    document.getElementById('guide-close').addEventListener('click', () => this.hideGuide());
    document.getElementById('guide-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideGuide();
    });

    // 제출
    document.getElementById('btn-submit').addEventListener('click', () => this.submitSelection());

    // 다시하기
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.currentQuestion = 0;
      this.answers.fill(0);
      this.selections = { first: '', second: '', third: '' };
      this.showSection('intro');
    });
  },

  showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(id);
    section.classList.add('active');
    window.scrollTo(0, 0);

    if (id === 'result') {
      setTimeout(() => this.launchConfetti(), 300);
    }
  },

  // ─── 설문 ───
  renderQuestion() {
    const q = QUESTIONS[this.currentQuestion];
    const total = QUESTIONS.length;

    // 프로그레스
    document.getElementById('progress-fill').style.width = `${((this.currentQuestion + 1) / total) * 100}%`;
    document.getElementById('progress-text').textContent = `${this.currentQuestion + 1} / ${total}`;

    // 영역 표시
    document.getElementById('question-area').textContent = q.area;

    // 문항
    const card = document.getElementById('question-card');
    card.classList.remove('slide-in');
    void card.offsetWidth; // reflow
    card.classList.add('slide-in');

    document.getElementById('question-emoji').textContent = q.emoji;
    document.getElementById('question-text').textContent = q.text;

    // 이모지 버튼 상태
    this.renderLikert();

    // 네비게이션 상태
    document.getElementById('btn-prev').disabled = this.currentQuestion === 0;
    const btnNext = document.getElementById('btn-next');
    btnNext.textContent = this.currentQuestion === total - 1 ? '결과 보기' : '다음';
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
      btn.addEventListener('click', (e) => {
        const score = parseInt(btn.dataset.score);
        this.answers[this.currentQuestion] = score;
        this.renderLikert();
        document.getElementById('btn-next').disabled = false;

        // 자동 다음 (0.4초 후)
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
      // 결과 계산
      this.results = getTopMajors(this.answers, 3);
      this.showSection('result');
      this.renderResults();
    }
  },

  // ─── 결과 ───
  renderResults() {
    const container = document.getElementById('result-cards');
    const maxScore = getMaxPossibleScore();
    const rankLabels = ['1지망 추천', '2지망 추천', '3지망 추천'];
    const rankColors = ['#FF9AA2', '#FFB7B2', '#FFDAC1'];

    container.innerHTML = this.results.map((r, i) => `
      <div class="result-card" style="animation-delay: ${i * 0.2}s; border-left: 5px solid ${rankColors[i]}">
        <div class="result-rank" style="background: ${rankColors[i]}">${rankLabels[i]}</div>
        <div class="result-emoji">${r.emoji}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-desc">${r.desc}</div>
        <div class="result-bar-wrap">
          <div class="result-bar" style="width: ${Math.min((r.score / maxScore) * 100, 100)}%; background: ${rankColors[i]}"></div>
        </div>
        <div class="result-reason">${r.reason}</div>
      </div>
    `).join('');

    // 예체능 안내
    document.getElementById('arts-notice').style.display = 'block';
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
    // 추천 결과를 기본값으로 세팅
    if (!this.selections.first && this.results[0]) {
      this.selections.first = this.results[0].name;
    }
    if (!this.selections.second && this.results[1]) {
      this.selections.second = this.results[1].name;
    }
    if (!this.selections.third && this.results[2]) {
      this.selections.third = this.results[2].name;
    }

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
    const btn = document.getElementById('btn-submit');
    btn.disabled = !first || !second || !third;

    // 중복 경고
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

    // 확인 팝업
    const m1 = MAJORS.find(m => m.name === first);
    const m2 = MAJORS.find(m => m.name === second);
    const m3 = MAJORS.find(m => m.name === third);

    const msg = `이렇게 선택할까요?\n\n` +
      `1지망: ${m1?.emoji || ''} ${first}\n` +
      `2지망: ${m2?.emoji || ''} ${second}\n` +
      `3지망: ${m3?.emoji || ''} ${third}`;

    if (confirm(msg)) {
      this.showSection('complete');
      document.getElementById('complete-summary').innerHTML = `
        <div class="complete-item"><span class="complete-rank">1지망</span> ${m1?.emoji || ''} ${first}</div>
        <div class="complete-item"><span class="complete-rank">2지망</span> ${m2?.emoji || ''} ${second}</div>
        <div class="complete-item"><span class="complete-rank">3지망</span> ${m3?.emoji || ''} ${third}</div>
      `;
      this.launchConfetti();
    }
  },

  // ─── Confetti ───
  launchConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';
    const colors = ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFDFD3'];
    const emojis = ['🎉', '🎊', '✨', '💫', '🌟', '⭐', '🎈'];

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const isEmoji = Math.random() > 0.5;
      if (isEmoji) {
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

// 시작
document.addEventListener('DOMContentLoaded', () => App.init());
