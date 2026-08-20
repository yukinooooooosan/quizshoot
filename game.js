// game.js - メインゲームエンジン
import { QuizManager } from './quiz.js';
import { STAGE_DEFS } from './stage_defs.js';
import { ENEMY_SPRITE_COUNT, drawEnemyMob, getMobIdByIndex } from './mob_sprites.js';
import { drawBoss, getBossMainColor } from './boss_sprites.js';

// ========== 定数 ==========
const CW = 480;
const CH = 360;
const PLAYER_BOTTOM_LIFT = 0;
const PLAYER_Y = CH - 30 - PLAYER_BOTTOM_LIFT;
const PLAYER_DEFENSE_GAP = 20;
const DEFENSE_Y = PLAYER_Y - PLAYER_DEFENSE_GAP;
const DEFENSE_BREACH_MARGIN = 5;
const DANGER_ZONE_HEIGHT = 40;
const DANGER_Y = DEFENSE_Y - DANGER_ZONE_HEIGHT;
const DANGER_APPROACH_DESCENT_MULT = 1.65;
const DANGER_ZONE_DESCENT_MULT = 0.35;
const ENEMY_ANIM_SPEED_MIN = 1;
const ENEMY_ANIM_SPEED_DANGER = 1.5;
const ENEMY_ANIM_SPEED_DEFEAT = 3;
const DEBUG_SHORTCUTS = true;
const ENEMY_W = 28;
const ENEMY_H = 28;
const ENEMY_GAP_X = 10;
const ENEMY_GAP_Y = 8;
const BULLET_SPEED = 10;

// コンボランク定義
const COMBO_RANKS = [
  { name: 'LASER', comboToNext: 3, killCounts: { hit: 1, great: 2, perfect: 3, ace: 5 } },
  { name: 'MISSILE', comboToNext: 3, killCounts: { hit: 2, great: 3, perfect: 4, ace: 6 } },
  { name: 'BEAM', comboToNext: 4, killCounts: { hit: 3, great: 5, perfect: 6, ace: 8 } },
  { name: 'NOVA', comboToNext: Infinity, killCounts: { hit: 4, great: 7, perfect: 10, ace: 15 } },
];

const SCORE_MULTIPLIER = { hit: 1.0, great: 1.5, perfect: 2.0, ace: 3.0 };
const WRONG_ANSWER_DROP = 20;
const DANGER_ATTACK_BONUS_BY_RANK = [5, 3, 2, 1];
const WAVE_BACKGROUND_FADE_MS = 1500;

