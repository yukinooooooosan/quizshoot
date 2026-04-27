// quiz.js - クイズシステム（十字キー入力・3文字回答）
import { questions, kanaPool } from './questions.js';

// 'scramble(3)' → { type: 'scramble', n: 3 }
function parsePattern(str) {
  const m = str.match(/^(\w+)\((\d+)\)$/);
  return m ? { type: m[1], n: parseInt(m[2]) } : { type: str, n: 1 };
}

export class QuizManager {
  constructor({ onCorrect, onWrong, onTimeUp, onInput }) {
    this.onCorrect = onCorrect;
    this.onWrong = onWrong;
    this.onTimeUp = onTimeUp;
    this.onInput = onInput || (() => { });

    // DOM
    this.questionEl = document.getElementById('question-text');
    this.slots = document.querySelectorAll('.char-slot');
    this.timerFill = document.getElementById('timer-fill');
    this.dpadBtns = {
      up: document.getElementById('dpad-up'),
      left: document.getElementById('dpad-left'),
      center: document.getElementById('dpad-center'),
      right: document.getElementById('dpad-right'),
      down: document.getElementById('dpad-down'),
    };
    this.dpadCharEls = {};
    for (const dir of ['up', 'down', 'left', 'right']) {
      const charEl = document.createElement('span');
      charEl.className = 'dpad-char';
      this.dpadBtns[dir].appendChild(charEl);
      this.dpadCharEls[dir] = charEl;
    }

    // State
    this.currentQuestion = null;
    this.inputChars = [];
    this.inputPos = 0;
    this.dpadChars = { up: '', left: '', right: '', down: '' };
    this.dpadDisplayChars = { up: '', left: '', right: '', down: '' };
    this.timer = 0;
    this.timerMax = 15;
    this.timerInterval = null;
    this.answerTimeout = null;
    this.answerTimeoutStartedAt = 0;
    this.answerTimeoutRemaining = 0;
    this.active = false;
    this.paused = false;
    this.activeBeforePause = false;
    this.usedIndices = [];
    this.shuffledQuestions = [];
    this.currentWave = 1;
    this.pendingBossPattern = null;
    this.maxQuestionLevel = 1;
    this.allowedGenres = null;
    this.allowedLevels = null;

    this._bindEvents();
  }

