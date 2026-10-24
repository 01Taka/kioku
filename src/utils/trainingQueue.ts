import type { Card, LectureTrainingQueueResult } from "../types/schema";
import { SYSTEM_CONSTANTS, isWaitingCardLocked } from "../types/schema";

/**
 * 講義専用プールの通常特訓モードで出題すべきカード一覧を抽出する純粋関数
 *
 * 抽出ルール:
 * 1. 当該講義（lectureId）に所属
 * 2. 休止フラグ（isSuspended）が false
 * 3. 以下のいずれか:
 *    - UNMEMORIZED（未暗記カード）
 *    - WAITING（待機カード）かつ ロック時間（デフォルト8h）が経過済み
 * ※ ACTIVE（卒業カード）および ロック中のWAITINGカードは除外される
 */
export function buildLectureTrainingQueue(
  allCards: Card[],
  lectureId: string,
  waitingHours: number = SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS,
  now: Date = new Date(),
): LectureTrainingQueueResult {
  const lectureCards = allCards.filter(
    (c) => c.lectureId === lectureId && !c.isSuspended,
  );

  const trainingCards: Card[] = [];
  let unmemorizedCount = 0;
  let unlockedWaitingCount = 0;
  let lockedWaitingCount = 0;
  let earliestUnlockAt: string | null = null;

  for (const card of lectureCards) {
    const phase = card.lecturePool.phase;

    if (phase === "UNMEMORIZED") {
      trainingCards.push(card);
      unmemorizedCount++;
    } else if (phase === "WAITING") {
      const locked = isWaitingCardLocked(card, waitingHours, now);

      if (locked) {
        lockedWaitingCount++;
        if (card.lecturePool.lastCorrectAt) {
          const unlockTime = new Date(card.lecturePool.lastCorrectAt);
          unlockTime.setHours(unlockTime.getHours() + waitingHours);
          const unlockIso = unlockTime.toISOString();
          if (!earliestUnlockAt || unlockIso < earliestUnlockAt) {
            earliestUnlockAt = unlockIso;
          }
        }
      } else {
        // 待機ロック解除済みカード（卒業テストの対象）
        trainingCards.push(card);
        unlockedWaitingCount++;
      }
    }
    // phase === 'ACTIVE' は講義特訓の対象外
  }

  return {
    lectureId,
    cards: trainingCards,
    unmemorizedCount,
    unlockedWaitingCount,
    lockedWaitingCount,
    earliestUnlockAt,
  };
}
