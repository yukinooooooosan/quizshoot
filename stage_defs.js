// stage_defs.js - ステージ・Wave構成定義
//
// ==========================================
// 【 スキーマ説明（記載ルール）】
// ==========================================
//
// 各ステージは以下のプロパティを持ちます。
// - slot: ステージ選択UI上の枠番号（例: 1）
// - displayNo: ステージ選択UI上の表示番号（例: '01'）
// - label: ステージ番号などの短い表示名（例: 'STAGE 01'）
// - subtitle: ステージのシナリオ名（例: 'くだもの秘密基地'）
// - description: ステージ選択UI向けの短い説明文
// - mode: 'infinity' を指定すると無限モード用の挙動になります。省略時は固定ウェーブ。
// - clearMessage: ステージクリア時に表示する専用メッセージ（固定ステージ用）
// - backgroundColor: 背景色
// - waves: 固定ステージの場合、各Waveの設定を配列で定義します。
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
// - speed: 敵の横移動速度
// - descent: 敵の降下速度
//
// 【 boss（ボスウェーブ時の設定）】(type: 'boss' のみ)
// - hp: ボスの体力
// - width, height: ボスのサイズ
// - speed: ボスの横移動速度
// - descent: ボスの降下速度
// - design: ボスの見た目（'fortress', 'wing', 'core'）
// - color: ボスの色コード
// - pattern: クイズの問題文や文字を隠す特殊攻撃の配列（例: ['scramble(1)', 'blind(2)']）
// - patternProb: 特殊攻撃が発動する確率 (0.0 〜 1.0)
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
    displayNo: '01',
    label: 'STAGE 01',
    subtitle: 'くだもの秘密基地',
    description: 'くだもの・たべもの中心の出撃訓練',
    clearMessage: 'FRUIT BASE',
    backgroundColor: '#071824',
    waves: [
      {
        type: 'normal',
        message: 'WAVE 1',
        quiz: { genres: ['くだもの', 'たべもの'], levels: [1], timerSec: 15 },
        enemies: { cols: 4, rows: 2, speed: 0.35, descent: 0.05 },
      },
      {
        type: 'normal',
        message: 'WAVE 2',
        quiz: { genres: ['いきもの'], levels: [1], timerSec: 15 },
        enemies: { cols: 5, rows: 2, speed: 0.4, descent: 0.055 },
      },
      {
        type: 'normal',
        message: 'WAVE 3',
        quiz: { genres: ['くらし', 'からだ'], levels: [1], timerSec: 14 },
        enemies: { cols: 5, rows: 3, speed: 0.45, descent: 0.06 },
      },
      {
        type: 'boss',
        message: 'WARNING: MINI BOSS',
        quiz: { genres: ['サブカル'], levels: [1], timerSec: 13 },
        boss: {
          hp: 18,
          width: 96,
          height: 64,
          speed: 0.75,
          descent: 0.018,
          design: 'core',
          color: '#6bcb77',
          pattern: ['scramble(1)'],
          patternProb: 0.7,
        },
      },
      {
        type: 'boss',
        message: 'WARNING: BOSS WAVE',
        quiz: { genres: ['mixed'], levels: [1], timerSec: 12 },
        boss: {
          hp: 35,
          width: 120,
          height: 80,
          speed: 0.9,
          descent: 0.02,
          design: 'fortress',
          color: '#ff4757',
          pattern: ['scramble(1)'],
          patternProb: 1,
        },
      },
    ],
  },
};
