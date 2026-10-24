# 📋 開発進捗・タスクロードマップ（PROGRESS.md）

本書は、[`docs/SYSTEM.md`](SYSTEM.md) に定義された「FSRS×2段階キュー型 学習システム」を、[`docs/PROCEDURE.md`](PROCEDURE.md)（認知負荷最小化・開発標準手順書）に従って実装するための**実行タスクリスト（TODO）**です。

---

## 📌 開発の進め方ルール（PROCEDURE.md 準拠）

1. **「画面単位」ではなく「機能（1つの動詞）単位」で完結させる**
2. **実装順序の原則:** 表示（Read） ➔ 作成（Create） ➔ 更新（Update） ➔ 削除（Delete）
3. **1動詞ごとのスプリント手順:**
   - **Phase 1: 仕様の確定**（Markdownで状態変化とエッジケースを明文化）
   - **Phase 2: データ契約 & Zod定義**（入出力型とバリデーション）
   - **Phase 3: データアクセス層（I/O）疎通**（Store / Repository 関数の単体疎通）
   - **Phase 4: 骨格UIと状態結合**（CSSを書かず、生HTMLで繋ぎ込み確認）
   - **Phase 5: 表層仕上げ・CSS/UX**（Tailwind CSS / アニメーション適用）
4. **タスクが完了するたびに、定期的に Git コミットを実施する**

---

## ✅ 実装完了フェーズ（完了済み）

- [x] **STEP 0: コアドメインの設計・スケッチ**
  - [x] `Course`（科目）, `Lecture`（講義回）, `Card` の基本データ構造定義 (`src/types/schema.ts`)
  - [x] `ts-fsrs` 依存関係の導入と FSRS 型の統合
  - [x] Zustand による状態管理と LocalStorage 永続化 (`src/store/useAppStore.ts`)
- [x] **講義専用プール: 科目 & 講義回の基本CRUD**
  - [x] 科目の追加・編集・削除・休止トグル（配下カスケード）
  - [x] 講義回の追加・編集・削除・休止トグル
  - [x] サイドバー UI（アコーディオン表示・進捗サマリー）
- [x] **講義専用プール: カード管理 & AI一括取り込み**
  - [x] カードの追加・編集・削除・個別休止
  - [x] クリップボードからのワンクリック即時一括取り込み
  - [x] ハルシネーション耐性キートークンスキャナー（`{}` 崩れ自動補正）
  - [x] `bundleId` 付与による一括取り消し（ロールバック）
  - [x] 直前バッチと同一内容の重複追加検知＆キャンセルガード
- [x] **講義カードのシンプル出題基盤（疎結合プレイヤー）**
  - [x] `LecturePlayer` コンポーネント（3Dフリップ、正解/間違い、戻る、シャッフル）
  - [x] カードの上下スライド遷移アニメーション（非表示時インスタント表面リセット）

---

## 🚀 今後の実装タスク（実行順 TODO リスト）

---

### Milestone 1: 講義専用プール（短期ステージ）の特訓ライフサイクル完成
> **目的:** 講義内でのカード特訓を行い、「未暗記 ➔ 8時間待機 ➔ 卒業」の完全な状態遷移を実装する。

- [x] **Task 1-1: 講義特訓モードの出題対象選定ロジックを実装する (Read)**
  - 出題対象: `phase === 'UNMEMORIZED'` または「待機時間（8h）が経過した `WAITING`」
  - 待機中（ロック中）のカードは出題キューから除外
  - 成果物: `src/utils/trainingQueue.ts`, `src/store/useAppStore.ts` (`getLectureTrainingQueue`)
- [x] **Task 1-2: 特訓回答（〇 / ×）による3段階状態遷移を実装する (Update)**
  - 未暗記カードで正解（〇） ➔ `phase = WAITING`, `consecutiveCorrect = 1`, `lastCorrectAt = now`
  - 待機解除カードで正解（〇） ➔ 卒業処理呼び出し（Task 1-3へ）
  - いずれの状態で不正解（×） ➔ `phase = UNMEMORIZED`, `consecutiveCorrect = 0`, `lastCorrectAt = null` に逆戻り
  - 成果物: `src/store/useAppStore.ts` (`answerLectureTrainingCard`)
- [x] **Task 1-3: 卒業カードの FSRS 初期化と ACTIVE 昇格処理を実装する (Update)**
  - 2回連続正解（または「プールに移動」ボタン）で `phase = ACTIVE` に変更
  - `ts-fsrs` の初期カード作成 ＆ `Rating.Good` をバックグラウンド実行
  - `lastReviewedAt = now` をセットし、`due` は翌日以降に設定（当日の共通プールには出さない）
  - 成果物: `src/services/fsrsService.ts`, `src/utils/trainingQueue.ts` (`promoteCardToGraduate`)
