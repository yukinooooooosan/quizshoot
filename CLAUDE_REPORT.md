# QuizShoot - コードレビュー報告書

**作成日:** 2026-04-27  
**対象ファイル:** game.js / quiz.js / stage_defs.js / infinity_stage_def.js / questions.js / check_questions.mjs  
**レビュアー:** Claude Sonnet 4.6

---

## 重大度分類

| 記号 | 重大度 | 説明 |
|------|--------|------|
| 🔴 | Critical | 本番環境でゲームの公平性・動作を直接損なう |
| 🟠 | High | バグまたは明らかな誤りで、特定条件で問題が起きる |
| 🟡 | Medium | 設計上の問題・コードの一貫性の欠如 |
| 🔵 | Low | 軽微な問題・技術的負債 |

---

## 🔴 Critical

### C-1: デバッグショートカットが本番コードに有効なまま

**ファイル:** `game.js:12` および `game.js:611-619`

```js
const DEBUG_SHORTCUTS = true; // ← これがtrueのまま
```

`c` キーで強制正解、`x` キーで強制不正解がゲームプレイ中にいつでも発動できる。  
スコアの不正操作が可能な状態になっている。

**修正案:**
```js
const DEBUG_SHORTCUTS = false;
```

---

### C-2: stageIdが 'infinity' のままで TODO記載内容と矛盾

**ファイル:** `game.js:471`

```js
this.stageId = 'infinity';
```

`TODO_STAGE_DEF.md` には「現在の起動stageは `stageId = 'easy'` 固定」と記載されているが、実際のコードは `'infinity'` になっている。  
infinityモードは「実プレイ確認前」とTODOに記載されており、未検証の状態でプレイヤーに提供されている。

**修正案:**
```js
this.stageId = 'easy';
```
（難易度選択UIを追加するまでの暫定として）

---

## 🟠 High

### H-1: `_onPlayerInput` の right/left の移動量が異常に大きい

**ファイル:** `game.js:1651-1658`

```js
case 'right':
  this.playerTargetX = CW / 2 - 20; // = 220px オフセット
  this.playerReturnTimer = 12;
  break;
case 'left':
  this.playerTargetX = -(CW / 2 - 20); // = -220px オフセット
  this.playerReturnTimer = 12;
  break;
case 'up':
  this.playerTargetY = -25;  // 25px
  break;
case 'down':
  this.playerTargetY = 16;   // 16px
  break;
```

up/down が 25〜16px のオフセットに対して、right/left は 220px という極端に大きい値になっている。  
自機の描画位置は `cx = CW/2 + playerOffsetX` なので、right入力時に `240 + 220 = 460px` となり、キャンバス（480px幅）の端ギリギリまで飛んでしまう。  
ビジュアル演出のみとはいえ、意図しない値の可能性が高い。

**修正案（推測）:**
```js
case 'right':
  this.playerTargetX = 20;
  this.playerReturnTimer = 12;
  break;
case 'left':
  this.playerTargetX = -20;
  this.playerReturnTimer = 12;
  break;
```

---

### H-2: `_generateDpadChars` で答えの補充文字がスライスで消える可能性

**ファイル:** `quiz.js:128-150`

```js
let charList = [...(this.currentQuestion.chars || [])];

// 安全策: 答えに必要な文字を追加
const answerChars = [...this.currentQuestion.answer];
for (const c of answerChars) {
  // ... charListに追加
}

// 4文字を超えている場合は切り詰め ← ここで追加した文字が消える可能性
if (charList.length > 4) {
  charList = charList.slice(0, 4);
}
```

`chars` に正解に必要でない文字が4つ入っていた場合、安全策で追加した正解文字が `slice(0, 4)` によって切り捨てられる。  
この状態では正解できないD-pad配置が生成される。

現状の `questions.js` データは設計通りに書かれているため実際には発生しにくいが、データを追加する際の地雷になる。

**修正案:**
```js
// 先にsliceして不要な文字を除いた後、答えの文字を補充する順序に変える
if (charList.length > 4) {
  charList = charList.slice(0, 4);
}
// 安全策: 答えに必要な文字を追加（slice後に実施）
for (const c of answerChars) {
  const needed = answerChars.filter(x => x === c).length;
  const have = charList.filter(x => x === c).length;
  for (let i = have; i < needed; i++) {
    charList.push(c);
  }
}
```

---

## 🟡 Medium

### M-1: `_onWrong` と `_startDying` でポーズに対応しない `setTimeout` を使用

**ファイル:** `game.js:1009` および `game.js:731`

```js
// _onWrong
setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 350);

// _startDying
setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 500);
```

他のゲーム内タイムアウトは `_setGameTimeout` を使ってポーズ時に一時停止・再開できるようになっているが、shakeクラス削除には通常の `setTimeout` を使っている。  
ポーズ中でも350ms/500ms後にshakeが解除されてしまう（ゲーム進行には影響しないが一貫性がない）。

---

### M-2: `resume()` でタイマーコードが `_startTimer()` と重複（DRY違反）

**ファイル:** `quiz.js:370-383`

