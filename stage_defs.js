// stage_defs.js - ステージ・Wave構成定義
//
// ==========================================
// 【 スキーマ説明（記載ルール）】
// ==========================================
//
// 各ステージは以下のプロパティを持ちます。
// - slot: ステージ選択UI上の枠番号（例: 1）
// - selectable: true のステージだけをステージ選択UIに表示
// - unlockAfter: 指定したstageIdのクリア後に解放
// - hiddenUntilUnlocked: 解放前は名称や番号を伏せたシークレット枠として表示
// - displayNo: ステージ選択UI上の表示番号（例: '01'）
// - label: ステージ番号などの短い表示名（例: 'STAGE 01'）
// - subtitle: ステージのシナリオ名（例: 'くだもの秘密基地'）
// - description: ステージ選択UI向けの短い説明文
// - mode: 'infinity' を指定すると無限モード用の挙動になります。省略時は固定ウェーブ。
// - clearMessage: ステージクリア時に表示する専用メッセージ（固定ステージ用）
// - backgroundColor: 背景色
// - waves: 固定ステージの場合、各Waveの設定を配列で定義します。
//   Wave側の backgroundColor で、そのWaveだけ背景色を上書きできます。
//
// 【 各Wave（waveDef）の基本プロパティ 】
// - type: 'normal'（通常ウェーブ） または 'boss'（ボスウェーブ）
// - message: Wave開始時の画面表示テキスト（例: 'WAVE 1', 'WARNING: BOSS WAVE'）
//
// 【 quiz（クイズ設定）】
// - genres: 出題される問題のジャンル。有効な値は以下の通り（questions.js 参照）
//   ['くだもの', 'いきもの', 'しぜん', 'くらし', 'あそびと文化',
//    'たべもの', 'からだ', 'がくもん', 'サブカル', 'ちめい', 'げいのう', 'にっち', 'mixed']
// - levels: 出題される問題の難易度レベル（例: [1, 2]）
// - timerSec: クイズの制限時間（秒）
//
// 【 enemies（通常ウェーブ時の敵設定）】(type: 'normal' のみ)
// - cols: 敵の列数
// - rows: 敵の行数
// - mobs: 行ごとに出すモブIDの配列（mob_sprites.js 参照）。未指定時はデフォルト順で自動配置。
// - speed: 敵の横移動速度
// - descent: 敵の降下速度
//
// 【 boss（ボスウェーブ時の設定）】(type: 'boss' のみ)
// - hp: ボスの体力
// - width, height: ボスのサイズ
// - speed: ボスの横移動速度
// - descent: ボスの降下速度
// - design: ボスの見た目（'fortress', 'wing', 'core', 'face', 'skull'）
// - pattern: クイズの問題文や文字を隠す特殊攻撃の配列（例: ['scramble(1)', 'blind(2)']）
// - patternCycle: 問題ごとに順番に切り替える特殊攻撃（空配列なら妨害なし）
// - patternProb: 特殊攻撃が発動する確率 (0.0 〜 1.0)
// - blindGrowth: BLINDの隠す文字数を出題数で増やす設定（例: { base: 1, every: 2 }）
// - knockbackPerDamage: 1ダメージごとにボスを上へ押し戻す距離
// - centerShot: 画面中央を狙う攻撃の頻度・予告・弾速・回避受付時間・後半パターン
// ==========================================

import { INFINITY_STAGE_DEF } from './infinity_stage_def.js';