- [x] **Task 1-4: 講義ビューのリアルタイム・カウントダウン表示を仕上げる (UI/UX)**
  - 待機中カードが存在する場合、「あと○時間○分でテスト可能」と正確に表示
  - 待機解除時に「出題可能」バッジへ動的切り替え
  - 成果物: `src/components/LecturePoolDetail.tsx`
- [x] **Task 1-5: 「通常特訓モード」と「テスト直前・集中ループ演習（自由演習）」の分離 (UI)**
  - 状態遷移が発生する「短期特訓スタート」ボタンと、FSRS・状態を汚染しない「自由演習（ループ）」ボタンのUI分離
  - 成果物: `src/components/LecturePoolDetail.tsx`, `src/components/practice/LecturePlayer.tsx`

---

### Milestone 2: 共通プール（長期ステージ / FSRS）コア選定エンジンの構築
> **目的:** 卒業済みカード（ACTIVE）から、カテゴリー優先度や日付変更線（午前4:00）に則った出題キューを生成する。

- [x] **Task 2-1: 午前04:00境界日時の判定と日次セッションストレージ管理 (Read/Update)**
  - `getCutoffTime(now)` / `getNextCutoffTime(now)` を用いた当日・翌日の日付キー判定
  - 午前04:00を跨いだ際の `todayMistakeCardIds` の自動リセット機構
  - 成果物: `src/utils/dateUtils.ts`, `src/store/useAppStore.ts`
- [x] **Task 2-2: 当日回答済みカードの絶対除外フィルタの実装 (Read)**
  - `lastReviewedAt >= 当日04:00:00` のカードを当日の共通プールから完全除外（本日卒業カードや回答済みカードの同日重複出題を100%防止）
  - 成果物: `src/utils/queueBuilder.ts`
- [x] **Task 2-3: 3色カラーコーディング（リベンジ / 期日 / 先取り）判定エンジンの実装 (Read)**
  - 評価順序の厳格適用:
    1. `isOrange === true` ➔ 🔁 オレンジ（リベンジ枠・最優先）
    2. `due < 当日04:00:00` ➔ 🎯 グリーン（期限切れ通常）
    3. `当日04:00:00 <= due < 翌日04:00:00` ➔ 🎯 グリーン（当日分）
    4. `due >= 翌日04:00:00` ➔ ⚡ パープル（先取り枠）
  - 成果物: `src/utils/queueBuilder.ts`
- [x] **Task 2-4: カテゴリー優先度（強制出題 / 優先 / 通常）と階層継承の合流ロジック (Read)**
  - 子（講義回）の上書き優先度 ＞ 親（科目）の優先度
  - キュー合流順序:
    1. 「強制出題（FORCE）」全講義の当日未学習カード（due無視・シャッフル）
    2. 「優先（PRIORITY）」全講義の当日到来カード
    3. 「通常（NORMAL）」全講義の当日到来カード
    4. 「先取り（EARLY/パープル）」枠（不足分を due 昇順で補充）
  - 成果物: `src/utils/queueBuilder.ts`

---

### Milestone 3: 共通プール（FSRS長期ステージ）学習セッション画面の実装
> **目的:** 10問単位のマイクロセッション、FSRS計算実行、ブレイク画面を構築する。

- [x] **Task 3-1: ts-fsrs パラメータの設定と 2ボタン（Again / Good）更新ロジック (Update)**
  - `request_retention: 0.82`, `enable_short_term: false`（ステップ空配列）の設定
  - `Rating.Again`（不正解） / `Rating.Good`（正解）のみでの FSRS 計算・パラメータ更新
  - 回答後の `lastReviewedAt = now` 更新
  - 成果物: `src/services/fsrsService.ts`, `src/store/useAppStore.ts`
- [x] **Task 3-2: 10問マイクロセッション出題UIの作成 (UI/UX)**
  - 10問単位での出題（端数の場合は端数枚数で実施）
  - カード上部にカラーバッジ表示（🔁 オレンジ / 🎯 グリーン / ⚡ パープル）
  - パープルカードが含まれる場合の事前案内メッセージ（「最長で○月○日復習予定のカードが含まれます」）
  - 成果物: `src/components/session/CommonPoolSessionModal.tsx`
- [x] **Task 3-3: 10問ごとのブレイク画面の実装 (UI/UX)**
  - 10問終了時に休憩画面を表示
  - 「もう10問続ける（残カードがある場合）」「ここで終了する」の選択
  - 成果物: `src/components/session/CommonPoolSessionModal.tsx`

---

### Milestone 4: 誤答（Again）処理 & 「今日間違えた問題」画面の実装
> **目的:** セッション内ループを廃止し、ミスしたカードの翌日最優先リベンジと手動降格ハブを構築する。

- [x] **Task 4-1: 誤答時のオレンジフラグ付与 & 連続ミス回数カウント (Update)**
  - Again 選択時: 即座に次の問題へ（セッション内再出題なし）、`isOrange = true`, `consecutiveFailCount += 1`, `todayMistakeCardIds` に追加
  - 次回以降 Good 選択時: `isOrange = false`, `consecutiveFailCount = 0` にリセット
  - 成果物: `src/store/useAppStore.ts`