```js
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
```

`_startTimer()` と全く同じintervalロジックをコピーしている。  
`_startTimer` は `this.timer = this.timerMax` でリセットしてしまうため流用できないが、現在の残り秒を引き継いで再開できる `_resumeTimer()` メソッドを分離するのが望ましい。

---

### M-3: `infinity_stage_def.js` の `exactWaves` に開発テストデータが残存

**ファイル:** `infinity_stage_def.js:78-91`

```js
2: {
  type: 'normal',
  message: 'EXACT WAVE 2',   // ← テスト用メッセージが残っている
  quiz: { genres: ['くだもの'], levels: [1], timerSec: 15 },
  enemies: { cols: 2, rows: 1, speed: 0.25, descent: 0.03 },  // 2列1行
},
4: {
  type: 'normal',
  message: 'EXACT WAVE 4',   // ← テスト用メッセージが残っている
  quiz: { genres: ['サブカル'], levels: [1], timerSec: 14 },
  enemies: { cols: 1, rows: 2, speed: 0.3, descent: 0.035 },  // 1列2行
},
```

wave2が敵2体・wave4が敵2体という極端に少ない設定で、メッセージも "EXACT WAVE 2/4" というテスト用の文字列になっている。本番プレイには適さない。

---

### M-4: `_render` でウェーブメッセージ描画時に `ctx.save()/restore()` を使っていない

**ファイル:** `game.js:1254-1263`

```js
if (this.waveMsgTimer > 0) {
  const a = Math.min(1, this.waveMsgTimer / 30);
  ctx.globalAlpha = a;        // ← saveなしで直接変更
  ctx.fillStyle = '#00ff88';
  // ...
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;  // 手動リセット
}
```

他の描画ブロックは `ctx.save()/ctx.restore()` パターンを使っているが、ウェーブメッセージ部分だけが手動でリセットしている。例外が発生したときに `globalAlpha` がリセットされず描画が崩れるリスクがある。

---

## 🔵 Low

### L-1: `questions.js` に重複問題がある

**ファイル:** `questions.js`

| ジャンル | 重複している答え | 問題文 |
|----------|-----------------|--------|
| くだもの | めろん | "丸くて大きな薄緑の果物は？" が2件（L9, L18） |
| いきもの | うさぎ | "長い耳でぴょんぴょん跳ねる動物は？" 系が2件（L28, L31） |
| いきもの | きりん | "首がとても長い動物は？" 系が2件（L29, L32） |
| くらし | くるま | "タイヤが４つある乗り物" 系が2件（L145, L162） |
| くらし | とけい | "時間を見る機械" 系が2件（L142, L163） |

同じ答えの問題が連続して出題される可能性があり、体験が悪くなる。  
`check_questions.mjs` に重複チェック機能を追加するか、データを整理することを推奨する。

---

### L-2: `check_questions.mjs` でlevel 4がサマリーに表示されない

**ファイル:** `check_questions.mjs:14`

```js
const LEVEL_LABELS = { 1: 'やさしい', 2: 'ふつう', 3: 'むずかしい' };
//                                                          ↑ level 4 がない
```

`questions.js` には level 4 の問題が存在するが、`LEVEL_LABELS` にキー `4` がないためサマリー表示でlevel 4の集計が `undefined問` と表示される（あるいは表示されない）。

**修正案:**
```js
const LEVEL_LABELS = { 1: 'やさしい', 2: 'ふつう', 3: 'むずかしい', 4: 'とてもむずかしい' };
```

---

### L-3: `questions.backup.js` がリポジトリに含まれている

**ファイル:** `questions.backup.js`

`check_questions.command` の実行時に自動生成されるバックアップファイル。  
`.gitignore` に追加するか削除することを推奨する。

---

### L-4: `_maskQuestion` で最後の文字がマスクされない理由が不明

**ファイル:** `quiz.js:185`

```js
const maskable = chars
  .map((_, i) => i)
  .filter(i => chars[i] !== '？' && chars[i].trim() !== '' && i < chars.length - 1);
//                                                              ↑ 最後の文字は対象外
```

最後の1文字を必ずヒントとして残す意図と思われるが、コメントがなく理由が不明瞭。  
今後の修正で誤って変更されるリスクがある。意図を示すコメントを1行追加することを推奨。

---

## サマリー

| 重大度 | 件数 |
|--------|------|
| 🔴 Critical | 2件 |
| 🟠 High | 2件 |
| 🟡 Medium | 4件 |
| 🔵 Low | 4件 |
| **合計** | **12件** |

### 優先対応推奨順

1. **C-1** — `DEBUG_SHORTCUTS = false` に変更（1行、即対応可能）
2. **C-2** — `stageId = 'easy'` に戻すか、難易度選択UI実装を優先する
3. **H-1** — `_onPlayerInput` の right/left オフセット値を確認・修正
4. **H-2** — `_generateDpadChars` のslice順序を修正
5. **M-3** — `infinity_stage_def.js` のexactWavesテストデータを削除または実装データに差し替え
6. **L-1** — `questions.js` の重複問題を整理
