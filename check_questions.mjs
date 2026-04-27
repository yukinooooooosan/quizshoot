// check_questions.mjs
// 実行: node check_questions.mjs
// - 回答が3文字でない問題を削除
// - 各ジャンル内をlevel順にソート
// - questions.jsを上書き保存（元ファイルはquestions.backup.jsとして保存）
// - 結果サマリーを表示

import { questionGroups } from './questions.js';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVEL_LABELS = { 1: 'やさしい', 2: 'ふつう', 3: 'むずかしい' };

// ---- バックアップ ----
const srcPath = join(__dirname, 'questions.js');
const backupPath = join(__dirname, 'questions.backup.js');
writeFileSync(backupPath, readFileSync(srcPath, 'utf8'), 'utf8');
console.log(`バックアップ保存: questions.backup.js`);

// ---- 検証・ソート ----
let totalRemoved = 0;
let totalKept = 0;
const cleaned = {};

for (const [genre, items] of Object.entries(questionGroups)) {
  const before = items.length;

  const valid = items.filter(q => {
    const len = [...q.answer].length;
    if (len !== 3) {
      console.log(`[削除] ${genre} | "${q.answer}" (${len}文字) | ${q.question}`);
      return false;
    }
    return true;
  });

  valid.sort((a, b) => a.level - b.level);

  const removed = before - valid.length;
  totalRemoved += removed;
  totalKept += valid.length;
  cleaned[genre] = valid;

  const byLevel = { 1: 0, 2: 0, 3: 0 };
  for (const q of valid) byLevel[q.level]++;

  console.log(`\n【${genre}】 計${valid.length}問${removed > 0 ? ` (${removed}問削除)` : ''}`);
  for (const [lv, label] of Object.entries(LEVEL_LABELS)) {
    console.log(`  level${lv} ${label}: ${byLevel[lv]}問`);
  }
}

console.log(`\n=============================`);
console.log(`合計: ${totalKept}問 (削除: ${totalRemoved}問)`);

// ---- questions.js を再生成 ----
function serializeQuestion(q) {
  const chars = q.chars.map(c => `"${c}"`).join(', ');
  return `    { level: ${q.level}, question: "${q.question}", answer: "${q.answer}", chars: [${chars}] },`;
}

function serializeGenre(genre, items) {
  const needsQuotes = /[^぀-ゟ゠-ヿ一-鿿＀-￯A-Za-z_$]/.test(genre)
    || !/^[぀-ゟ゠-ヿ一-鿿＀-￯A-Za-z_$]/.test(genre[0]);
  const key = needsQuotes ? `"${genre}"` : genre;
  const rows = items.map(serializeQuestion).join('\n');
  return `  ${key}: [\n${rows}\n  ],`;
}

const body = Object.entries(cleaned).map(([g, items]) => serializeGenre(g, items)).join('\n\n');

const output = `// questions.js - クイズ問題データ
// chars: 十字キーに表示する4文字（答えの文字をすべて含む）
// 3文字の場合はランダムで1文字追加される
// level: 1 = やさしい, 2 = ふつう, 3 = 少しむずかしい
// level: 1 = 60%, 2 = 30%, 3 = 10% となるように調整します

export const questionGroups = {
${body}
};

export const questions = Object.entries(questionGroups).flatMap(([genre, items]) =>
  items.map(q => ({ genre, ...q }))
);

// ひらがなプール（文字が3つしかない場合の補充用）
export const kanaPool = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ";
`;

writeFileSync(srcPath, output, 'utf8');
console.log(`\nquestions.js を上書き保存しました`);