- [x] **Task 4-2: セッション完了リザルト & 「今日間違えた問題」一覧画面の作成 (Read)**
  - 本日の午前4時以降にミスしたカードを一覧表示
  - `科目名 > 講義回名` のパンくず表示
  - 「連続ミス回数バッジ」（⚠️ 2連続ミス / 🔥 3連続ミス）
  - 連続2回以上（`consecutiveFailCount >= 2`）のカードに初期チェックを付与
  - 成果物: `src/components/session/TodayMistakesView.tsx`
- [x] **Task 4-3: 「選択したカードを講義プールに戻す」一括降格アクションの実装 (Update)**
  - チェックしたカードを所属講義の専用プール（`phase = UNMEMORIZED`）へ一括降格
  - 過去の FSRS パラメータを完全リセット（新規カード化）
  - 成果物: `src/store/useAppStore.ts` (`batchDemoteToLecturePool`)

---

### Milestone 5: リカバリー室（想起確率 $R < 0.35$ 救済トリアージ）の実装
> **目的:** 復習が溜まりすぎた場合の日常復習阻害を防ぐ隔離所と救済アクションを構築する。

- [x] **Task 5-1: 想起確率 $R < 0.35$ 瀕死カードの自動トリアージ & 隔離除外 (Read)**
  - FSRS の計算式から現在日時における想起確率 $R$ を算出
  - $R < 0.35$ のカードを日々の共通プール出題から自動除外
  - 【例外規定】当該講義が「強制出題（FORCE）」に設定されている期間中は隔離をバイパスして出題
  - 成果物: `src/services/fsrsService.ts`, `src/utils/queueBuilder.ts`
- [x] **Task 5-2: リカバリー室専用画面の作成 (Read/UI)**
  - 隔離されたカードを所属情報（`科目名 > 講義回名`）とともに一覧表示
  - 現在の推定想起確率（$R$ 値）の表示
  - 成果物: `src/components/recovery/RecoveryRoomModal.tsx`
- [x] **Task 5-3: リカバリー室の3大救済アクションの実装 (Update)**
  - アクション1: 「すべて講義プールに戻す（未暗記として再特訓）」
  - アクション2: 「選択して講義プールに戻す」
  - アクション3: 「このまま共通プールでテストする（正解なら復帰、不正解なら即講義プールへ降格）」
  - 成果物: `src/components/recovery/RecoveryRoomModal.tsx`, `src/store/useAppStore.ts`

---

### Milestone 6: アプリケーション全体統合・設定 & バックアップ
> **目的:** 各画面のナビゲーション統合、アプリ設定、バックアップ復元を完成させる。

- [ ] **Task 6-1: メイン画面ナビゲーション（タブ / ヘッダー）の統合 (UI)**
  - 「講義プール管理」「今日の共通復習（10問セッション）」「今日間違えた問題」「リカバリー室」へのアクセス導線
  - リカバリー室に対象カードがある場合のバッジ通知
  - 成果物: `src/components/HeaderNav.tsx`, `src/App.tsx`
- [ ] **Task 6-2: アプリケーション設定モーダルの実装 (Read/Update)**
  - 目標保持率（`requestRetention` デフォルト: 0.82）
  - 先取り枠（`enableEarlyReview` ON/OFF）
  - 出題順（`sortOrder`: due昇順 / カテゴリ内シャッフル）
  - 講義待機ロック時間（`waitingDurationHours` デフォルト: 8時間）
  - 成果物: `src/components/settings/SettingsModal.tsx`
- [ ] **Task 6-3: データのエクスポート & マージインポート機能の実装 (I/O)**
  - 仕様書 5章・10章準拠の `AppBackupData` / `ExportCardRecord` JSONエクスポート
  - 既存の科目名・講義名を維持しながら差分追記する `importBackupData` のUI統合
  - 成果物: `src/components/settings/DataBackupSection.tsx`
- [ ] **Task 6-4: 全体E2E動作検証 & 最終仕上げ**
  - 新規カード作成 ➔ 講義特訓（8h待機） ➔ 卒業 ➔ 共通プール出題（10問） ➔ ミス ➔ 翌日オレンジリベンジ ➔ 降格 のフルサイクルの結合テスト
  - TypeScript 型チェック & ビルド検証

---

## 🧭 直近の次のアクション（Next Step）

> **Milestone 1 / Task 1-2:**  
> **「特訓回答（〇 / ×）による3段階状態遷移を実装する (Update)」**
> - 未暗記カードの正解で `WAITING` 待機へ移行（8hロック開始）
> - 待機解除カードの正解で卒業処理（ACTIVE）へ昇格
> - いずれのカードも不正解（×）で `UNMEMORIZED` へ逆戻り
> - `src/store/useAppStore.ts` に `answerLectureTrainingCard` を実装します。
