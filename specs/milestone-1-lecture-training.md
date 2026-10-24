# 仕様: 講義専用プール特訓ライフサイクル（Task 1-2 〜 1-5）

## 1. 特訓回答（〇 / ×）による状態遷移（Task 1-2）
講義専用プールの通常特訓モードにおける回答処理：

- **正解（〇 / `"correct"`）の場合:**
  1. 現在 `phase === "UNMEMORIZED"`（または `consecutiveCorrect === 0`）のカード:
     - `phase = "WAITING"` に移行
     - `consecutiveCorrect = 1`
     - `lastCorrectAt = now.toISOString()`（8時間待機ロック開始）
  2. 現在 `phase === "WAITING"`（待機解除後の2回目テスト）のカード:
     - **卒業処理（Task 1-3）**を実行し、`phase = "ACTIVE"` へ昇格

- **不正解（× / `"incorrect"`）の場合:**
  - 現在の `phase` が `"UNMEMORIZED"` か `"WAITING"` かを問わず、**未暗記へ逆戻り**:
    - `phase = "UNMEMORIZED"`
    - `consecutiveCorrect = 0`
    - `lastCorrectAt = null`

## 2. 卒業カードの FSRS 初期化と ACTIVE 昇格（Task 1-3）
- 2回連続正解、または「プールに移動」ショートカット実行時:
  - `ts-fsrs`（`request_retention: 0.82`, `enable_short_term: false`）で新規カードを生成し、即座に `Rating.Good` をバックグラウンド適用する。
  - `lecturePool.phase = "ACTIVE"`, `consecutiveCorrect = 2`
  - `commonPool = { fsrs: nextFsrsCard, lastReviewedAt: now, consecutiveFailCount: 0 }`
  - `lastReviewedAt = now` により、当日の共通プールには一切出現しない。

## 3. リアルタイム・カウントダウン表示（Task 1-4）
- 講義詳細画面で定期タイマー（30秒〜1分間隔）を駆動し、待機中カードの残り時間（「あと○時間○分」）およびロック解除状態をリアルタイム更新する。

## 4. 通常特訓モードと自由演習（集中ループ）の分離（Task 1-5）
- **短期特訓モード:** `getLectureTrainingQueue` の対象カードのみを出題し、回答ごとに上記の状態遷移（WAITING移行・卒業・逆戻り）を反映する。
- **自由演習（集中ループ）モード:** 講義内の全カード（休止除く）を対象とし、回答してもカードのステータスやFSRSデータを一切変更せず、何度でも周回演習できる。