function mixHexColors(fromColor, toColor, ratio) {
  const from = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(fromColor);
  const to = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(toColor);
  if (!from || !to) return ratio < 1 ? fromColor : toColor;

  const eased = ratio * ratio * (3 - 2 * ratio);
  const channels = [1, 2, 3].map(index => {
    const start = parseInt(from[index], 16);
    const end = parseInt(to[index], 16);
    return Math.round(start + (end - start) * eased).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function trackAnalyticsEvent(eventName, parameters = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, parameters);
}

// ボスウェーブ定義テーブル
// pattern: 'scramble(n)' = n個のボタンを？に隠す, 'blind(n)' = 問題文をn文字マスク
// design: 'fortress' | 'wing' | 'core' | 'face' | 'skull'
const BOSS_DEFS = [
  { wave: 5,  hp: 30,  timerSec: 12, speed: 0.9, descent: 0.02, design: 'fortress', pattern: ['scramble(1)'],              prob: 0.6 },
  { wave: 10, hp: 50,  timerSec: 10, speed: 1.0, descent: 0.02, design: 'wing',     pattern: ['blind(2)'],                prob: 0.8 },
  { wave: 15, hp: 70,  timerSec: 10, speed: 1.1, descent: 0.02, design: 'core',     pattern: ['scramble(2)'],             prob: 1.0 },
  { wave: 20, hp: 100, timerSec: 8,  speed: 1.2, descent: 0.02, design: 'fortress', pattern: ['blind(3)'],                prob: 1.0 },
  { wave: 25, hp: 130, timerSec: 8,  speed: 1.3, descent: 0.02, design: 'wing',     pattern: ['scramble(2)', 'blind(2)'], prob: 1.0 },
  { wave: 30, hp: 160, timerSec: 8,  speed: 1.4, descent: 0.02, design: 'core',     pattern: ['marquee(4)'],              prob: 1.0 },
  { wave: 35, hp: 200, timerSec: 8,  speed: 1.5, descent: 0.02, design: 'fortress', pattern: ['marquee(2)', 'scramble(2)'], prob: 1.0 },
];

function getBossDef(wave) {
  const def = BOSS_DEFS.find(d => d.wave === wave);
  if (def) return def;
  const last = BOSS_DEFS[BOSS_DEFS.length - 1];
  const extra = Math.floor((wave - last.wave) / 5);
  return { ...last, hp: last.hp + extra * 20, speed: Math.min(2.0, last.speed + extra * 0.1) };
}

function getLegacyTimerSec(wave) {
  if (wave <= 3) return 15;
  if (wave <= 7) return 12;
  if (wave <= 10) return 10;
  return 8;
}

function getLegacyQuestionLevels(wave) {
  const maxLevel = Math.min(3, Math.floor((wave - 1) / 5) + 1);
  return Array.from({ length: maxLevel }, (_, index) => index + 1);
}

function createLegacyWaveDef(wave) {
  const quiz = {
    genres: ['mixed'],
    levels: getLegacyQuestionLevels(wave),
    timerSec: getLegacyTimerSec(wave),
  };

  if (wave % 5 === 0) {
    const def = getBossDef(wave);
    return {
      type: 'boss',
      label: `WAVE ${wave}`,
      message: 'WARNING: BOSS WAVE',
      quiz: { ...quiz, timerSec: def.timerSec },
      boss: {
        hp: def.hp,
        maxHp: def.hp,
        width: def.width || 120,
        height: def.height || 80,
        design: def.design || 'fortress',
        speed: def.speed,
        descent: def.descent,
        pattern: def.pattern,
        patternProb: def.prob,
      },
    };
  }

  const cols = Math.min(8, 5 + Math.floor(wave / 2));
  const rows = Math.min(5, 3 + Math.floor(wave / 3));
  return {
    type: 'normal',
    label: `WAVE ${wave}`,
    message: `WAVE ${wave}`,
    quiz,
    enemies: {
      cols,
      rows,
      speed: 0.3 + wave * 0.05,
      descent: 0.05 + wave * 0.01,
    },
  };
}

function clamp(value, min, max) {
  if (typeof min === 'number' && value < min) return min;
  if (typeof max === 'number' && value > max) return max;
  return value;
}

function resolveCurve(curve, context) {
  if (!curve) return undefined;
  if (typeof curve === 'number') return curve;

  let value;
  switch (curve.type) {
    case 'constant':
      value = curve.value;
      break;
    case 'linear':
      value = (curve.base || 0)
        + context.wave * (curve.perWave || 0)
        + context.bossIndex * (curve.perBoss || 0);
      break;
    case 'step':
      value = (curve.base || 0) + Math.floor(context.wave / curve.every) * (curve.add || 0);
      break;
    case 'stepValue': {
      const values = [...(curve.values || [])].sort((a, b) => a.minWave - b.minWave);
      const matched = values.filter(item => context.wave >= item.minWave).pop();
      value = matched?.value;
      break;
    }
    default:
      value = curve.value;
      break;
  }

  return clamp(value, curve.min, curve.max);
}

function cloneDef(def) {
  return structuredClone(def);
}

function formatWaveMessage(message, wave) {
  return typeof message === 'string' ? message.replaceAll('{wave}', String(wave)) : message;
}

function getLevelsForWave(quiz = {}, wave) {
  if (Array.isArray(quiz.levels) && quiz.levels.length > 0) return quiz.levels;
  const levelsByWave = quiz.levelsByWave || [];
  const matched = levelsByWave.find(item => wave <= item.maxWave);
  return Array.isArray(matched?.levels) && matched.levels.length > 0 ? matched.levels : [1];
}

function pickByIndex(items, index) {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  return items[index % items.length];
}

function pickBossPattern(patterns = [], bossIndex) {
  return patterns
    .filter(item => bossIndex >= item.minBoss)
    .pop();
}

function resolveInfinityWaveDef(template, context) {
  const waveDef = cloneDef(template);
  waveDef.message = formatWaveMessage(waveDef.message, context.wave);

  if (waveDef.quiz) {
    const timerSec = waveDef.quiz.timerSec ?? resolveCurve(waveDef.quiz.timerCurve, context);
    waveDef.quiz = {
      genres: waveDef.quiz.genres,
      levels: getLevelsForWave(waveDef.quiz, context.wave),
      timerSec,
    };
  }

  if (waveDef.enemies) {
    const enemies = waveDef.enemies;
    waveDef.enemies = {
      cols: enemies.cols ?? Math.round(resolveCurve(enemies.colsCurve, context)),
      rows: enemies.rows ?? Math.round(resolveCurve(enemies.rowsCurve, context)),
      speed: enemies.speed ?? resolveCurve(enemies.speedCurve, context),
      descent: enemies.descent ?? resolveCurve(enemies.descentCurve, context),
      mobs: enemies.mobs,
    };
  }

  if (waveDef.boss) {
    const boss = waveDef.boss;
    const pattern = pickBossPattern(boss.patterns, context.bossIndex);
    waveDef.boss = {
      hp: boss.hp ?? Math.round(resolveCurve(boss.hpCurve, context)),
      width: boss.width || 120,
      height: boss.height || 80,
      speed: boss.speed ?? resolveCurve(boss.speedCurve, context),
      descent: boss.descent ?? 0.02,
      design: boss.design || pickByIndex(boss.designs, context.bossIndex - 1) || 'fortress',
      pattern: boss.pattern || pattern?.pattern,
      patternProb: boss.patternProb ?? pattern?.patternProb ?? 1,
    };
  }

  return waveDef;
}

function getRulePriority(rule) {
  return rule.priority ?? rule.every ?? 0;
}

function findInfinityRule(stage, wave) {
  return (stage.rules || [])
    .filter(rule => rule.every && wave % rule.every === 0)
    .sort((a, b) => getRulePriority(b) - getRulePriority(a))[0];
}

function createInfinityWaveDef(stage, wave) {
  const template = stage.exactWaves?.[wave] || findInfinityRule(stage, wave) || stage.defaultWave;
  const bossEvery = template?.type === 'boss' ? (template.every || stage.rules?.find(rule => rule.type === 'boss')?.every || 5) : 5;
  const context = {
    wave,
    bossIndex: Math.max(1, Math.floor(wave / bossEvery)),
  };
  return resolveInfinityWaveDef(template, context);
}

function getAnswerResult(ratio) {
  if (ratio <= 0) return 'miss';
  if (ratio >= 0.9) return 'ace';
  if (ratio >= 2 / 3) return 'perfect';
  if (ratio >= 1 / 3) return 'great';
  return 'hit';
}

// ========== ユーティリティ ==========
function rand(min, max) { return Math.random() * (max - min) + min; }

// ========== 背景の星 ==========
class Star {
  constructor() { this.reset(true); }
  reset(initial = false) {
    this.x = Math.random() * CW;
    this.y = initial ? Math.random() * CH : -2;
    this.speed = rand(0.2, 0.8);
    this.size = rand(0.5, 2);
    this.brightness = rand(0.3, 0.9);
  }
  update() { this.y += this.speed; if (this.y > CH) this.reset(); }
  draw(ctx) {
    ctx.fillStyle = `rgba(255,255,255,${this.brightness})`;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

// ========== パーティクル ==========
class Particle {
  constructor(x, y, color, sizeMin = 2, sizeMax = 5) {
    this.x = x; this.y = y;
    this.vx = rand(-3, 3); this.vy = rand(-3, 3);
    this.life = 1; this.decay = rand(0.02, 0.05);
    this.size = rand(sizeMin, sizeMax); this.color = color;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; this.vx *= 0.97; this.vy *= 0.97; }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// ========== 砲弾（ランク別グラフィック）==========
class Bullet {
  constructor(sx, sy, tx, ty, rank, power = 1, sizeScale = 1) {
    this.x = sx; this.y = sy;
    this.rank = rank || 1;
    this.power = power;
    this.sizeScale = sizeScale;
    this.glowScale = sizeScale > 1 ? 1.6 : 1;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = [10, 11, 13, 14][this.rank - 1] || 10;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
    this.alive = true;
    this.trail = [];
    this.age = 0;
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    const maxTrail = [6, 8, 10, 12][this.rank - 1] || 6;
    if (this.trail.length > maxTrail) this.trail.shift();
    this.x += this.vx;
    this.y += this.vy;
    this.age++;
    if (this.y < -20 || this.y > CH + 20) this.alive = false;
  }

  draw(ctx) {
    switch (this.rank) {
      case 2: this._drawMissile(ctx); break;
      case 3: this._drawBeam(ctx); break;
      case 4: this._drawNova(ctx); break;
      default: this._drawLaser(ctx); break;
    }
  }

  // ランク1: 緑レーザー
  _drawLaser(ctx) {
    const scale = this.sizeScale;
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.5;
      ctx.fillStyle = `rgba(0,255,136,${a})`;
      const s = (2 + (i / this.trail.length) * 2) * scale;
      ctx.fillRect(this.trail[i].x - s / 2, this.trail[i].y - s / 2, s, s);
    }
    ctx.save();
    ctx.shadowBlur = 8 * this.glowScale; ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(this.x - 2 * scale, this.y - 4 * scale, 4 * scale, 8 * scale);
    ctx.restore();
  }

  // ランク2: ミサイル（煙の尾 + オレンジ）
  _drawMissile(ctx) {
    const scale = this.sizeScale;
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.35;
      const s = (2 + (i / this.trail.length) * 4) * scale;
      ctx.fillStyle = `rgba(180,180,180,${a})`;
      ctx.beginPath();
      ctx.arc(this.trail[i].x + rand(-1, 1), this.trail[i].y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.shadowBlur = 10 * this.glowScale; ctx.shadowColor = '#ff6b35';
    // 本体
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(this.x - 3 * scale, this.y - 6 * scale, 6 * scale, 12 * scale);
    // 弾頭
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.moveTo(this.x - 3 * scale, this.y - 6 * scale);
    ctx.lineTo(this.x, this.y - 11 * scale);
    ctx.lineTo(this.x + 3 * scale, this.y - 6 * scale);
    ctx.fill();
    // フィン
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(this.x - 5 * scale, this.y + 3 * scale, 2 * scale, 3 * scale);
    ctx.fillRect(this.x + 3 * scale, this.y + 3 * scale, 2 * scale, 3 * scale);
    ctx.restore();
  }

  // ランク3: 太いビーム（青白い光線）
  _drawBeam(ctx) {
    const scale = this.sizeScale;
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.5;
      const s = (3 + (i / this.trail.length) * 8) * scale;
      ctx.fillStyle = `rgba(77,150,255,${a})`;
      ctx.fillRect(this.trail[i].x - s / 2, this.trail[i].y - 2 * scale, s, 4 * scale);
    }
    ctx.save();
    ctx.shadowBlur = 20 * this.glowScale; ctx.shadowColor = '#4d96ff';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#4d96ff';
    ctx.fillRect(this.x - 8 * scale, this.y - 4 * scale, 16 * scale, 8 * scale);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x - 3 * scale, this.y - 8 * scale, 6 * scale, 16 * scale);
    ctx.restore();
  }

  // ランク4: 超兵器（紫のエネルギー弾）
  _drawNova(ctx) {
    const scale = this.sizeScale;
    for (let i = 0; i < this.trail.length; i++) {
      const t = i / this.trail.length;
      const a = t * 0.75;
      const s = (6 + t * 18) * scale;
      ctx.fillStyle = `rgba(204,101,254,${a})`;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,217,61,${a * 0.45})`;
      ctx.fillRect(this.trail[i].x - s / 2, this.trail[i].y - 1, s, 2);
      ctx.fillRect(this.trail[i].x - 1, this.trail[i].y - s / 2, 2, s);
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.age * 0.18);
    ctx.shadowBlur = 32 * this.glowScale; ctx.shadowColor = '#ff6bff';

    // 爆心の外側に走る十字閃光
    const pulse = Math.sin(this.age * 0.35);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ff6bff';
    ctx.fillRect((-18 - pulse * 2) * scale, -2 * scale, (36 + pulse * 4) * scale, 4 * scale);
    ctx.fillRect(-2 * scale, (-18 - pulse * 2) * scale, 4 * scale, (36 + pulse * 4) * scale);

    // 外輪
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#cc65fe';
    ctx.beginPath();
    ctx.arc(0, 0, (17 + pulse * 3) * scale, 0, Math.PI * 2);
    ctx.fill();

    // 二重リング
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ff6bff';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(0, 0, (11 + Math.sin(this.age * 0.5) * 3) * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(0, 0, (20 - Math.sin(this.age * 0.4) * 2) * scale, 0, Math.PI * 2);
    ctx.stroke();

    // コア
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.arc(0, 0, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ========== メインゲームクラス ==========
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = CW;
    this.canvas.height = CH;

    this.state = 'title';
    this.score = 0;
    this.combo = 0;
    this.weaponRankIndex = 0;
    this.comboSinceRankUp = 0;
    this.wave = 1;
    this.stageId = 's01';
    this.selectedStageId = this.stageId;
    this.currentWaveDef = null;
    this.stars = Array.from({ length: 60 }, () => new Star());
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.frameCount = 0;

    this.formX = 0; this.formY = 0;
    this.formDir = 1; this.formSpeed = 0.3;
    this.descentSpeed = 0.08;

    this.shakeTimer = 0; this.shakeIntensity = 0;
    this.waveMsg = ''; this.waveMsgTimer = 0;
    this.powerUpMsg = ''; this.powerUpTimer = 0;
    this.timingResult = null; this.timingResultTimer = 0;
    this.chargeReady = false;
    this.chargeActive = false;
    this.chargeFlashTimer = 0;
    this.dyingTimer = 0;
    this.stageStartTime = 0;
    this.stageClearTimer = 0;
    this.stageClearPlayerY = PLAYER_Y;
    this.stageClearElapsedMs = 0;
    this.stageClearTitle = '';
    this.stageClearSubMessage = '';
    this.backgroundTransition = null;
    this.readyMsg = ''; this.readyMsgTimer = 0;
    this.bossAttackIncoming = false;
    this.centerShot = null;
    this.dodgeTimer = 0;
    this.dodgeTimerMax = 30;
    this.dangerBoostUsed = false;
    this.pauseTimeouts = [];
    this.pausedFromState = null;

    // 自機アニメーション
    this.playerOffsetX = 0;
    this.playerOffsetY = 0;
    this.playerTargetX = 0;
    this.playerTargetY = 0;
    this.playerReturnTimer = 0;
    this.playerRotation = 0;
    this.playerSpinTimer = 0;

    // UI
    this.scoreEl = document.getElementById('score');
    this.waveEl = document.getElementById('wave');
    this.comboEl = document.getElementById('combo');
    this.weaponEl = document.getElementById('weapon');
    this.pauseBtn = document.getElementById('pause-btn');
    this.titleOverlay = document.getElementById('title-overlay');
    this.titleScreen = document.getElementById('title-screen');
    this.stageSelectScreen = document.getElementById('stage-select-screen');
    this.stageGridEl = document.getElementById('stage-grid');
    this.stageConfirmBtn = document.getElementById('stage-confirm');
    this.stageSelectedDescriptionEl = document.getElementById('stage-selected-description');
    this.stageSelectedMetaEl = document.getElementById('stage-selected-meta');
    this.stageSelectedBestEl = document.getElementById('stage-selected-best');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.flashOverlay = document.getElementById('flash-overlay');
    this.resultTitleEl = document.getElementById('result-title');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalWaveEl = document.getElementById('final-wave');

    this.quiz = new QuizManager({
      onCorrect: (ratio) => this._onCorrect(ratio),
      onWrong: () => this._onWrong(),
      onTimeUp: () => this._onWrong(),
      onInput: (dir) => this._onPlayerInput(dir),
      onAnswerResolved: (correct, gaugeRatio) => {
        if (!correct || getAnswerResult(gaugeRatio) === 'miss' || !this.centerShot) return;
        this.centerShot = null;
        this.powerUpMsg = 'BLOCK!';
        this.powerUpTimer = 45;
        this._trackEvent('boss_block');
      },
    });

    this._bindEvents();
    this._renderStageSelect();
    this._updatePauseButton();
    this._gameLoop();
  }

  _bindEvents() {
    const advanceHandler = (e) => {
      if (this.state === 'title') { e.preventDefault(); this._showStageSelect(); }
      else if (this.state === 'stageSelect') { e.preventDefault(); this._confirmStageSelection(); }
      else if (this.state === 'gameover') { e.preventDefault(); this._resetToTitle(); }
      else if (this.state === 'stageClear' && this.stageClearTimer >= 120) { e.preventDefault(); this._resetToTitle(); }
    };
    const overlayHandler = (e) => {
      if (this.state === 'title') { e.preventDefault(); this._showStageSelect(); }
      else if (this.state === 'gameover') { e.preventDefault(); this._resetToTitle(); }
      else if (this.state === 'stageClear' && this.stageClearTimer >= 120) { e.preventDefault(); this._resetToTitle(); }
    };
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') advanceHandler(e); });
    document.getElementById('game-container').addEventListener('click', (e) => {
      if (this.state === 'stageClear' && this.stageClearTimer >= 120) { e.preventDefault(); this._resetToTitle(); }
    });
    document.addEventListener('keydown', (e) => {
      if (this.state === 'stageSelect' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this._moveStageSelection(e.key);
        return;
      }
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this._togglePause();
      }
    });
    document.addEventListener('keydown', (e) => this._handleDebugKey(e));
    this.pauseBtn.addEventListener('click', () => this._togglePause());
    this.titleOverlay.addEventListener('click', overlayHandler);
    this.stageConfirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._confirmStageSelection();
    });
    this.gameoverOverlay.addEventListener('click', overlayHandler);
  }

  _setGameTimeout(callback, delay) {
    const entry = {
      callback,
      remaining: delay,
      startedAt: Date.now(),
      id: null,
    };
    const run = () => {
      this.pauseTimeouts = this.pauseTimeouts.filter(t => t !== entry);
      callback();
    };
    entry.id = setTimeout(run, delay);
    this.pauseTimeouts.push(entry);
    return entry;
  }

  _clearGameTimeouts() {
    for (const entry of this.pauseTimeouts) clearTimeout(entry.id);
    this.pauseTimeouts = [];
  }

  _pauseGameTimeouts() {
    const now = Date.now();
    for (const entry of this.pauseTimeouts) {
      clearTimeout(entry.id);
      entry.remaining = Math.max(0, entry.remaining - (now - entry.startedAt));
      entry.id = null;
    }
  }

  _resumeGameTimeouts() {
    for (const entry of [...this.pauseTimeouts]) {
      entry.startedAt = Date.now();
      entry.id = setTimeout(() => {
        this.pauseTimeouts = this.pauseTimeouts.filter(t => t !== entry);
        entry.callback();
      }, entry.remaining);
    }
  }

  _togglePause() {
    if (this.state === 'paused') {
      if (this.backgroundTransition) this.backgroundTransition.lastTick = performance.now();
      this.state = this.pausedFromState || 'playing';
      this.pausedFromState = null;
      this.quiz.resume();
      this._resumeGameTimeouts();
      this._updatePauseButton();
      return;
    }
    if (this.state !== 'playing' && this.state !== 'waveTransition') return;
    if (this.backgroundTransition) this.backgroundTransition.lastTick = performance.now();
    this.pausedFromState = this.state;
    this.state = 'paused';
    this.quiz.pause();
    this._pauseGameTimeouts();
    this._updatePauseButton();
  }

  _updatePauseButton() {
    const canPause = this.state === 'playing' || this.state === 'waveTransition' || this.state === 'paused';
    document.getElementById('pause-row').classList.toggle('hidden', !canPause);
    this.pauseBtn.disabled = !canPause;
    this.pauseBtn.textContent = this.state === 'paused' ? '▶' : '⏸';
    this.pauseBtn.setAttribute('aria-label', this.state === 'paused' ? 'Resume' : 'Pause');
  }

  _handleDebugKey(e) {
    if (!DEBUG_SHORTCUTS || this.state !== 'playing' || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'c') {
      if (this.quiz.forceCorrect()) e.preventDefault();
    } else if (key === 'x') {
      if (this.quiz.forceWrong()) e.preventDefault();
    }
  }

  // ========== コンボランク ==========
  _getCurrentRank() {
    return COMBO_RANKS[this.weaponRankIndex];
  }

  _trackEvent(eventName, parameters = {}) {
    const elapsedSeconds = this.stageStartTime > 0
      ? Math.max(0, Math.round((performance.now() - this.stageStartTime) / 1000))
      : 0;
    trackAnalyticsEvent(eventName, {
      stage_id: this.stageId,
      wave_number: this.wave,
      score: this.score,
      weapon_rank: this._getCurrentRank().name.toLowerCase(),
      elapsed_seconds: elapsedSeconds,
      ...parameters,
    });
  }

  _getStageDef() {
    return STAGE_DEFS[this.stageId] || STAGE_DEFS.legacy;
  }

  _getWaveDef() {
    const stage = this._getStageDef();
    const stageWaveDef = stage?.waves?.[this.wave - 1];
    if (stageWaveDef) return stageWaveDef;
    if (stage?.mode === 'infinity' && (stage.defaultWave || stage.rules || stage.exactWaves)) {
      return createInfinityWaveDef(stage, this.wave);
    }
    return createLegacyWaveDef(this.wave);
  }

  _getWaveBackgroundColor(waveDef = this._getWaveDef()) {
    return waveDef.backgroundColor || this._getStageDef().backgroundColor || '#0a0a1a';
  }

  _getCurrentBackgroundColor() {
    const transition = this.backgroundTransition;
    if (!transition) return this._getWaveBackgroundColor();
    const ratio = Math.min(1, transition.elapsedMs / transition.durationMs);
    return mixHexColors(transition.fromColor, transition.toColor, ratio);
  }

  _startBackgroundTransition(fromColor, toColor) {
    if (fromColor === toColor) {
      this.backgroundTransition = null;
      return;
    }
    this.backgroundTransition = {
      fromColor,
      toColor,
      durationMs: WAVE_BACKGROUND_FADE_MS,
      elapsedMs: 0,
      lastTick: performance.now(),
    };
  }

  _updateBackgroundTransition() {
    const transition = this.backgroundTransition;
    if (!transition) return;
    const now = performance.now();
    transition.elapsedMs += Math.max(0, now - transition.lastTick);
    transition.lastTick = now;
    if (transition.elapsedMs >= transition.durationMs) this.backgroundTransition = null;
  }

  _getWaveMessage(waveDef = this._getWaveDef()) {
    return waveDef.message || (waveDef.type === 'boss' ? 'WARNING: BOSS WAVE' : `WAVE ${this.wave}`);
  }

  _getWaveLabel() {
    const stage = this._getStageDef();
    if (stage.mode === 'infinity') return `WAVE ${this.wave}/INF`;
    const totalWaves = stage.waves?.length;
    return totalWaves ? `WAVE ${this.wave}/${totalWaves}` : `WAVE ${this.wave}`;
  }

  _getSelectableStages() {
    return this._getStageEntries()
      .filter(([id]) => this._isStageUnlocked(id));
  }

  _getStageEntries() {
    return Object.entries(STAGE_DEFS)
      .filter(([, stage]) => stage.selectable === true && Number.isInteger(stage.slot))
      .sort((a, b) => a[1].slot - b[1].slot);
  }

  _isStageUnlocked(stageId) {
    const stage = STAGE_DEFS[stageId];
    if (!stage || stage.selectable !== true || !Number.isInteger(stage.slot)) return false;
    if (!stage.unlockAfter) return true;
    return this._isStageCleared(stage.unlockAfter);
  }

  _getStageMeta(stage) {
    if (stage.mode === 'infinity') return 'WAVES: INF';
    return `WAVES: ${stage.waves?.length ?? 0}`;
  }

  _getStageHiScoreKey(stageId = this.stageId) {
    return `quizshoot_hi_${stageId}`;
  }

  _getStageHiScore(stageId = this.stageId) {
    return parseInt(localStorage.getItem(this._getStageHiScoreKey(stageId)) || '0', 10);
  }

  _saveStageHiScore(stageId = this.stageId) {
    const stored = this._getStageHiScore(stageId);
    const isNewRecord = this.score > stored;
    if (isNewRecord) localStorage.setItem(this._getStageHiScoreKey(stageId), String(this.score));
    return {
      hiScore: isNewRecord ? this.score : stored,
      isNewRecord,
    };
  }

  _getStageClearKey(stageId = this.stageId) {
    return `quizshoot_clear_${stageId}`;
  }

  _isStageCleared(stageId) {
    return localStorage.getItem(this._getStageClearKey(stageId)) === '1';
  }

  _saveStageClear(stageId = this.stageId) {
    localStorage.setItem(this._getStageClearKey(stageId), '1');
  }

  _renderStageSelect() {
    this.stageGridEl.replaceChildren();

    for (const [stageId, stage] of this._getStageEntries()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stage-cell';

      const isUnlocked = this._isStageUnlocked(stageId);
      const isHiddenSecret = stage.hiddenUntilUnlocked && !isUnlocked;
      const isConcealed = !isUnlocked && !isHiddenSecret;

      if (isHiddenSecret) {
        btn.disabled = true;
        btn.classList.add('locked', 'secret');
        btn.setAttribute('aria-label', '未解放のシークレットステージ');
      } else if (isConcealed) {
        const mainEl = document.createElement('span');
        mainEl.className = 'stage-cell-main';

        const noEl = document.createElement('span');
        noEl.className = 'stage-cell-no';
        noEl.textContent = stage.displayNo || String(stage.slot).padStart(2, '0');
        mainEl.appendChild(noEl);

        const nameEl = document.createElement('span');
        nameEl.className = 'stage-cell-name stage-cell-name-concealed';
        nameEl.textContent = '???';
        mainEl.appendChild(nameEl);
        btn.appendChild(mainEl);
        btn.disabled = true;
        btn.classList.add('locked', 'concealed');
        btn.setAttribute('aria-label', `Stage ${stage.displayNo || stage.slot} 未解放`);
      } else {
        const mainEl = document.createElement('span');
        mainEl.className = 'stage-cell-main';

        const noEl = document.createElement('span');
        noEl.className = 'stage-cell-no';
        noEl.textContent = stage.displayNo || String(stage.slot).padStart(2, '0');
        mainEl.appendChild(noEl);

        const nameEl = document.createElement('span');
        nameEl.className = 'stage-cell-name';
        nameEl.textContent = stage.subtitle || stage.label || stageId;
        mainEl.appendChild(nameEl);
        btn.appendChild(mainEl);

        if (stage.mode !== 'infinity' && this._isStageCleared(stageId)) {
          const clearEl = document.createElement('span');
          clearEl.className = 'stage-cell-clear';
          clearEl.textContent = 'CLEAR';
          btn.appendChild(clearEl);
          btn.classList.add('cleared');
        }

        btn.dataset.stageId = stageId;
        btn.setAttribute('aria-label', `${stage.label} ${stage.subtitle || ''}`.trim());
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._selectStage(stageId);
        });
      }

      this.stageGridEl.appendChild(btn);
    }

    if (!this._isStageUnlocked(this.selectedStageId)) {
      const firstUnlocked = this._getSelectableStages()[0];
      if (firstUnlocked) this.selectedStageId = firstUnlocked[0];
    }
    this._selectStage(this.selectedStageId);
  }

  _selectStage(stageId) {
    const stage = STAGE_DEFS[stageId];
    if (!stage || !Number.isInteger(stage.slot)) return;
    if (!this._isStageUnlocked(stageId)) return;

    this.selectedStageId = stageId;
    for (const btn of this.stageGridEl.querySelectorAll('.stage-cell')) {
      btn.classList.toggle('selected', btn.dataset.stageId === stageId);
    }

    this.stageSelectedDescriptionEl.textContent = stage.description || '';
    this.stageSelectedMetaEl.textContent = this._getStageMeta(stage);
    this.stageSelectedBestEl.textContent = `BEST SCORE: ${this._getStageHiScore(stageId)}`;
    this._restartStageConfirmAnimation();
  }

  _restartStageConfirmAnimation() {
    this.stageConfirmBtn.style.animation = 'none';
    void this.stageConfirmBtn.offsetWidth;
    this.stageConfirmBtn.style.removeProperty('animation');
  }

  _moveStageSelection(key) {
    const selectable = this._getSelectableStages();
    const current = STAGE_DEFS[this.selectedStageId];
    if (!current || selectable.length === 0) return;

    const currentIndex = selectable.findIndex(([id]) => id === this.selectedStageId);
    const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    const nextIndex = Math.max(0, Math.min(selectable.length - 1, currentIndex + direction));
    const next = selectable[nextIndex];

    if (next) this._selectStage(next[0]);
  }

  _showStageSelect() {
    this.state = 'stageSelect';
    this.titleScreen.classList.add('screen-hidden');
    this.stageSelectScreen.classList.remove('screen-hidden');
    this._selectStage(this.selectedStageId);
    this._updatePauseButton();
  }

  _confirmStageSelection() {
    if (this.state !== 'stageSelect') return;
    if (!STAGE_DEFS[this.selectedStageId]) return;
    if (!this._isStageUnlocked(this.selectedStageId)) return;
    this.stageId = this.selectedStageId;
    this._startGame();
  }

  // ========== ターゲット検索（下から順に複数体）==========
  _findTargets(count) {
    const alive = this.enemies.filter(e => e.alive);
    // ボスがいる場合は、ボスのオブジェクトを攻撃回数分だけ配列にして返す（全弾ボスに集中）
    const boss = alive.find(e => e.isBoss);
    if (boss) {
      return Array(count).fill(boss);
    }
    alive.sort((a, b) => {
      const ay = this.formY + a.row * (ENEMY_H + ENEMY_GAP_Y);
      const by = this.formY + b.row * (ENEMY_H + ENEMY_GAP_Y);
      if (by !== ay) return by - ay;
      return Math.abs(a.col * (ENEMY_W + ENEMY_GAP_X) - CW / 2)
        - Math.abs(b.col * (ENEMY_W + ENEMY_GAP_X) - CW / 2);
    });
    return alive.slice(0, count);
  }

  // ========== 最も低い敵のY座標 ==========
  _getLowestEnemyY() {
    let maxY = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ey = e.isBoss ? this.formY + e.height : this.formY + e.row * (ENEMY_H + ENEMY_GAP_Y) + ENEMY_H;
      if (ey > maxY) maxY = ey;
    }
    return maxY;
  }

  _getCurrentDescentSpeed() {
    const lowestY = this._getLowestEnemyY();
    const multiplier = lowestY >= DANGER_Y ? DANGER_ZONE_DESCENT_MULT : DANGER_APPROACH_DESCENT_MULT;
    return this.descentSpeed * multiplier;
  }

  _isInDangerZone() {
    return this._getLowestEnemyY() >= DANGER_Y;
  }

  _getEnemyAnimationSpeed(bottomY) {
    if (this.state === 'dying') return ENEMY_ANIM_SPEED_DEFEAT;
    if (bottomY < DANGER_Y) return ENEMY_ANIM_SPEED_MIN;
    return ENEMY_ANIM_SPEED_DANGER;
  }

  // ========== ゲーム進行 ==========
  _startGame() {
    this.state = 'waveTransition';
    this.pausedFromState = null;
    this._clearGameTimeouts();
    this.score = 0; this.combo = 0; this.weaponRankIndex = 0; this.comboSinceRankUp = 0; this.wave = 1;
    this.bullets = []; this.particles = []; this.dyingTimer = 0; this.bossAttackIncoming = false;
    this.stageStartTime = performance.now();
    this.stageClearTimer = 0;
    this.stageClearPlayerY = PLAYER_Y;
    this.stageClearElapsedMs = 0;
    this.stageClearTitle = '';
    this.stageClearSubMessage = '';
    this.backgroundTransition = null;
    this.chargeReady = false;
    this.chargeActive = false;
    this.chargeFlashTimer = 0;
    this._stopShake();
    this.titleOverlay.classList.add('hidden');
    this.gameoverOverlay.classList.add('hidden');
    this._updateUI();
    this._updatePauseButton();
    this._trackEvent('stage_start', {
      wave_count: this._getStageDef().waves?.length || 0,
    });
    this._startWaveSequence();
  }

  _resetToTitle() {
    this.state = 'title';
    this.pausedFromState = null;
    this._clearGameTimeouts();
    this._stopShake();
    this.flashOverlay.style.opacity = 0;
    this.gameoverOverlay.classList.add('hidden');
    this.titleOverlay.classList.remove('hidden');
    this.titleScreen.classList.remove('screen-hidden');
    this.stageSelectScreen.classList.add('screen-hidden');
    this._renderStageSelect();
    this.quiz.reset();
    this._clearChargeEffects();
    this._updatePauseButton();
  }

  _startDying() {
    this.state = 'dying';
    this.pausedFromState = null;
    this._clearGameTimeouts();
    this._clearChargeEffects();
    this._updatePauseButton();
    this.dyingTimer = 90;
    this.quiz.stop();
    this.bullets = [];
    this.centerShot = null;
    this.dodgeTimer = 0;
    this._explode(CW / 2, PLAYER_Y, '#00ff88', 2.5);
    this._explode(CW / 2, PLAYER_Y, '#ff6b35', 2);
    this.shakeTimer = 30; this.shakeIntensity = 12;
    document.getElementById('game-container').classList.add('shake');
    setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 500);
  }

  _stopShake() {
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    document.getElementById('game-container').classList.remove('shake');
  }

  _clearChargeEffects() {
    this.chargeReady = false;
    this.chargeActive = false;
    this.chargeFlashTimer = 0;
  }

  _gameOver() {
    this._stopShake();
    this._clearChargeEffects();
    const { hiScore, isNewRecord } = this._saveStageHiScore();

    this.state = 'gameover';
    this.pausedFromState = null;
    this._clearGameTimeouts();
    this.resultTitleEl.textContent = 'GAME OVER';
    this.finalScoreEl.textContent = `SCORE: ${this.score}`;
    this.finalWaveEl.textContent = `WAVE: ${this.wave}`;
    document.getElementById('final-hiscore').textContent = `BEST SCORE: ${hiScore}`;
    const newRecordEl = document.getElementById('new-record');
    if (isNewRecord) newRecordEl.classList.remove('hidden');
    else newRecordEl.classList.add('hidden');
    this._trackEvent('game_over', { new_record: isNewRecord ? 1 : 0 });
    this.gameoverOverlay.classList.remove('hidden');
    this._updatePauseButton();
  }

  _isStageComplete() {
    const stage = this._getStageDef();
    return stage.mode !== 'infinity'
      && Array.isArray(stage.waves)
      && this.wave >= stage.waves.length;
  }

  _formatElapsedTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  _startStageClear() {
    this._stopShake();
    this._clearChargeEffects();
    this.quiz.stop();
    this.bullets = [];
    this.centerShot = null;
    this.dodgeTimer = 0;
    this.state = 'stageClear';
    this.stageClearTimer = 0;
    this.stageClearPlayerY = PLAYER_Y;
    this.stageClearElapsedMs = performance.now() - this.stageStartTime;
    const stage = this._getStageDef();
    this._saveStageHiScore();
    this._saveStageClear();
    this.stageClearTitle = `${stage.label || 'STAGE'} CLEAR!`;
    this.stageClearSubMessage = stage.clearMessage || `${stage.label || 'STAGE'} CLEAR`;
    this._trackEvent('stage_clear');
    this._updatePauseButton();
  }

  _gameClear() {
    this._stopShake();
    this._clearChargeEffects();
    this.quiz.stop();
    this.bullets = [];
    this.state = 'gameover';
    this.pausedFromState = null;
    this._clearGameTimeouts();

    const stage = this._getStageDef();
    const { hiScore, isNewRecord } = this._saveStageHiScore();

    this.resultTitleEl.textContent = 'GAME CLEAR';
    this.finalScoreEl.textContent = `SCORE: ${this.score}`;
    this.finalWaveEl.textContent = stage.clearMessage || `${stage.label || 'STAGE'} CLEAR`;
    document.getElementById('final-hiscore').textContent = `BEST SCORE: ${hiScore}`;
    const newRecordEl = document.getElementById('new-record');
    if (isNewRecord) newRecordEl.classList.remove('hidden');
    else newRecordEl.classList.add('hidden');
    this.gameoverOverlay.classList.remove('hidden');
    this._updatePauseButton();
  }

  // ========== ウェーブ ==========
  _initWave() {
    const waveDef = this._getWaveDef();
    this.currentWaveDef = waveDef;
    this.enemies = [];
    this.dangerBoostUsed = false;
    let totalW = 0;

    if (waveDef.type === 'boss') {
      const def = waveDef.boss || {};
      const hp = def.hp ?? 30;
      const width = def.width || 120;
      const height = def.height || 80;
      this.enemies.push({
        isBoss: true,
        hp, maxHp: def.maxHp || hp,
        width,
        height,
        design: def.design || 'fortress',
        knockbackPerDamage: def.knockbackPerDamage ?? 0,
        centerShot: def.centerShot || null,
        color: getBossMainColor(def.design || 'fortress'),
        alive: true
      });
      totalW = width;
      this.formSpeed = def.speed ?? 1;
      this.descentSpeed = def.descent ?? 0.02;
    } else {
      const def = waveDef.enemies || {};
      const cols = def.cols ?? Math.min(8, 5 + Math.floor(this.wave / 2));
      const rows = def.rows ?? Math.min(5, 3 + Math.floor(this.wave / 3));
      const mobs = Array.isArray(def.mobs) && def.mobs.length > 0 ? def.mobs : null;
      for (let r = 0; r < rows; r++) {
        const mobId = mobs ? mobs[r % mobs.length] : getMobIdByIndex(r);
        for (let c = 0; c < cols; c++) {
          this.enemies.push({
            isBoss: false, col: c, row: r,
            mobId,
            alive: true,
          });
        }
      }
      totalW = cols * (ENEMY_W + ENEMY_GAP_X) - ENEMY_GAP_X;
      this.formSpeed = def.speed ?? (0.3 + this.wave * 0.05);
      this.descentSpeed = def.descent ?? (0.05 + this.wave * 0.01);
    }

    this.formX = (CW - totalW) / 2;
    this.formY = 20;
    this.centerShot = null;
    this.dodgeTimer = 0;
    this.dodgeTimerMax = 30;
    this.formDir = 1;
    this.waveMsg = this._getWaveMessage(waveDef);
    this.waveMsgTimer = 90;
  }

  _nextWave() {
    const previousBackgroundColor = this._getCurrentBackgroundColor();
    this.wave++;
    this._startBackgroundTransition(previousBackgroundColor, this._getWaveBackgroundColor());
    this.bullets = [];
    this.waveEl.textContent = this._getWaveLabel();
    this.state = 'waveTransition';
    this.waveMsg = this._getWaveMessage();
    this.waveMsgTimer = 90;
    this.timingResultTimer = 0;
    this.quiz.stop();
    this._updatePauseButton();
    this._setGameTimeout(() => {
      if (this.state === 'waveTransition') this._startWaveSequence();
    }, WAVE_BACKGROUND_FADE_MS);
  }

  _clearWave() {
    this._trackEvent('wave_clear', { wave_type: this._getWaveDef().type || 'normal' });
    if (this._isStageComplete()) {
      this._startStageClear();
      return;
    }
    this._nextWave();
  }

  _startWaveSequence() {
    this._initWave();
    const waveDef = this.currentWaveDef || this._getWaveDef();
    this.quiz.setTimerForWave(this.wave);
    this.quiz.setQuestionFilter(waveDef.quiz || {
      genres: ['mixed'],
      levels: [1],
      timerSec: this.quiz.timerMax,
    });
    this.quiz.pendingBossPattern = this._calcPattern(); // Q1のパターン（インジケーターは出さない）
    this.bossAttackIncoming = null;
    this.quiz.showQuestionPreview();
    this.waveMsgTimer = 200; // GET+READY 中は表示し続ける
    this.readyMsg = 'GET';
    this.readyMsgTimer = 60;

    this._updatePauseButton();
    this._setGameTimeout(() => {
      if (this.state !== 'waveTransition') return;
      this.readyMsg = 'READY';
      this.readyMsgTimer = 60;
    }, 1000);

    this._setGameTimeout(() => {
      if (this.state !== 'waveTransition') return;
      this.readyMsg = 'GO!';
      this.readyMsgTimer = 42;
      this.waveMsgTimer = 42; // GO! と同タイミングでフェードアウト
    }, 2000);

    this._setGameTimeout(() => {
      if (this.state !== 'waveTransition') return;
      this.quiz.activateQuestion();
      this.state = 'playing';
      this.readyMsg = '';
      this.waveMsgTimer = 0;
      this._startCenterShotForQuestion();
      this._applyNextPattern();
      this._updatePauseButton();
    }, 2700);
  }

  // ========== クイズコールバック ==========
  _onCorrect(gaugeRatio) {
    const grade = getAnswerResult(gaugeRatio);

    if (grade === 'miss') {
      this._onWrong();
      return;
    }

    // killCount は回答前のランクで決定する
    const currentRank = this._getCurrentRank();
    const rankNum = this.weaponRankIndex + 1;
    const isCharged = this.chargeReady;

    // コンボ・ランク更新
    const prevRankIdx = this.weaponRankIndex;
    this.combo++;
    this.comboSinceRankUp++;
    if (this.combo % 5 === 0) {
      this.chargeReady = true;
      this.chargeActive = true;
    }
    if (this.comboSinceRankUp >= currentRank.comboToNext && this.weaponRankIndex < COMBO_RANKS.length - 1) {
      this.weaponRankIndex++;
      this.comboSinceRankUp = 0;
    }

    if (this.weaponRankIndex > prevRankIdx) {
      this.powerUpMsg = `POWER UP! ▸ ${this._getCurrentRank().name}`;
      this.powerUpTimer = 75;
    }

    // 砲弾発射（マシンガン）
    const baseKillCount = currentRank.killCounts[grade];
    const hasBoss = this.enemies.some(e => e.alive && e.isBoss);
    const dangerBoost = this._isInDangerZone() && !this.dangerBoostUsed;
    const dangerAttackBonus = dangerBoost ? DANGER_ATTACK_BONUS_BY_RANK[this.weaponRankIndex] : 0;
    const killCount = hasBoss
      ? baseKillCount
      : (baseKillCount + dangerAttackBonus) * (isCharged ? 2 : 1);
    const bulletPower = (hasBoss && isCharged ? 2 : 1) + (hasBoss ? dangerAttackBonus : 0);
    const bulletSizeScale = isCharged ? (hasBoss ? 3 : 2) : 1;
    const targets = this._findTargets(killCount);
    if (dangerBoost) this.dangerBoostUsed = true;
    if (isCharged) {
      this.chargeReady = false;
      this.chargeActive = false;
      this.chargeFlashTimer = 10;
      this.shakeTimer = Math.max(this.shakeTimer, 10);
      this.shakeIntensity = Math.max(this.shakeIntensity, 5);
    }
    for (let i = 0; i < targets.length; i++) {
      this._setGameTimeout(() => {
        if (this.state !== 'playing') {
          return;
        }
        const t = targets[i];
        if (!t.alive) {
          return;
        }
        const tx = t.isBoss
          ? this.formX + t.width / 2 + rand(-30, 30)
          : this.formX + t.col * (ENEMY_W + ENEMY_GAP_X) + ENEMY_W / 2;
        const ty = t.isBoss
          ? this.formY + t.height / 2 + rand(-20, 20)
          : this.formY + t.row * (ENEMY_H + ENEMY_GAP_Y) + ENEMY_H / 2;
        this.bullets.push(new Bullet(CW / 2, PLAYER_Y, tx, ty, rankNum, bulletPower, bulletSizeScale));
      }, i * 80);
    }

    // スコア
    this.score += Math.floor(100 * this.combo * SCORE_MULTIPLIER[grade]);

    // タイミング結果表示
    this.timingResult = { grade, weaponName: currentRank.name, killCount, dangerBoost };
    this.timingResultTimer = 45;

    this._updateUI();
    this._scheduleNextQuestion(150);
  }

  _onWrong() {
    const prevRankIdx = this.weaponRankIndex;
    this.combo = 0;
    this.comboSinceRankUp = 0;
    this.chargeReady = false;
    this.chargeActive = false;
    this.chargeFlashTimer = 0;
    this.weaponRankIndex = Math.max(0, this.weaponRankIndex - 2);
    if (this.weaponRankIndex < prevRankIdx) {
      this.powerUpMsg = `POWER DOWN... ▸ ${this._getCurrentRank().name}`;
      this.powerUpTimer = 75;
    }
    this.formY += WRONG_ANSWER_DROP;
    this.shakeTimer = 15; this.shakeIntensity = 6;
    document.getElementById('game-container').classList.add('shake');
    setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 350);
    this._updateUI();
    this._scheduleNextQuestion(200);
  }

  _scheduleNextQuestion(baseDelay) {
    this._setGameTimeout(() => {
      if (this.state !== 'playing') return;
      this.quiz.showQuestion();
      this._startCenterShotForQuestion();
      this._applyNextPattern();
    }, baseDelay);
  }

  _calcPattern() {
    const waveDef = this.currentWaveDef || this._getWaveDef();
    if (waveDef.type !== 'boss') return null;
    const boss = waveDef.boss || {};
    const patternCycle = Array.isArray(boss.patternCycle) ? boss.patternCycle : null;
    let configuredPattern = patternCycle?.length > 0
      ? patternCycle[this.quiz.questionsShown % patternCycle.length]
      : boss.pattern;
    const nextQuestionNumber = this.quiz.questionsShown + 1;
    const centerShotEvery = Math.max(1, boss.centerShot?.everyQuestions ?? 0);
    const latePattern = boss.centerShot?.latePattern;
    if (
      latePattern
      && nextQuestionNumber >= latePattern.fromQuestion
      && nextQuestionNumber % centerShotEvery === 0
    ) {
      configuredPattern = latePattern.pattern;
    }
    if (!Array.isArray(configuredPattern) || configuredPattern.length === 0) return null;
    const patternProb = boss.patternProb ?? 1;
    if (Math.random() >= patternProb) return null;

    const pattern = [...configuredPattern];
    if (boss.blindGrowth) {
      const base = boss.blindGrowth.base ?? 1;
      const every = Math.max(1, boss.blindGrowth.every ?? 2);
      const blindCount = base + Math.floor(this.quiz.questionsShown / every);
      return pattern.map(entry => entry.startsWith('blind') ? `blind(${blindCount})` : entry);
    }
    return pattern;
  }

  _applyNextPattern() {
    const pattern = this._calcPattern();
    this.quiz.pendingBossPattern = pattern;
    this.bossAttackIncoming = pattern;
  }

  _getCenterShotBoss() {
    return this.enemies.find(enemy => enemy.alive && enemy.isBoss && enemy.centerShot) || null;
  }

  _activateDodge() {
    const boss = this._getCenterShotBoss();
    if (!boss) return;
    this.dodgeTimerMax = boss.centerShot.dodgeFrames ?? 30;
    this.dodgeTimer = this.dodgeTimerMax;
  }

  _startCenterShotForQuestion() {
    const boss = this._getCenterShotBoss();
    if (!boss || this.centerShot) return;
    const everyQuestions = Math.max(1, boss.centerShot.everyQuestions ?? 2);
    if (this.quiz.questionsShown % everyQuestions !== 0) return;

    this.centerShot = {
      phase: 'warning',
      timer: boss.centerShot.warningFrames ?? 60,
      travelFrames: Math.max(1, boss.centerShot.travelFrames ?? 45),
      dodgeFrames: Math.max(1, boss.centerShot.dodgeFrames ?? 30),
      trail: [],
    };
  }

  _updateCenterShot() {
    const attack = this.centerShot;
    if (!attack) return;
    const boss = this._getCenterShotBoss();
    if (!boss) {
      this.centerShot = null;
      return;
    }

    if (attack.phase === 'warning') {
      attack.timer--;
      if (attack.timer <= 0) {
        attack.phase = 'shot';
        attack.x = this.formX + boss.width / 2;
        attack.y = this.formY + boss.height * 0.72;
        attack.framesLeft = attack.travelFrames;
        attack.vx = (CW / 2 - attack.x) / attack.travelFrames;
        attack.vy = (PLAYER_Y - attack.y) / attack.travelFrames;
      }
      return;
    }

    attack.trail.push({ x: attack.x, y: attack.y });
    if (attack.trail.length > 10) attack.trail.shift();
    attack.x += attack.vx;
    attack.y += attack.vy;
    attack.framesLeft--;
    if (attack.framesLeft > 0) return;

    const playerX = CW / 2 + this.playerOffsetX;
    const playerY = PLAYER_Y + this.playerOffsetY;
    if (this.dodgeTimer > 0) {
      this.chargeReady = true;
      this.chargeActive = true;
      this.powerUpMsg = 'DODGE! ▸ CHARGE READY';
      this.powerUpTimer = 60;
      this._explode(playerX, playerY, '#00e5ff', 0.8);
      this._trackEvent('boss_dodge');
    } else {
      this.centerShot = null;
      this.dodgeTimer = 0;
      this._startDying();
      return;
    }
    this.dodgeTimer = 0;
    this.centerShot = null;
  }

  _drawCenterShot(ctx) {
    const attack = this.centerShot;
    if (!attack) return;

    ctx.save();
    if (attack.phase === 'warning') {
      const boss = this._getCenterShotBoss();
      if (!boss) {
        ctx.restore();
        return;
      }
      const pulse = 0.55 + Math.sin(this.frameCount * 0.35) * 0.35;
      const startX = this.formX + boss.width / 2;
      const startY = this.formY + boss.height * 0.65;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff315e';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(CW / 2, PLAYER_Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,49,94,0.12)';
      ctx.fillRect(CW / 2 - 22, startY, 44, PLAYER_Y - startY + 18);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CW / 2, PLAYER_Y, 24 + Math.sin(this.frameCount * 0.25) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff6685';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CENTER SHOT', CW / 2, DEFENSE_Y - 40);
      ctx.fillStyle = '#ffd93d';
      ctx.fillText('MISS = GAME OVER', CW / 2, DEFENSE_Y - 18);
    } else {
      for (let i = 0; i < attack.trail.length; i++) {
        const point = attack.trail[i];
        ctx.globalAlpha = (i + 1) / attack.trail.length * 0.45;
        ctx.fillStyle = '#ff315e';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 + i * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#ff315e';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(attack.x, attack.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff315e';
      ctx.lineWidth = 4;
      ctx.stroke();
      if (attack.framesLeft <= attack.dodgeFrames) {
        const dodgePulse = 0.7 + Math.sin(this.frameCount * 0.55) * 0.3;
        ctx.globalAlpha = dodgePulse;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#00e5ff';
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('◀ DODGE NOW! ▶', CW / 2, DEFENSE_Y - 24);
      }
    }
    ctx.restore();
  }

  _drawDodgeState(ctx) {
    if (this.dodgeTimer <= 0) return;
    const ratio = this.dodgeTimer / this.dodgeTimerMax;
    ctx.save();
    ctx.globalAlpha = 0.25 + ratio * 0.5;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CW / 2 + this.playerOffsetX, PLAYER_Y + this.playerOffsetY, 24 + (1 - ratio) * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ========== UI更新 ==========
  _updateUI() {
    this.scoreEl.textContent = `SCORE: ${this.score}`;
    this.waveEl.textContent = this._getWaveLabel();

    const rank = this._getCurrentRank();
    if (this.combo > 0) {
      this.comboEl.textContent = `COMBOx${this.combo}`;
      this.comboEl.classList.remove('hidden');
    } else {
      this.comboEl.classList.add('hidden');
    }

    // 武器ランク表示
    const icons = ['🔫', '🚀', '⚡', '💥'];
    this.weaponEl.textContent = `${icons[this.weaponRankIndex]} ${rank.name}`;
  }

  // ========== エフェクト ==========
  _explode(x, y, color, intensity = 1) {
    const count = Math.floor(15 * intensity);
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, 2 * intensity, 5 * intensity));
    }
    for (let i = 0; i < Math.floor(5 * intensity); i++) {
      this.particles.push(new Particle(x, y, '#ffffff', 1, 3));
    }
  }

  _explodeNova(x, y) {
    this._explode(x, y, '#cc65fe', 2.2);
    this._explode(x, y, '#ffd93d', 1.4);
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(x, y, '#ffffff', 3, 7));
    }
  }

  // ========== 更新処理 ==========
  _update() {
    if (this.state === 'paused') return;

    this._updateBackgroundTransition();
    this.frameCount++;
    for (const s of this.stars) s.update();
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) p.update();

    // 自機アニメーション減衰
    // 自機アニメーション（lerpでターゲットに向かう）
    if (this.playerReturnTimer > 0) {
      this.playerReturnTimer--;
      if (this.playerReturnTimer === 0) {
        this.playerTargetX = 0;
        this.playerTargetY = 0;
      }
    }
    this.playerOffsetX += (this.playerTargetX - this.playerOffsetX) * 0.18;
    this.playerOffsetY += (this.playerTargetY - this.playerOffsetY) * 0.22;
    if (Math.abs(this.playerOffsetX - this.playerTargetX) < 0.5) this.playerOffsetX = this.playerTargetX;
    if (Math.abs(this.playerOffsetY - this.playerTargetY) < 0.5) this.playerOffsetY = this.playerTargetY;
    if (this.playerSpinTimer > 0) {
      this.playerSpinTimer--;
      this.playerRotation = (1 - this.playerSpinTimer / 20) * Math.PI * 2;
    } else {
      this.playerRotation = 0;
    }

    if (this.state === 'dying') {
      this.dyingTimer--;
      if (this.dyingTimer <= 0) this._gameOver();
      return;
    }

    if (this.state === 'stageClear') {
      this.stageClearTimer++;
      if (this.stageClearTimer <= 30) {
        // 前進フェーズ: ゆっくり上へ
        this.stageClearPlayerY -= 1.5;
        this.playerOffsetX = 0;
        this.playerOffsetY = 0;
      } else if (this.stageClearTimer <= 80) {
        // タメフェーズ: 振動
        const t = this.stageClearTimer - 30;
        this.playerOffsetX = Math.sin(t * 2.4) * 4;
        this.playerOffsetY = Math.sin(t * 3.1) * 1.5;
      } else {
        // 飛び立ちフェーズ
        const flyT = this.stageClearTimer - 80;
        this.playerOffsetX *= 0.85;
        this.playerOffsetY *= 0.85;
        this.stageClearPlayerY -= 6 + flyT * 0.15;
      }
      if (this.stageClearTimer > 30 && this.stageClearTimer <= 115 && this.stageClearTimer % 3 === 0) {
        this.particles.push(new Particle(CW / 2 + rand(-8, 8), this.stageClearPlayerY + 18, '#ffd93d', 2, 5));
        this.particles.push(new Particle(CW / 2 + rand(-8, 8), this.stageClearPlayerY + 22, '#ff6b35', 2, 6));
      }
      return;
    }

    if (this.readyMsgTimer > 0) this.readyMsgTimer--;
    if (this.waveMsgTimer > 0) this.waveMsgTimer--;
    if (this.shakeTimer > 0) this.shakeTimer--;

    if (this.state !== 'playing') return;

    if (this.powerUpTimer > 0) this.powerUpTimer--;
    if (this.timingResultTimer > 0) this.timingResultTimer--;
    if (this.chargeFlashTimer > 0) this.chargeFlashTimer--;
    if (this.dodgeTimer > 0) this.dodgeTimer--;
    // 敵の移動
    const aliveEnemies = this.enemies.filter(e => e.alive);
    if (aliveEnemies.length > 0) {
      let leftEdge = CW, rightEdge = 0;
      for (const e of aliveEnemies) {
        const el = e.isBoss ? this.formX : this.formX + e.col * (ENEMY_W + ENEMY_GAP_X);
        const er = e.isBoss ? this.formX + e.width : this.formX + (e.col + 1) * (ENEMY_W + ENEMY_GAP_X);
        if (el < leftEdge) leftEdge = el;
        if (er > rightEdge) rightEdge = er;
      }
      if (rightEdge > CW - 10) this.formDir = -1;
      if (leftEdge < 10) this.formDir = 1;
    }
    this.formX += this.formSpeed * this.formDir;
    this.formY += this._getCurrentDescentSpeed();
    this._updateCenterShot();

    // 砲弾 & 衝突判定
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.update();
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const ex = e.isBoss ? this.formX + e.width / 2 : this.formX + e.col * (ENEMY_W + ENEMY_GAP_X) + ENEMY_W / 2;
        const ey = e.isBoss ? this.formY + e.height / 2 : this.formY + e.row * (ENEMY_H + ENEMY_GAP_Y) + ENEMY_H / 2;
        const hitDistX = e.isBoss ? e.width / 2 + 8 : 16;
        const hitDistY = e.isBoss ? e.height / 2 + 8 : 16;

        if (Math.abs(b.x - ex) < hitDistX && Math.abs(b.y - ey) < hitDistY) {
          if (e.isBoss) {
            const damage = b.rank * b.power;
            e.hp -= damage; // 武器のランクが高いほどボスに大ダメージ
            if (e.knockbackPerDamage > 0) {
              this.formY = Math.max(20, this.formY - damage * e.knockbackPerDamage);
            }
            if (e.hp <= 0) e.alive = false;
          } else {
            e.alive = false;
          }
          b.alive = false;
          if (b.rank >= 4) {
            this._explodeNova(ex, ey);
          } else {
            const intensity = b.rank >= 3 ? 1.5 : 1;
            this._explode(ex, ey, e.color, intensity);
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.alive);

    // 防衛ライン越え → dying 開始
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ey = e.isBoss ? this.formY + e.height : this.formY + e.row * (ENEMY_H + ENEMY_GAP_Y) + ENEMY_H;
      if (ey >= DEFENSE_Y + DEFENSE_BREACH_MARGIN) {
        this._startDying();
        return;
      }
    }

    // ウェーブクリア
    if (this.enemies.every(e => !e.alive)) this._clearWave();
  }

  // ========== 描画処理 ==========
  _render() {
    const ctx = this.ctx;
    let sx = 0, sy = 0;
    if (this.shakeTimer > 0) {
      sx = (Math.random() - 0.5) * this.shakeIntensity;
      sy = (Math.random() - 0.5) * this.shakeIntensity;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // 背景
    ctx.fillStyle = this._getCurrentBackgroundColor();
    ctx.fillRect(-10, -10, CW + 20, CH + 20);
    for (const s of this.stars) s.draw(ctx);

    if (this.state === 'playing' || this.state === 'waveTransition' || this.state === 'paused' || this.state === 'stageClear' || this.state === 'gameover' || this.state === 'dying') {
      // 防衛ライン
      ctx.strokeStyle = 'rgba(0,255,136,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(0, DEFENSE_Y); ctx.lineTo(CW, DEFENSE_Y); ctx.stroke();
      ctx.setLineDash([]);

      // 敵
      const enemyAnimationSpeed = this._getEnemyAnimationSpeed(this._getLowestEnemyY());
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const x = e.isBoss ? this.formX : this.formX + e.col * (ENEMY_W + ENEMY_GAP_X);
        const y = e.isBoss ? this.formY : this.formY + e.row * (ENEMY_H + ENEMY_GAP_Y);
        this._drawEnemy(ctx, e, x, y, enemyAnimationSpeed);
      }

      // 砲弾
      for (const b of this.bullets) b.draw(ctx);
      this._drawCenterShot(ctx);
      // 自機（dying中は爆発済みなので非表示）
      if (this.state === 'stageClear') {
        const boostScale = this.stageClearTimer <= 30
          ? 1
          : this.stageClearTimer <= 80
            ? 1 + ((this.stageClearTimer - 30) / 50) * 2.4
            : 3.6;
        this._drawPlayer(ctx, { y: this.stageClearPlayerY, boostScale });
      } else if (this.state !== 'dying') {
        this._drawPlayer(ctx);
        this._drawDodgeState(ctx);
      }
      // パーティクル
      for (const p of this.particles) p.draw(ctx);

      // === 危険度オーバーレイ（赤） ===
      if (this.state !== 'dying') {
        const lowestY = this._getLowestEnemyY();
        const dangerStart = DANGER_Y;
        const dangerRange = DEFENSE_Y - dangerStart;
        const dangerRatio = Math.max(0, Math.min(1, (lowestY - dangerStart) / dangerRange));
        if (dangerRatio > 0) {
          const dangerPulse = 0.035 * (0.5 + Math.sin(Date.now() / 120) * 0.5);
          const dangerAlpha = 0.08 + dangerRatio * 0.22 + dangerPulse;
          const dangerRed = Math.round(70 + dangerRatio * 130);
          const dangerBlue = Math.round(18 + dangerRatio * 12);
          ctx.fillStyle = `rgba(${dangerRed}, 0, ${dangerBlue}, ${dangerAlpha})`;
          ctx.fillRect(-10, -10, CW + 20, CH + 20);

          const bandY = DEFENSE_Y - 2;
          const bandH = CH - bandY + 10;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, bandY, CW, CH - bandY);
          ctx.clip();
          ctx.fillStyle = `rgba(255, 0, 0, ${0.18 + dangerRatio * 0.18})`;
          ctx.fillRect(0, bandY, CW, bandH);

          const marqueeGap = 188;
          const marqueeSpeed = 0.11;
          const offset = (Date.now() * marqueeSpeed) % marqueeGap;
          ctx.font = '18px "Press Start 2P", monospace';
          ctx.textAlign = 'left';
          ctx.shadowBlur = 16;
          ctx.shadowColor = '#ff4757';
          ctx.fillStyle = 'rgba(255, 71, 87, 0.9)';
          for (let x = CW - offset; x > -marqueeGap; x -= marqueeGap) {
            ctx.fillText('DANGER', x, bandY + bandH / 2);
          }
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      // === dying 演出：強赤オーバーレイ ===
      if (this.state === 'dying') {
        const progress = 1 - this.dyingTimer / 90;
        const alpha = 0.35 + progress * 0.45;
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fillRect(-10, -10, CW + 20, CH + 20);
      }

      // READY / GO!
      if (this.readyMsgTimer > 0 && this.readyMsg) {
        const isGo = this.readyMsg === 'GO!';
        const color = isGo ? '#00ff88' : '#ffd93d';
        const a = Math.min(1, this.readyMsgTimer / 15);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 28; ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.font = `${isGo ? 32 : 24}px "Press Start 2P", monospace`;
        ctx.fillText(this.readyMsg, CW / 2, CH / 2);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // ウェーブメッセージ
      if (this.waveMsgTimer > 0) {
        const a = Math.min(1, this.waveMsgTimer / 30);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#00ff88';
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20; ctx.shadowColor = '#00ff88';
        ctx.fillText(this.waveMsg, CW / 2, 100);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // タイミング結果
      if (this.timingResultTimer > 0 && this.timingResult) {
        const { grade, killCount } = this.timingResult;
        const a = Math.min(1, this.timingResultTimer / 12);
        const gradeColors = { ace: '#cc65fe', perfect: '#ffd93d', great: '#6bcb77', hit: '#aaaacc' };
        const color = gradeColors[grade];
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 24; ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillText(grade.toUpperCase() + '!', CW / 2, CH / 2 - 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillText(`x${killCount} DESTROY`, CW / 2, CH / 2 + 14);
        ctx.restore();
      }

      // ボスアタック予告（常駐インジケーター）
      if (this.bossAttackIncoming) {
        const label = '⚠ NEXT: ' + this.bossAttackIncoming.map(p => p.toUpperCase()).join('+');
        const pulse = 0.55 + Math.sin(Date.now() / 280) * 0.35;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.textAlign = 'right';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff4757';
        ctx.fillStyle = '#ff4757';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillText(label, CW - 8, 18);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      if (this.chargeFlashTimer > 0) {
        const a = this.chargeFlashTimer / 10;
        ctx.save();
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = '#ffd93d';
        ctx.fillRect(-10, -10, CW + 20, CH + 20);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(CW / 2 + this.playerOffsetX, PLAYER_Y + this.playerOffsetY, 28 + (1 - a) * 42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // POWER UP メッセージ
      if (this.powerUpTimer > 0) {
        const a = Math.min(1, this.powerUpTimer / 20);
        const scale = 1 + (1 - Math.min(1, this.powerUpTimer / 15)) * 0.3;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(CW / 2, CH / 2 - 40);
        ctx.scale(scale, scale);
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 25; ctx.shadowColor = '#ffd93d';
        ctx.fillStyle = '#ffd93d';
        ctx.fillText(this.powerUpMsg, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      if (this.chargeActive) {
        const a = 1;
        const pulse = 1 + Math.sin(Date.now() / 80) * 0.06;
        const x = CW / 2 + this.playerOffsetX;
        const y = PLAYER_Y + this.playerOffsetY - 4;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#ffd93d';
        ctx.fillStyle = '#ffd93d';
        ctx.translate(x, y);
        ctx.scale(pulse, pulse);
        ctx.fillText('CHARGE', -64, 0);
        ctx.fillText('OK!', 64, 0);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,217,61,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-28, -2);
        ctx.lineTo(-14, -2);
        ctx.moveTo(28, -2);
        ctx.lineTo(14, -2);
        ctx.stroke();
        ctx.restore();
      }

      // === stageClear: 白フラッシュオーバーレイ（キャンバス + UI全体）===
      if (this.state === 'stageClear') {
        const whiteAlpha = Math.min(1, Math.max(0, (this.stageClearTimer - 80) / 35));
        this.flashOverlay.style.opacity = whiteAlpha;
        if (whiteAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = whiteAlpha;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-10, -10, CW + 20, CH + 20);
          ctx.restore();
        }
      } else {
        this.flashOverlay.style.opacity = 0;
      }

      // === stageClear: リザルトテキスト（白地の上） ===
      if (this.state === 'stageClear') {
        const showText = this.stageClearTimer > 120;
        const a = Math.min(1, Math.max(0, (this.stageClearTimer - 120) / 18));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#005522';
        ctx.font = '18px "Press Start 2P", monospace';
        if (showText) ctx.fillText(this.stageClearTitle, CW / 2, CH / 2 - 6);
        ctx.fillStyle = '#7a5500';
        ctx.font = '10px "Press Start 2P", monospace';
        if (showText) ctx.fillText(this.stageClearSubMessage, CW / 2, CH / 2 + 18);
        ctx.fillStyle = '#222222';
        ctx.font = '9px "Press Start 2P", monospace';
        if (showText) {
          ctx.fillText(`SCORE: ${this.score}`, CW / 2, CH / 2 + 48);
          ctx.fillText(`TIME: ${this._formatElapsedTime(this.stageClearElapsedMs)}`, CW / 2, CH / 2 + 68);
          const blinkOn = Math.floor(Date.now() / 600) % 2 === 0;
          ctx.globalAlpha = a * (blinkOn ? 1 : 0);
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.fillStyle = '#888888';
          ctx.fillText('PRESS BUTTON / TAP TO TITLE', CW / 2, CH / 2 + 92);
        }
        ctx.restore();
      }

      if (this.state === 'paused') {
        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 20, 0.55)';
        ctx.fillRect(-10, -10, CW + 20, CH + 20);
        ctx.textAlign = 'center';
        ctx.shadowBlur = 22;
        ctx.shadowColor = '#00ff88';
        ctx.fillStyle = '#00ff88';
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillText('PAUSE', CW / 2, CH / 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(232,232,240,0.8)';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText('TAP ▶ TO RESUME', CW / 2, CH / 2 + 22);
        ctx.restore();
      }
    }

    // タイトル画面の装飾
    if (this.state === 'title') {
      const t = Date.now() / 1000;
      for (let i = 0; i < 5; i++) {
        const x = CW / 2 + Math.sin(t + i * 1.2) * 100 - ENEMY_W / 2;
        const y = 80 + Math.cos(t * 0.7 + i) * 30;
        this._drawEnemy(ctx, { mobId: getMobIdByIndex(i % ENEMY_SPRITE_COUNT) }, x, y);
      }
    }

    ctx.restore();
  }

  _drawEnemy(ctx, enemy, x, y, animationSpeed = ENEMY_ANIM_SPEED_MIN) {
    if (enemy.isBoss) {
      drawBoss(ctx, enemy, x, y, this.frameCount, animationSpeed);
    } else {
      drawEnemyMob(ctx, enemy, x, y, this.frameCount, animationSpeed);
    }
  }

  _drawPlayer(ctx, options = {}) {
    const hover = options.disableHover ? 0 : Math.sin(Date.now() / 180) * 2;
    const cx = CW / 2 + this.playerOffsetX;
    const cy = (options.y ?? PLAYER_Y) + this.playerOffsetY + hover;
    const boostScale = options.boostScale ?? 1;
    const rank = this.weaponRankIndex + 1;
    const rankColor = ['#00ff88', '#ff6b35', '#4d96ff', '#cc65fe'][rank - 1] || '#00ff88';
    const coreColor = rank >= 4 ? '#ffd93d' : '#b8ffe0';
    const wingSpan = 18 + rank * 3;
    const pulse = Math.sin(Date.now() / 120);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.playerRotation);

    const flame = (4 + rank * 1.5 + Math.sin(Date.now() / 70) * 2 + Math.random() * 2) * boostScale;

    if (rank <= 2) {
      const baseColor = rank === 1 ? '#00ff88' : '#ff6b35';
      const flameColor = rank === 1 ? '#ff6b35' : '#ffd93d';
      ctx.shadowBlur = 10;
      ctx.shadowColor = baseColor;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(-12, 6);
      ctx.lineTo(12, 6);
      ctx.closePath();
      ctx.fill();

      if (rank === 2) {
        ctx.fillRect(-18, 3, 8, 4);
        ctx.fillRect(10, 3, 8, 4);
        ctx.fillRect(-7, 7, 4, 5);
        ctx.fillRect(3, 7, 4, 5);
      }

      ctx.shadowColor = '#ff6b35';
      ctx.fillStyle = flameColor;
      ctx.shadowBlur = 10 + 8 * boostScale;
      ctx.beginPath();
      ctx.moveTo(-5, 6);
      ctx.lineTo(0, 14 + Math.random() * 4 + (rank === 2 ? 3 : 0) + flame);
      ctx.lineTo(5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (rank >= 4) {
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#cc65fe';
      ctx.strokeStyle = 'rgba(204,101,254,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,217,61,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 28 - pulse * 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = 'rgba(255,107,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-30, -2);
      ctx.lineTo(-18, -10);
      ctx.lineTo(-8, -7);
      ctx.moveTo(30, -2);
      ctx.lineTo(18, -10);
      ctx.lineTo(8, -7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Engine glow
    ctx.shadowBlur = 14 + rank * 4;
    ctx.shadowColor = rankColor;
    ctx.fillStyle = rank >= 4 ? 'rgba(204,101,254,0.24)' : 'rgba(0,255,136,0.18)';
    ctx.beginPath();
    ctx.arc(0, 2, 16 + rank * 3, 0, Math.PI * 2);
    ctx.fill();

    // Main silhouette
    ctx.shadowBlur = 9 + rank * 2;
    ctx.shadowColor = rankColor;
    ctx.fillStyle = rankColor;
    ctx.beginPath();
    ctx.moveTo(0, -17 - rank * 2);
    ctx.lineTo(-8, -5);
    ctx.lineTo(-wingSpan, 7);
    ctx.lineTo(-9, 5);
    ctx.lineTo(-5, 14);
    ctx.lineTo(0, 9);
    ctx.lineTo(5, 14);
    ctx.lineTo(9, 5);
    ctx.lineTo(wingSpan, 7);
    ctx.lineTo(8, -5);
    ctx.closePath();
    ctx.fill();

    if (rank >= 4) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ffd93d';
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(-wingSpan - 3, 4, 8, 5);
      ctx.fillRect(wingSpan - 5, 4, 8, 5);
      ctx.fillRect(-2, -30, 4, 9);
    }

    // Inner hull
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(0, -13 - rank);
    ctx.lineTo(-4, -2);
    ctx.lineTo(-3, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(3, 8);
    ctx.lineTo(4, -2);
    ctx.closePath();
    ctx.fill();

    // Cockpit and weapon ports
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#4d96ff';
    ctx.fillStyle = rank >= 4 ? '#ffffff' : '#4d96ff';
    ctx.fillRect(-3, -7, 6, 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(-13, 5, 4, 3);
    ctx.fillRect(9, 5, 4, 3);
    if (rank >= 4) {
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(-1, -5, 2, 3);
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#ffd93d';
      ctx.fillStyle = 'rgba(255,217,61,0.65)';
      ctx.beginPath();
      ctx.arc(0, 0, 8 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thrusters
    ctx.shadowBlur = (10 + rank * 3) * Math.min(2.2, boostScale);
    ctx.shadowColor = rank >= 4 ? '#cc65fe' : '#ff6b35';
    ctx.fillStyle = rank >= 4 ? '#ff6bff' : '#ffd93d';
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.lineTo(-3, 18 + flame);
    ctx.lineTo(0, 10);
    ctx.lineTo(3, 18 + flame);
    ctx.lineTo(7, 10);
    ctx.lineTo(4, 14);
    ctx.lineTo(0, 21 + flame);
    ctx.lineTo(-4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rank >= 3 ? '#ffffff' : '#ff6b35';
    ctx.fillRect(-2, 10, 4, 10 + flame / 2);
    if (rank >= 4) {
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(-9, 11, 3, 8 + flame / 2);
      ctx.fillRect(6, 11, 3, 8 + flame / 2);
    }
    ctx.restore();
  }

  // D-pad入力に連動した自機リアクション（ビジュアルのみ）
  _onPlayerInput(dir) {
    switch (dir) {
      case 'right':
        this.playerTargetX = CW / 2 - 20;
        this.playerReturnTimer = 12;
        this._activateDodge();
        break;
      case 'left':
        this.playerTargetX = -(CW / 2 - 20);
        this.playerReturnTimer = 12;
        this._activateDodge();
        break;
      case 'up':
        this.playerTargetY = -25;
        this.playerReturnTimer = 10;
        break;
      case 'down':
        this.playerTargetY = 16;
        this.playerReturnTimer = 10;
        break;
      case 'center':
        this.playerSpinTimer = 20;
        break;
    }
  }

  _gameLoop() {
    this._update();
    this._render();
    requestAnimationFrame(() => this._gameLoop());
  }
}

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => { new Game(); });
