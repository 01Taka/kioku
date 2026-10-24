# Spec: Milestone 2 & Task 5-1 — 共通プール出題キュー構築エンジン & 想起確率トリアージ

## 1. 概要 (Task 2-1, 2-2, 2-3, 2-4, 5-1)

共通プール（`lecturePool.phase === "ACTIVE"` かつ `commonPool !== null`）に所属するカードから、午前04:00の日付変更線・3色カラーコーディング・カテゴリー優先度（強制/優先/通常）・リカバリー室隔離（$R < 0.35$）を統合した日次復習キュー（10問マイクロセッション用）を生成する。

## 2. 判定ルールと不変条件

1. **午前04:00日付変更線 (`dateUtils.ts`)**:
   - `getActiveDateKey(now, cutoffHour = 4)`: `getCutoffTime(now, cutoffHour)` のローカル日付 `YYYY-MM-DD` を返す。
   - セッション状態 `lastActiveDateKey` が現在の `getActiveDateKey(now)` と異なる場合、`todayMistakeCardIds` を空配列 `[]` に自動リセットする（`retryCardIds` は正解するまで維持される）。
2. **休止・当日回答済みカードの絶対除外 (Task 2-2)**:
   - `card.isSuspended === true` は除外。
   - `card.commonPool.lastReviewedAt !== null` かつ `new Date(lastReviewedAt) >= getCutoffTime(now)` のカードは、当日の共通プールおよびリカバリー室から **100%除外** する（本日卒業したカード・本日すでに回答したカードは同日に二度と出題しない）。
3. **リカバリー室トリアージ ($R < 0.35$) (Task 5-1)**:
   - `calculateCardRetrievability(card.commonPool.fsrs, now, settings.requestRetention)` により現在の想起確率 $R$ を算出。
   - $R < 0.35$（`SYSTEM_CONSTANTS.RECOVERY_R_THRESHOLD`）のカードは「リカバリー室」へ隔離し、通常の共通プール出題キューから除外する。
   - **例外規定**: 所属講義の有効優先度が `"FORCE"`（強制出題）である期間中は、$R < 0.35$ であっても隔離をバイパスして強制出題枠に含める。
4. **3色カラーコーディング判定順序 (Task 2-3)**:
   1. `retryCardIdSet.has(card.id)` (`isOrange`) ➔ `"RETRY"`（🔁 オレンジ：最優先リベンジ）
   2. `due < cutoffTime` ➔ `"DUE"`（🎯 グリーン：期限切れ通常）
   3. `cutoffTime <= due < nextCutoffTime` ➔ `"DUE"`（🎯 グリーン：当日分）
   4. `due >= nextCutoffTime` ➔ `"EARLY"`（⚡ パープル：先取り枠）
5. **カテゴリー優先度と合流順序 (Task 2-4)**:
   - 講義の有効優先度: `lecture.customPriorityMode ?? course.priorityMode`
   - 1セッションの上限枚数: `batchSize = 10` (`SYSTEM_CONSTANTS.SESSION_BATCH_SIZE`)
   - 合流順序:
     1. **FORCE（強制出題）**: 有効優先度が `"FORCE"` の講義に属する全対象カード（`due` 日時や $R < 0.35$ を無視してシャッフル出題）。
     2. **PRIORITY（優先）**: 有効優先度が `"PRIORITY"` の講義に属する `"RETRY"` または `"DUE"` カード（$R \ge 0.35$）。内部順序は `"RETRY"` ➔ `"DUE"`。
     3. **NORMAL（通常）**: 有効優先度が `"NORMAL"` の講義に属する `"RETRY"` または `"DUE"` カード（$R \ge 0.35$）。内部順序は `"RETRY"` ➔ `"DUE"`。
     4. **EARLY（先取り補充）**: 上記1〜3の合計が `batchSize`（10枚）未満、かつ `settings.enableEarlyReview === true` の場合のみ、残りの `"EARLY"` カード（$R \ge 0.35$）を `due` の昇順（近い順）で10枚に達するまで補充する。補充されたパープルカードの最長 `due` 日時を記録し、セッション開始前メッセージに表示する。
