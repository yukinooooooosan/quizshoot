// infinity_stage_def.js - InfinityモードのWave生成定義
//
// ==========================================
// 【 Infinityモードの設計方針と生成ルール 】
// ==========================================
// 固定Stageのように全Waveを手書きせず、Wave番号から半自動で各Waveの設定(waveDef)を生成します。
// 生成される優先順位は [ exactWaves > rules > defaultWave ] です。
//
// 1. exactWaves:
//    特定のWave番号に対して、完全に固定のWave設定を割り当てます。
//    チュートリアル的な序盤のWaveなどに使います。
//
// 2. rules:
//    複数Waveに適用される条件付きのWave設定の配列です。
//    - every: 倍数条件（例: 5なら「5の倍数のWave」）
//    - priority: 複数ルールが被った場合の優先度（大きい方が優先）。未指定時はeveryの値が優先度扱い。
//
// 3. defaultWave:
//    exactWavesにもrulesにも当てはまらない、基本となる通常のWave設定です。
//
// ==========================================
// 【 waveDef（各Wave設定）の基本形 】
// ==========================================
// {
//   type: 'normal' | 'boss',
//   message: 'WAVE {wave}',
//   quiz: {
//     // genres: 有効な値は ['くだもの', 'いきもの', 'しぜん', 'くらし', 'あそびと文化', 'たべもの', 'からだ', 'がくもん', 'サブカル', 'ちめい', 'げいのう', 'にっち', 'mixed']
//     genres: ['mixed'] | ['サブカル', 'あそびと文化'],
//     levels: [1, 2, 3, 4],
//     timerSec: 12,
//   },
//   enemies: {
//     cols: 5,
//     rows: 3,
//     speed: 0.35,
//     descent: 0.05,
//   },
//   boss: {
//     hp: 30,
//     width: 120,
//     height: 80,
//     speed: 0.9,
//     descent: 0.02,
//     design: 'fortress' | 'wing' | 'core',
//     color: '#ff4757',
//     pattern: ['scramble(1)'],
//     patternProb: 0.6,
//   },
// }
//
// ==========================================
// 【 自動計算式（カーブ・Curve）について 】
// ==========================================
// Infinityモードでは、Waveが進むにつれて難易度を自動で上げるためにカーブ計算が使えます。
// 以下のプロパティ（*Curve）に指定します。
//
// - constant:
//   常に同じ固定値。
//   例: { type: 'constant', value: 5 }
//
// - linear:
//   Wave数（またはBoss数）に比例して増加する。
//   例: { type: 'linear', base: 0.3, perWave: 0.05, max: 2.0 }
//       (base + wave * perWave) を計算し、最大値はmax。
//       ボス用の場合は perBoss も使用可能。
//
// - step:
//   一定Waveごとに階段状に値が増加する。
//   例: { type: 'step', base: 5, every: 2, add: 1, max: 8 }
//       (base + floor(wave / every) * add) を計算。
//
// - stepValue:
//   特定のWaveに到達すると、指定した値にカチッと切り替わる。
//   例: { type: 'stepValue', values: [ { minWave: 1, value: 15 }, { minWave: 4, value: 12 } ] }
//
// ==========================================

export const INFINITY_STAGE_DEF = {
  slot: 25,
  displayNo: '∞',
  label: 'INFINITY',
  subtitle: '無限宙域',
  description: '終わりなき連戦に挑む',
  mode: 'infinity',

  exactWaves: {
    1: {
      type: 'normal',
      message: 'WAVE 1',
      quiz: { genres: ['くだもの', 'たべもの'], levels: [1], timerSec: 15 },
      enemies: { cols: 4, rows: 2, speed: 0.25, descent: 0.02 },
    },
    2: {
      type: 'normal',
      message: 'WAVE 2',
      quiz: { genres: ['いきもの'], levels: [1], timerSec: 15 },
      enemies: { cols: 5, rows: 2, speed: 0.3, descent: 0.03 },
    },
    3: {
      type: 'normal',
      message: 'WAVE 3',
      quiz: { genres: ['からだ', 'くらし'], levels: [1], timerSec: 14 },
      enemies: { cols: 6, rows: 3, speed: 0.35, descent: 0.04 },
    },
    4: {
      type: 'normal',
      message: 'WAVE 4',
      quiz: { genres: ['ちめい'], levels: [1], timerSec: 14 },
      enemies: { cols: 6, rows: 4, speed: 0.4, descent: 0.05 },
    },
  },

  rules: [
    {
      every: 3,
      type: 'normal',
      message: 'EVERY 3 TEST WAVE',
      quiz: { genres: ['あそびと文化'], levels: [1], timerSec: 14 },
      enemies: {
        cols: 3,
        rows: 1,
        speed: 0.35,
        descent: 0.04,
      },
    },
    {
      every: 5,
      priority: 100,
      type: 'boss',
      message: 'WARNING: BOSS WAVE',
      quiz: { genres: ['mixed'], levels: [1, 2], timerSec: 12 },
      boss: {
        hpCurve: { type: 'linear', base: 10, perBoss: 20 },
        speedCurve: { type: 'linear', base: 0.8, perBoss: 0.1, max: 2.0 },
        descent: 0.02,
        width: 120,
        height: 80,
        designs: ['fortress', 'wing', 'core'],
        colors: ['#ff4757', '#4d96ff', '#cc65fe', '#ffd93d', '#6bcb77'],
        patterns: [
          { minBoss: 1, pattern: ['scramble(1)'], patternProb: 0.6 },
          { minBoss: 2, pattern: ['blind(2)'], patternProb: 0.8 },
          { minBoss: 3, pattern: ['scramble(2)'], patternProb: 1 },
          { minBoss: 4, pattern: ['blind(3)'], patternProb: 1 },
          { minBoss: 5, pattern: ['scramble(2)', 'blind(2)'], patternProb: 1 },
          { minBoss: 6, pattern: ['marquee(4)'], patternProb: 1 },
        ],
      },
    },
    {
      every: 12,
      type: 'normal',
      message: 'SUBCULTURE WAVE',
      quiz: { genres: ['サブカル'], levels: [1, 2], timerSec: 12 },
      enemies: {
        colsCurve: { type: 'step', base: 6, every: 4, add: 1, max: 8 },
        rowsCurve: { type: 'step', base: 3, every: 6, add: 1, max: 5 },
        speedCurve: { type: 'linear', base: 0.4, perWave: 0.04, max: 1.4 },
        descentCurve: { type: 'linear', base: 0.05, perWave: 0.008, max: 0.18 },
      },
    },
  ],

  defaultWave: {
    type: 'normal',
    message: 'WAVE {wave}',
    quiz: {
      genres: ['mixed'],
      levelsByWave: [
        { maxWave: 5, levels: [1] },
        { maxWave: 15, levels: [1, 2] },
        { maxWave: Infinity, levels: [1, 2, 3, 4] },
      ],
      timerCurve: {
        type: 'stepValue',
        values: [
          { minWave: 1, value: 15 },
          { minWave: 4, value: 12 },
          { minWave: 8, value: 10 },
          { minWave: 11, value: 8 },
        ],
      },
    },
    enemies: {
      colsCurve: { type: 'step', base: 5, every: 2, add: 1, max: 8 },
      rowsCurve: { type: 'step', base: 3, every: 3, add: 1, max: 5 },
      speedCurve: { type: 'linear', base: 0.3, perWave: 0.05 },
      descentCurve: { type: 'linear', base: 0.05, perWave: 0.01 },
    },
  },
};