  _bindEvents() {
    // D-pad click/touch
    const dirs = ['up', 'down', 'left', 'right'];
    for (const dir of dirs) {
      this.dpadBtns[dir].addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.active) this._selectChar(dir);
      });
    }
    this.dpadBtns.center.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.active) this._clearInput();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const keyMap = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        this._selectChar(keyMap[e.key]);
        // Visual press
        const btn = this.dpadBtns[keyMap[e.key]];
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
      }
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === ' ') {
        e.preventDefault();
        this._clearInput();
      }
    });
  }

  // シャッフル済み問題リストを生成
  _shuffleQuestions() {
    const questionPool = questions.filter(q => {
      const qLevel = q.level || 1;
      const levelOk = this.allowedLevels
        ? this.allowedLevels.includes(qLevel)
        : qLevel <= this.maxQuestionLevel;
      const genreOk = !this.allowedGenres
        || this.allowedGenres.includes('mixed')
        || this.allowedGenres.includes(q.genre);
      return levelOk && genreOk;
    });
    const source = questionPool.length > 0 ? questionPool : questions;
    this.shuffledQuestions = [...source]
      .map((q, i) => ({ q, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(x => x.q);
    this.usedIndices = [];
  }

  // 次の問題を取得
  _nextQuestion() {
    if (this.shuffledQuestions.length === 0) {
      this._shuffleQuestions();
    }
    return this.shuffledQuestions.pop();
  }

  // D-padの文字を生成（共通のchars配列をシャッフルして配置）
  _generateDpadChars() {
    const dirs = ['up', 'down', 'left', 'right'];

    // 事前定義された文字を取得（重複もそのまま保持）
    let charList = [...(this.currentQuestion.chars || [])];

    // 回答に必要な文字が十分含まれているか確認（安全策）
    const answerChars = [...this.currentQuestion.answer];
    for (const c of answerChars) {
      const needed = answerChars.filter(x => x === c).length;
      const have = charList.filter(x => x === c).length;
      for (let i = have; i < needed; i++) {
        charList.push(c);
      }
    }

    // 4文字未満ならkanaPoolからランダムで補充
    if (charList.length < 4) {
      const pool = kanaPool.split('').filter(c => !charList.includes(c));
      while (charList.length < 4 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        charList.push(pool.splice(idx, 1)[0]);
      }
    }

    // 4文字を超えている場合は切り詰め
    if (charList.length > 4) {
      charList = charList.slice(0, 4);
    }

    // 4文字をシャッフルしてD-padに配置
    for (let i = charList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [charList[i], charList[j]] = [charList[j], charList[i]];
    }

    for (let i = 0; i < 4; i++) {
      this.dpadChars[dirs[i]] = charList[i];
    }

    // 表示用文字を決定（scramble(n) なら n ボタンを？に）
    // pendingBossPattern のクリアは呼び出し元で行う
    const scrambleEntry = Array.isArray(this.pendingBossPattern)
      ? this.pendingBossPattern.find(p => p.startsWith('scramble'))
      : null;

    const hiddenDirs = new Set();
    if (scrambleEntry) {
      const { n } = parsePattern(scrambleEntry);
      const shuffled = [...dirs].sort(() => Math.random() - 0.5);
      shuffled.slice(0, n).forEach(d => hiddenDirs.add(d));
    }

    for (const dir of dirs) {
      this.dpadDisplayChars[dir] = hiddenDirs.has(dir) ? '?' : this.dpadChars[dir];
    }
  }

  // 問題文をbossLevel文字分マスクして返す
  _maskQuestion(text, bossLevel) {
    const chars = [...text];
    const maskable = chars
      .map((_, i) => i)
      .filter(i => chars[i] !== '？' && chars[i].trim() !== '' && i < chars.length - 1);

    for (let i = maskable.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [maskable[i], maskable[j]] = [maskable[j], maskable[i]];
    }

    const toMask = new Set(maskable.slice(0, Math.min(bossLevel, maskable.length)));
    return chars.map((c, i) => toMask.has(i) ? '？' : c).join('');
  }

  // 文字を選択
  _selectChar(dir) {
    if (this.inputPos >= 3) return;

    // グレーアウト済みのボタンは押せない
    if (this.dpadBtns[dir].classList.contains('used')) return;

    const char = this.dpadChars[dir];
    this.inputChars.push(char);
    this._playDpadBurst(dir);

    // 自機リアクション
    this.onInput(dir);

    // 選択したボタンをグレーアウト
    this.dpadBtns[dir].classList.add('used');

    // スロット更新
    this.slots[this.inputPos].textContent = char;
    this.slots[this.inputPos].classList.remove('active');
    this.slots[this.inputPos].classList.add('filled');
    this._playSlotReceive(this.slots[this.inputPos]);
    this.inputPos++;

    if (this.inputPos < 3) {
      this.slots[this.inputPos].classList.add('active');
    } else {
      // 3文字入力完了 → 判定
      this._checkAnswer();
    }
  }

  _playDpadBurst(dir) {
    const btn = this.dpadBtns[dir];
    const charEl = this.dpadCharEls[dir];
    btn.classList.remove('shatter');
    charEl.classList.remove('burst');
    for (const oldShard of btn.querySelectorAll('.dpad-shard')) oldShard.remove();

    const shardCount = 12;
    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement('span');
      shard.className = 'dpad-shard';
      shard.style.setProperty('--burst-angle', `${(360 / shardCount) * i - 90}deg`);
      shard.style.setProperty('--burst-distance', `${30 + (i % 3) * 10}px`);
      btn.appendChild(shard);
    }

    void charEl.offsetWidth;
    btn.classList.add('shatter');
    charEl.classList.add('burst');
    window.setTimeout(() => {
      btn.classList.remove('shatter');
      charEl.classList.remove('burst');
      for (const shard of btn.querySelectorAll('.dpad-shard')) shard.remove();
    }, 100);
  }

  _playSlotReceive(slot) {
    slot.classList.remove('receive');
    void slot.offsetWidth;
    slot.classList.add('receive');
    window.setTimeout(() => slot.classList.remove('receive'), 180);
  }

  // 入力クリア
  _clearInput() {
    this.inputChars = [];
    this.inputPos = 0;
    for (const slot of this.slots) {
      slot.textContent = '';
      slot.classList.remove('filled', 'active', 'correct', 'wrong');
    }
    // D-padのグレーアウトを全解除
    const dirs = ['up', 'down', 'left', 'right'];
    for (const dir of dirs) {
      this.dpadBtns[dir].classList.remove('used');
    }
    if (this.currentQuestion) {
      this.slots[0].classList.add('active');
    }
    // 自機リアクション
    this.onInput('center');
  }

  // 回答チェック
  _checkAnswer() {
    this.active = false;
    this._stopTimer();
    const gaugeRatio = Math.max(0, this.timer / this.timerMax);
    const playerAnswer = this.inputChars.join('');
    const correct = playerAnswer === this.currentQuestion.answer;

    if (correct) {
      for (const slot of this.slots) slot.classList.add('correct');
      this._setAnswerTimeout(() => this.onCorrect(gaugeRatio), 300);
    } else {
      for (const slot of this.slots) slot.classList.add('wrong');
      this._setAnswerTimeout(() => this.onWrong(), 400);
    }
  }

  _fillDebugAnswer(chars) {
    this.inputChars = chars.slice(0, 3);
    this.inputPos = 3;
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].textContent = this.inputChars[i] || '';
      this.slots[i].classList.remove('active', 'correct', 'wrong');
      this.slots[i].classList.add('filled');
    }
  }

  forceCorrect() {
    if (!this.active || !this.currentQuestion) return false;
    this._fillDebugAnswer([...this.currentQuestion.answer]);
    this._checkAnswer();
    return true;
  }

  forceWrong() {
    if (!this.active || !this.currentQuestion) return false;
    this._fillDebugAnswer(['X', 'X', 'X']);
    this._checkAnswer();
    return true;
  }

  // タイマー開始
  _startTimer() {
    this._stopTimer();
    this.timer = this.timerMax;
    this.timerFill.style.width = '0%';

    this.timerInterval = setInterval(() => {
      this.timer -= 0.1;
      const pct = Math.max(0, (this.timer / this.timerMax) * 100);
      this.timerFill.style.width = (100 - pct) + '%';

      if (this.timer <= 0) {
        this._stopTimer();
        this.active = false;
        for (const slot of this.slots) slot.classList.add('wrong');
        this._setAnswerTimeout(() => this.onTimeUp(), 400);
      }
    }, 100);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  _setAnswerTimeout(callback, delay) {
    this._clearAnswerTimeout();
    this.answerTimeoutRemaining = delay;
    this.answerTimeoutStartedAt = Date.now();
    this.answerTimeout = setTimeout(() => {
      this.answerTimeout = null;
      this.answerTimeoutRemaining = 0;
      callback();
    }, delay);
  }

  _clearAnswerTimeout() {
    if (this.answerTimeout) {
      clearTimeout(this.answerTimeout);
      this.answerTimeout = null;
    }
    this.answerTimeoutRemaining = 0;
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.activeBeforePause = this.active;
    this.active = false;
    this._stopTimer();
    if (this.answerTimeout) {
      this.answerTimeoutRemaining = Math.max(
        0,
        this.answerTimeoutRemaining - (Date.now() - this.answerTimeoutStartedAt)
      );
      clearTimeout(this.answerTimeout);
      this.answerTimeout = null;
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.answerTimeoutRemaining > 0) {
      const remaining = this.answerTimeoutRemaining;
      this.answerTimeoutStartedAt = Date.now();
      this.answerTimeout = setTimeout(() => {
        this.answerTimeout = null;
        this.answerTimeoutRemaining = 0;
        if (this.currentQuestion && this.inputPos === 3) {
          const playerAnswer = this.inputChars.join('');
          const gaugeRatio = Math.max(0, this.timer / this.timerMax);
          if (playerAnswer === this.currentQuestion.answer) this.onCorrect(gaugeRatio);
          else this.onWrong();
        } else {
          this.onTimeUp();
        }
      }, remaining);
      return;
    }
    if (this.activeBeforePause && this.currentQuestion) {
      this.active = true;
      this.timerInterval = setInterval(() => {
        this.timer -= 0.1;
        const pct = Math.max(0, (this.timer / this.timerMax) * 100);
        this.timerFill.style.width = (100 - pct) + '%';

        if (this.timer <= 0) {
          this._stopTimer();
          this.active = false;
          for (const slot of this.slots) slot.classList.add('wrong');
          this._setAnswerTimeout(() => this.onTimeUp(), 400);
        }
      }, 100);
    }
  }

  // ウェーブに応じた制限時間を設定
  setTimerForWave(wave) {
    this.currentWave = wave;
    if (wave <= 3) this.timerMax = 15;
    else if (wave <= 7) this.timerMax = 12;
    else if (wave <= 10) this.timerMax = 10;
    else this.timerMax = 8;
  }

  setMaxQuestionLevel(level) {
    this.maxQuestionLevel = Math.max(1, Math.min(4, level));
    this.allowedLevels = null;
    this.shuffledQuestions = [];
  }

  setQuestionFilter({ genres = null, levels = null, levelMax = this.maxQuestionLevel, timerSec = null } = {}) {
    this.maxQuestionLevel = Math.max(1, Math.min(4, levelMax));
    this.allowedGenres = Array.isArray(genres) && genres.length > 0 ? genres : null;
    this.allowedLevels = Array.isArray(levels) && levels.length > 0
      ? [...new Set(levels.map(level => Math.max(1, Math.min(4, level))))]
      : null;
    if (timerSec) this.timerMax = timerSec;
    this.shuffledQuestions = [];
  }

  // 問題をプレビュー表示（READY中：問題文表示、D-padはブランク、タイマー未開始）
  showQuestionPreview() {
    this.currentQuestion = this._nextQuestion();
    this.inputChars = [];
    this.inputPos = 0;

    for (const slot of this.slots) {
      slot.textContent = '';
      slot.classList.remove('filled', 'active', 'correct', 'wrong');
    }
    this.slots[0].classList.add('active');

    for (const dir of ['up', 'down', 'left', 'right']) {
      this.dpadBtns[dir].classList.remove('used');
      this.dpadCharEls[dir].textContent = '';
    }

    this._generateDpadChars();
    const pattern = this.pendingBossPattern;
    this.pendingBossPattern = null;
    this._applyPatternEffects(pattern);

    this.timerFill.style.width = '0%';
    this.active = false;
  }

  // GO！後に呼ぶ：D-pad文字を表示してタイマー開始
  activateQuestion() {
    for (const dir of ['up', 'down', 'left', 'right']) {
      this.dpadCharEls[dir].textContent = this.dpadDisplayChars[dir];
    }
    this._startTimer();
    this.active = true;
  }

  // 新しい問題を出題（READY/GOなしで即開始する場合）
  showQuestion() {
    this.currentQuestion = this._nextQuestion();
    this.inputChars = [];
    this.inputPos = 0;

    for (const slot of this.slots) {
      slot.textContent = '';
      slot.classList.remove('filled', 'active', 'correct', 'wrong');
    }
    this.slots[0].classList.add('active');

    for (const dir of ['up', 'down', 'left', 'right']) {
      this.dpadBtns[dir].classList.remove('used');
    }

    this._generateDpadChars();
    const pattern = this.pendingBossPattern;
    this.pendingBossPattern = null;
    this._applyPatternEffects(pattern);

    for (const dir of ['up', 'down', 'left', 'right']) {
      this.dpadCharEls[dir].textContent = this.dpadDisplayChars[dir];
    }
    this._startTimer();
    this.active = true;
  }

  _applyPatternEffects(pattern) {
    // blind
    const blindEntry = Array.isArray(pattern) ? pattern.find(p => p.startsWith('blind')) : null;
    if (blindEntry) {
      const { n } = parsePattern(blindEntry);
      this.questionEl.textContent = this._maskQuestion(this.currentQuestion.question, n);
    } else {
      this.questionEl.textContent = this.currentQuestion.question;
    }

    // marquee
    this.questionEl.classList.remove('marquee-active');
    this.questionEl.style.removeProperty('--marquee-dur');
    const marqueeEntry = Array.isArray(pattern) ? pattern.find(p => p.startsWith('marquee')) : null;
    if (marqueeEntry) {
      const { n } = parsePattern(marqueeEntry);
      this.questionEl.style.setProperty('--marquee-dur', n + 's');
      this.questionEl.classList.add('marquee-active');
    }
  }

  _clearPatternEffects() {
    this.questionEl.classList.remove('marquee-active');
    this.questionEl.style.removeProperty('--marquee-dur');
  }

  // 停止
  stop() {
    this.active = false;
    this.paused = false;
    this._stopTimer();
    this._clearAnswerTimeout();
    this._clearPatternEffects();
  }

  // リセット
  reset() {
    this.stop();
    this.setQuestionFilter({ genres: null, levelMax: 1, timerSec: 15 });
    this._shuffleQuestions();
    this.inputChars = [];
    this.inputPos = 0;
    for (const slot of this.slots) {
      slot.textContent = '';
      slot.classList.remove('filled', 'active', 'correct', 'wrong');
    }
    this.questionEl.textContent = '';
    this.timerFill.style.width = '100%';
  }
}
