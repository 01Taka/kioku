# 仕様: 講義特訓モードの出題対象選定（Task 1-1）

## 1. 概要・解くべき問い
講義専用プール（短期ステージ）の通常特訓モードにおいて、**「いま出題すべきカード」**を正確に抽出する。

---

## 2. 抽出条件（フィルタリングルール）

カードが以下の条件を**すべて**満たす場合に出題対象キューに含まれる：

1. **所属講義の一致:** `card.lectureId === targetLectureId`
2. **非休止状態:** `card.isSuspended === false`
3. **出題可能ステータス（以下のいずれか）:**
   - **Case A: 未暗記カード**
     - `card.lecturePool.phase === 'UNMEMORIZED'`
   - **Case B: 待機ロック解除済みカード**
     - `card.lecturePool.phase === 'WAITING'` かつ `!isWaitingCardLocked(card, waitingHours, now)`
     - ※ `card.lecturePool.lastCorrectAt + waitingHours <= now`

### 出題対象外（除外）となるカード
- `isSuspended === true`（休止中）
- `lecturePool.phase === 'ACTIVE'`（共通プールへ卒業済み）
- `lecturePool.phase === 'WAITING'` かつ `isWaitingCardLocked(...) === true`（8時間ロック中）

---

## 3. 出力データ構造

```typescript
export interface LectureTrainingQueueResult {
  lectureId: string;
  cards: Card[];                  // 出題対象カード一覧
  unmemorizedCount: number;       // 出題対象中の未暗記枚数
  unlockedWaitingCount: number;   // 出題対象中の待機解除枚数
  lockedWaitingCount: number;     // ロック中で出題できない枚数
  earliestUnlockAt: string | null;// 最短のロック解除予定日時（ISO 8601）
}
```

---

## 4. 例外系・エッジケース

1. **出題可能カードが0枚の場合:**
   - `cards` は空配列 `[]` を返す。
   - ロック中のカードがある場合は「あと○時間○分で出題可能」とUIに表示できる情報を返す。
   - すべて卒業済み（ACTIVE）の場合は「すべて卒業済み」と判定可能にする。
2. **待機時間（`waitingHours`）の扱い:**
   - デフォルトは `SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS`（8時間）。
   - アプリ共通設定またはパラメータで上書き可能とする。
