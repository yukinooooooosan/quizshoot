# Stage Def Refactor TODO

## 現状

- `stage_defs.js` に `s01` と `infinity` を登録済み。
- `infinity_stage_def.js` を追加済み。
- `game.js` は `exactWaves > rules > defaultWave` とカーブ定義を解釈できる。
- 固定Stageの`s01`は全5wave、クリア時に `STAGE 01 CLEAR! / FRUIT BASE` を表示する。
- 現在の起動stageは `game.js` の `stageId = 's01'` 固定。

## 完了

- ステージ選択UIの基本実装
  - タイトル画面から5x5のステージ表を開ける。
  - `slot` / `displayNo` / `label` / `subtitle` / `description` を表示に使う。
  - 選択したstageIdを `Game` に渡す。
  - stageIdごとのハイスコアを保存し、ステージ選択パネルに表示する。
  - 固定ステージのクリア済みフラグを保存し、ステージマスに`CLEAR`を表示する。

## 残作業

- ステージ選択UIを調整する
  - 実機表示を見ながらレイアウト、余白、文字サイズを調整する。
  - 必要なら最後に選んだstageIdを `localStorage` に保存する。

- Infinityモードの実プレイ確認
  - `stageId = 'infinity'` で起動して、`exactWaves / rules / defaultWave` が想定通り動くか確認する。
  - 5の倍数BOSS、12の倍数サブカルwave、通常waveの優先順位を確認する。
  - Wave60など複数ruleが当たるケースでpriorityが効くか確認する。

- `legacy` の扱いを決める
  - `legacy` は旧Infinity生成のフォールバックとして残っている。
  - 新Infinityが安定したら `legacy` を削除するか、互換用として残すか決める。
  - 削除する場合は `BOSS_DEFS`, `getBossDef()`, `createLegacyWaveDef()` も削除候補。

- `s01`以外の固定Stageを追加する
  - `s02`, `s03` のようにslot付きで追加する。
  - `s01`のバランス確認後に、問題ジャンル・levels・ボスHP・敵数を設計する。

- `s01`のバランス確認
  - Wave4小ボスHP18、Wave5ボスHP35は仮。
  - チャージショット、武器ランクアップ、問題タイマー込みで調整する。

- クリア画面を専用化するか決める
  - 現在はゲームオーバー画面を流用している。
  - 必要なら `clear-overlay` を追加する。

- ジャンル/levelフィルタのフォールバックを整理する
  - 指定ジャンルや指定levelsに該当問題がない場合、現在は全問題へフォールバックする。
  - 本番では定義ミスとして検出するか、明示的なfallback設定を用意する。

- 問題難度管理の責務を整理する
  - 固定Stageでは `quiz.levels` を使う。
  - Infinityでは `levelsByWave` やruleごとの `levels` を使う。
  - 旧 `levelMax` はlegacy互換用に残っている。

- [x] スキーマ説明を整備する
  - `stage_defs.js` と `infinity_stage_def.js` の記載ルールを整理する。
  - `type`, `message`, `quiz`, `enemies`, `boss`, `clearMessage`, `rules`, `exactWaves`, `defaultWave`, `curve` の意味を明文化する。

- ステータスバー表示を検討する
  - `WAVE 1/5` は表示済み。
  - `label` / `subtitle` / Infinity などのstage名も表示するか検討する。

## 次にやる候補

1. `stageId = 'infinity'` に一時切り替えてInfinity生成を検証する。
2. タイトル画面に5x5ステージ選択UIを追加する。
3. 新Infinityが安定したらlegacy削除方針を決める。
4. `s01`を実プレイしてHP、速度、タイマー、ジャンルを調整する。
5. `stage_defs.js` / `infinity_stage_def.js` のスキーマコメントを整理する。