export const STAGE_DEFS = {
  infinity: INFINITY_STAGE_DEF,

  legacy: {
    label: 'LEGACY',
    mode: 'infinity',
  },

  s01: {
    slot: 1,
    selectable: true,
    displayNo: '01',
    label: 'STAGE 01',
    subtitle: 'もぐもぐ秘密基地',
    description: 'くだもの・たべもののやさしい入門ステージ',
    clearMessage: 'MOGUMOGU BASE',
    backgroundColor: '#071824',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['くだもの'], levels: [1], timerSec: 15 },
        enemies: { cols: 4, rows: 2, mobs: ['scout'], speed: 0.35, descent: 0.05 },
      },
      {
        type: 'normal',
        message: 'WAVE 2',
        quiz: { genres: ['たべもの'], levels: [1], timerSec: 15 },
        enemies: { cols: 6, rows: 2, mobs: ['scout', 'drone'], speed: 0.4, descent: 0.055 },
      },
      {
        type: 'boss',
        message: 'WARNING: BOSS WAVE',
        quiz: { genres: ['くだもの', 'たべもの'], levels: [1, 2], timerSec: 14 },
        boss: {
          hp: 60,
          width: 120,
          height: 80,
          speed: 0.6,
          descent: 0.012,
          design: 'fortress',
        },
      },
    ],
  },

  s02: {
    slot: 2,
    selectable: true,
    unlockAfter: 's01',
    displayNo: '02',
    label: 'STAGE 02',
    subtitle: 'どうぶつ観測所',
    description: 'いきもの・しぜんと最初の妨害訓練',
    clearMessage: 'ANIMAL OBSERVATORY',
    backgroundColor: '#081a18',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['いきもの'], levels: [1], timerSec: 15 },
        enemies: { cols: 5, rows: 2, mobs: ['scout'], speed: 0.4, descent: 0.052 },
      },
      {
        type: 'normal',
        message: 'WAVE 2',
        quiz: { genres: ['しぜん'], levels: [1], timerSec: 14 },
        enemies: { cols: 7, rows: 2, mobs: ['scout', 'guard'], speed: 0.46, descent: 0.058 },
      },
      {
        type: 'boss',
        message: 'WARNING: BOSS WAVE',
        quiz: { genres: ['いきもの', 'しぜん'], levels: [1, 2], timerSec: 14 },
        boss: {
          hp: 65,
          width: 120,
          height: 80,
          speed: 0.7,
          descent: 0.014,
          design: 'wing',
          pattern: ['marquee(4)'],
          patternProb: 1,
        },
      },
    ],
  },

  s03: {
    slot: 3,
    selectable: true,
    unlockAfter: 's02',
    displayNo: '03',
    label: 'STAGE 03',
    subtitle: 'からだ整備工場',
    description: 'からだ・くらしの基礎防衛',
    clearMessage: 'BODY FACTORY',
    backgroundColor: '#101522',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['からだ'], levels: [1], timerSec: 14 },
        enemies: { cols: 6, rows: 2, mobs: ['scout', 'guard'], speed: 0.44, descent: 0.056 },
      },
      {
        type: 'normal',
        message: 'WAVE 2',
        quiz: { genres: ['くらし'], levels: [1], timerSec: 14 },
        enemies: { cols: 4, rows: 4, mobs: ['scout', 'guard', 'drone', 'guard'], speed: 0.5, descent: 0.062 },
      },
      {
        type: 'boss',
        message: 'WARNING: MINI BOSS',
        quiz: { genres: ['からだ', 'くらし'], levels: [1], timerSec: 14 },
        boss: {
          hp: 20,
          width: 96,
          height: 64,
          speed: 0.75,
          descent: 0.075,
          design: 'core',
        },
      },
      {
        type: 'boss',
        message: 'WARNING: BOSS WAVE',
        quiz: { genres: ['からだ', 'くらし'], levels: [1, 2], timerSec: 14 },
        boss: {
          hp: 70,
          width: 120,
          height: 80,
          speed: 0.8,
          descent: 0.016,
          design: 'core',
          pattern: ['blind(1)'],
          patternProb: 0.7,
          blindGrowth: { base: 1, every: 2 },
        },
      },
    ],
  },

  s04: {
    slot: 4,
    selectable: true,
    unlockAfter: 's03',
    displayNo: '04',
    label: 'STAGE 04',
    subtitle: 'まなび発電所',
    description: 'がくもん・ちめいの知識演習',
    clearMessage: 'LEARNING PLANT',
    backgroundColor: '#071b24',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['がくもん'], levels: [1], timerSec: 14 },
        enemies: { cols: 6, rows: 2, mobs: ['scout', 'drone'], speed: 0.48, descent: 0.06 },
      },
      {
        type: 'normal',
        message: 'WAVE 2',
        quiz: { genres: ['ちめい'], levels: [1], timerSec: 14 },
        enemies: { cols: 7, rows: 2, mobs: ['scout', 'guard'], speed: 0.52, descent: 0.064 },
      },
      {
        type: 'normal',
        message: 'WAVE 3',
        quiz: { genres: ['がくもん'], levels: [1, 2], timerSec: 13 },
        enemies: { cols: 6, rows: 3, mobs: ['scout', 'guard', 'drone'], speed: 0.56, descent: 0.068 },
      },
      {
        type: 'normal',
        message: 'WAVE 4',
        quiz: { genres: ['ちめい'], levels: [2, 3], timerSec: 13 },
        enemies: { cols: 5, rows: 4, mobs: ['scout', 'guard', 'drone', 'guard'], speed: 0.6, descent: 0.072 },
      },
      {
        type: 'boss',
        message: 'WARNING: BOSS WAVE',
        quiz: { genres: ['がくもん', 'ちめい'], levels: [1, 2, 3], timerSec: 12 },
        boss: {
          hp: 80,
          width: 124,
          height: 82,
          speed: 0.9,
          descent: 0.018,
          design: 'fortress',
          pattern: ['scramble(1)'],
          patternProb: 1,
        },
      },
    ],
  },

  s05: {
    slot: 5,
    selectable: true,
    unlockAfter: 's04',
    displayNo: '05',
    label: 'STAGE 05',
    subtitle: '最終決戦',
    description: 'すべての知識を総動員して最終決戦に挑め',
    clearMessage: 'PLAY SQUAD',
    backgroundColor: '#0a0a1a',
    waves: [
      {
        type: 'normal',
        message: '???',
        quiz: { genres: ['くだもの'], levels: [1, 2, 3], timerSec: 14 },
        enemies: { cols: 1, rows: 1, mobs: ['scout'], speed: 0.25, descent: 0.025 },
      },
      {
        type: 'normal',
        message: 'ENEMY RUSH!',
        backgroundColor: '#0d1020',
        quiz: { genres: ['mixed'], levels: [1, 2, 3], timerSec: 14 },
        enemies: {
          cols: 8,
          rows: 3,
          mobs: ['scout', 'guard', 'drone'],
          speed: 0.58,
          descent: 0.045,
        },
      },
      {
        type: 'boss',
        message: 'WARNING: BOSS WAVE',
        backgroundColor: '#160b1e',
        quiz: { genres: ['あそびと文化', 'サブカル', 'げいのう', 'にっち'], levels: [1, 2, 3, 4], timerSec: 13 },
        boss: {
          hp: 55,
          width: 120,
          height: 84,
          speed: 0.85,
          descent: 0.016,
          design: 'face',
        },
      },
      {
        type: 'boss',
        message: 'WARNING: FINAL BOSS',
        backgroundColor: '#1a070c',
        quiz: { genres: ['mixed'], levels: [1, 2, 3, 4], timerSec: 11 },
        boss: {
          hp: 120,
          width: 136,
          height: 92,
          speed: 1,
          descent: 0.018,
          design: 'skull',
          knockbackPerDamage: 0.75,
          centerShot: {
            everyQuestions: 3,
            warningFrames: 60,
            travelFrames: 45,
            dodgeFrames: 15,
            latePattern: { fromQuestion: 9, pattern: ['marquee(4)'] },
          },
          patternCycle: [['blind(1)'], ['scramble(1)'], []],
          patternProb: 1,
        },
      },
    ],
  },

  s06: {
    slot: 6,
    displayNo: '06',
    label: 'STAGE 06',
    subtitle: 'まちの補給路',
    description: 'くらし・たべものの仮ステージ',
    clearMessage: 'SUPPLY ROUTE',
    backgroundColor: '#10191f',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['くらし', 'たべもの'], levels: [1], timerSec: 15 },
        enemies: { cols: 4, rows: 2, mobs: ['guard'], speed: 0.36, descent: 0.05 },
      },
    ],
  },

  s07: {
    slot: 7,
    displayNo: '07',
    label: 'STAGE 07',
    subtitle: '学びの研究室',
    description: 'がくもん中心の仮ステージ',
    clearMessage: 'STUDY LAB',
    backgroundColor: '#0f1728',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['がくもん'], levels: [1], timerSec: 15 },
        enemies: { cols: 5, rows: 2, mobs: ['scout', 'guard'], speed: 0.38, descent: 0.052 },
      },
    ],
  },

  s08: {
    slot: 8,
    displayNo: '08',
    label: 'STAGE 08',
    subtitle: '地名ワープ航路',
    description: 'ちめい中心の仮ステージ',
    clearMessage: 'GEO WARP',
    backgroundColor: '#091a2a',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['ちめい'], levels: [1], timerSec: 15 },
        enemies: { cols: 5, rows: 3, mobs: ['scout', 'drone', 'guard'], speed: 0.4, descent: 0.054 },
      },
    ],
  },

  s09: {
    slot: 9,
    displayNo: '09',
    label: 'STAGE 09',
    subtitle: '芸能シアター',
    description: 'げいのう中心の仮ステージ',
    clearMessage: 'SHOW THEATER',
    backgroundColor: '#1b1326',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['げいのう'], levels: [1], timerSec: 14 },
        enemies: { cols: 6, rows: 2, mobs: ['drone', 'scout'], speed: 0.42, descent: 0.056 },
      },
    ],
  },

  s10: {
    slot: 10,
    displayNo: '10',
    label: 'STAGE 10',
    subtitle: 'サブカル格納庫',
    description: 'サブカル中心の仮ステージ',
    clearMessage: 'SUBCULTURE HANGAR',
    backgroundColor: '#18152b',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['サブカル'], levels: [1, 2], timerSec: 14 },
        enemies: { cols: 6, rows: 3, mobs: ['guard', 'drone', 'guard'], speed: 0.44, descent: 0.058 },
      },
    ],
  },

  s11: {
    slot: 11,
    displayNo: '11',
    label: 'STAGE 11',
    subtitle: 'まぜこぜ前線',
    description: 'mixedの仮ステージ',
    clearMessage: 'MIXED FRONT',
    backgroundColor: '#111a24',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['mixed'], levels: [1, 2], timerSec: 14 },
        enemies: { cols: 4, rows: 4, mobs: ['scout', 'guard', 'drone', 'scout'], speed: 0.46, descent: 0.06 },
      },
    ],
  },

  s12: {
    slot: 12,
    displayNo: '12',
    label: 'STAGE 12',
    subtitle: 'ひらめき訓練場',
    description: 'がくもん・あそびの仮ステージ',
    clearMessage: 'IDEA RANGE',
    backgroundColor: '#111827',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['がくもん', 'あそびと文化'], levels: [1, 2], timerSec: 14 },
        enemies: { cols: 5, rows: 4, mobs: ['guard', 'scout', 'guard', 'drone'], speed: 0.48, descent: 0.062 },
      },
    ],
  },

  s13: {
    slot: 13,
    displayNo: '13',
    label: 'STAGE 13',
    subtitle: 'にっち異星帯',
    description: 'にっち中心の仮ステージ',
    clearMessage: 'NICHE BELT',
    backgroundColor: '#1d1424',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['にっち'], levels: [1, 2], timerSec: 13 },
        enemies: { cols: 6, rows: 3, mobs: ['drone', 'drone', 'guard'], speed: 0.5, descent: 0.064 },
      },
    ],
  },

  s14: {
    slot: 14,
    displayNo: '14',
    label: 'STAGE 14',
    subtitle: '食堂防衛線',
    description: 'たべもの・くらしの仮ステージ',
    clearMessage: 'DINER LINE',
    backgroundColor: '#181b18',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['たべもの', 'くらし'], levels: [1, 2], timerSec: 13 },
        enemies: { cols: 7, rows: 2, mobs: ['scout', 'drone'], speed: 0.52, descent: 0.066 },
      },
    ],
  },

  s15: {
    slot: 15,
    displayNo: '15',
    label: 'STAGE 15',
    subtitle: '中間要塞',
    description: 'mixedの仮関門ステージ',
    clearMessage: 'MID FORTRESS',
    backgroundColor: '#151524',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['mixed'], levels: [1, 2], timerSec: 13 },
        enemies: { cols: 7, rows: 3, mobs: ['guard', 'drone', 'guard'], speed: 0.54, descent: 0.068 },
      },
    ],
  },

  s16: {
    slot: 16,
    displayNo: '16',
    label: 'STAGE 16',
    subtitle: '文化電脳都市',
    description: 'サブカル・げいのうの仮ステージ',
    clearMessage: 'CYBER CITY',
    backgroundColor: '#171027',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['サブカル', 'げいのう'], levels: [1, 2], timerSec: 13 },
        enemies: { cols: 5, rows: 5, mobs: ['scout', 'guard', 'drone', 'guard', 'scout'], speed: 0.56, descent: 0.07 },
      },
    ],
  },

  s17: {
    slot: 17,
    displayNo: '17',
    label: 'STAGE 17',
    subtitle: '生命の密林',
    description: 'いきもの・しぜんの仮ステージ',
    clearMessage: 'LIFE JUNGLE',
    backgroundColor: '#071b18',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['いきもの', 'しぜん'], levels: [1, 2], timerSec: 13 },
        enemies: { cols: 6, rows: 4, mobs: ['scout', 'drone', 'scout', 'guard'], speed: 0.58, descent: 0.072 },
      },
    ],
  },

  s18: {
    slot: 18,
    displayNo: '18',
    label: 'STAGE 18',
    subtitle: '地球儀要塞',
    description: 'ちめい・がくもんの仮ステージ',
    clearMessage: 'GLOBE FORTRESS',
    backgroundColor: '#0c1726',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['ちめい', 'がくもん'], levels: [1, 2], timerSec: 12 },
        enemies: { cols: 8, rows: 2, mobs: ['guard', 'drone'], speed: 0.6, descent: 0.074 },
      },
    ],
  },

  s19: {
    slot: 19,
    displayNo: '19',
    label: 'STAGE 19',
    subtitle: '生活迷宮',
    description: 'くらし・からだの仮ステージ',
    clearMessage: 'LIFE MAZE',
    backgroundColor: '#171a20',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['くらし', 'からだ'], levels: [1, 2], timerSec: 12 },
        enemies: { cols: 7, rows: 4, mobs: ['drone', 'guard', 'scout', 'guard'], speed: 0.62, descent: 0.076 },
      },
    ],
  },

  s20: {
    slot: 20,
    displayNo: '20',
    label: 'STAGE 20',
    subtitle: '高速混成艦隊',
    description: 'mixedの仮関門ステージ',
    clearMessage: 'FAST FLEET',
    backgroundColor: '#121526',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['mixed'], levels: [1, 2, 3], timerSec: 12 },
        enemies: { cols: 8, rows: 3, mobs: ['scout', 'guard', 'drone'], speed: 0.64, descent: 0.078 },
      },
    ],
  },

  s21: {
    slot: 21,
    displayNo: '21',
    label: 'STAGE 21',
    subtitle: 'エリート演習宙域',
    description: 'mixed高難度の仮ステージ',
    clearMessage: 'ELITE ZONE',
    backgroundColor: '#101423',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['mixed'], levels: [2, 3], timerSec: 12 },
        enemies: { cols: 6, rows: 5, mobs: ['guard', 'drone', 'guard', 'scout', 'drone'], speed: 0.66, descent: 0.08 },
      },
    ],
  },

  s22: {
    slot: 22,
    displayNo: '22',
    label: 'STAGE 22',
    subtitle: 'ニッチ深層圏',
    description: 'にっち・サブカルの仮ステージ',
    clearMessage: 'DEEP NICHE',
    backgroundColor: '#1b1125',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['にっち', 'サブカル'], levels: [2, 3], timerSec: 12 },
        enemies: { cols: 7, rows: 4, mobs: ['drone', 'drone', 'guard', 'drone'], speed: 0.68, descent: 0.082 },
      },
    ],
  },

  s23: {
    slot: 23,
    displayNo: '23',
    label: 'STAGE 23',
    subtitle: '全域防衛戦',
    description: 'mixed終盤の仮ステージ',
    clearMessage: 'TOTAL DEFENSE',
    backgroundColor: '#151821',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['mixed'], levels: [2, 3], timerSec: 11 },
        enemies: { cols: 8, rows: 4, mobs: ['scout', 'guard', 'drone', 'guard'], speed: 0.7, descent: 0.084 },
      },
    ],
  },

  s24: {
    slot: 24,
    displayNo: '24',
    label: 'STAGE 24',
    subtitle: '最終基地コア',
    description: 'INFINITY前の仮最終ステージ',
    clearMessage: 'FINAL CORE',
    backgroundColor: '#19111d',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['mixed'], levels: [2, 3, 4], timerSec: 11 },
        enemies: { cols: 8, rows: 5, mobs: ['guard', 'drone', 'guard', 'drone', 'scout'], speed: 0.72, descent: 0.086 },
      },
    ],
  },
};
