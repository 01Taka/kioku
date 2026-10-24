# Spec: Milestone 6 — アプリケーション全体統合・設定モーダル・データバックアップ

## 1. 概要 (Task 6-1, 6-2, 6-3, 6-4)
- **Task 6-1 (`HeaderNav.tsx` & `App.tsx`)**:
  - グローバルヘッダーナビゲーションを配置し、「🎯 今日の共通プール復習（10問セッション）」「📝 今日間違えた問題」「🏥 リカバリー室」「⚙️ 設定・バックアップ」へワンクリックでアクセス可能にする。
  - 各ボタンに現在の対象枚数バッジ（特にリカバリー室に隔離カードがある場合の警告バッジ）をリアルタイム表示する。
- **Task 6-2 (`SettingsModal.tsx` 設定タブ)**:
  - `requestRetention`（目標記憶保持率、デフォルト 0.82）
  - `enableEarlyReview`（10問未満時のパープル先取り補充 ON/OFF）
  - `sortOrder`（`DUE_ASC`: 期日昇順 / `SHUFFLE`: カテゴリ内シャッフル）
  - `waitingDurationHours`（講義専用プールの待機ロック時間、デフォルト 8時間）
- **Task 6-3 (`SettingsModal.tsx` バックアップ・復元タブ)**:
  - `AppBackupData`（自己完結型 `ExportCardRecord[]` + `settings`）を JSON ファイルとしてダウンロード出力する。
  - JSON ファイルを読み込み、`importBackupJson` により既存の科目名・講義名を上書きせず維持したまま差分マージインポートを実行する。
