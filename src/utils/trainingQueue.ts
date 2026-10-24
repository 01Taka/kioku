import { createGraduatedFsrsCard } from "../services/fsrsService";
import type {
  Card,
  LectureCardPhase,
  LectureCheckQueueItem,
  LectureTrainingQueueResult,
} from "../types/schema";
import { graduateCardToCommonPool, isWaitingCardLocked, SYSTEM_CONSTANTS } from "../types/schema";

/**
 * 講義専用プールの「チェック」モードで出題すべきカード一覧を抽出する純粋関数
 *
 * 抽出ルール（対象: 休止中でなく、まだ「卒業済(GRADUATED)」ではないカード）:
 * - 区分3 (PRIORITY_3_COOLDOWN_CLEARED): 連続1回以上正解かつ未暗記（未卒業 / 卒業推奨）かつ前回の取り組み（lastAttemptAt）から規定時間（デフォルト8h）経過
 * - 区分2 (PRIORITY_2_UNATTEMPTED): 未実施（過去に一回も取り組んでいない）
 * - 区分1 (PRIORITY_1_ZERO_STREAK): 連続正解0の未暗記（未卒業）
 *
 * 出題優先度: 3 > 2 > 1
 */
export function buildLectureTrainingQueue(
  allCards: Card[],
  lectureId: string,
  waitingHours: number = SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS,
  now: Date = new Date(),
): LectureTrainingQueueResult {
  const lectureCards = allCards.filter((c) => c.lectureId === lectureId && !c.isSuspended);

  const bucket3: LectureCheckQueueItem[] = [];
  const bucket2: LectureCheckQueueItem[] = [];
  const bucket1: LectureCheckQueueItem[] = [];

  let lockedWaitingCount = 0;
  let earliestUnlockAt: string | null = null;

  for (const card of lectureCards) {
    const { phase, consecutiveCorrect, lastAttemptAt } = card.lecturePool;

    // 卒業済（共通プール移動済み）はチェック出題の対象外
    if (phase === "GRADUATED") {
      continue;
    }

    // 区分2: 未実施（過去に一回も取り組んでいない）
    if (phase === "UNATTEMPTED") {
      bucket2.push({
        card,
        checkCategory: "PRIORITY_2_UNATTEMPTED",
      });
      continue;
    }

    // 区分3 または 待機ロック中: 連続1回以上正解している未暗記（未卒業 / 卒業推奨）
    if (consecutiveCorrect >= 1) {
      const locked = isWaitingCardLocked(card, waitingHours, now);
      if (locked) {
        lockedWaitingCount++;
        if (lastAttemptAt) {
          const unlockTime = new Date(lastAttemptAt);
          unlockTime.setHours(unlockTime.getHours() + waitingHours);
          const unlockIso = unlockTime.toISOString();
          if (!earliestUnlockAt || unlockIso < earliestUnlockAt) {
            earliestUnlockAt = unlockIso;
          }
        }
      } else {
        bucket3.push({
          card,
          checkCategory: "PRIORITY_3_COOLDOWN_CLEARED",
        });
      }
      continue;
    }

    // 区分1: 連続正解0の未暗記（未卒業）
    bucket1.push({
      card,
      checkCategory: "PRIORITY_1_ZERO_STREAK",
    });
  }

  // 出題優先度: 3 > 2 > 1
  const orderedItems = [...bucket3, ...bucket2, ...bucket1];

  return {
    lectureId,
    cards: orderedItems.map((i) => i.card),
    items: orderedItems,
    priority3Count: bucket3.length,
    priority2Count: bucket2.length,
    priority1Count: bucket1.length,
    lockedWaitingCount,
    earliestUnlockAt,
  };
}

/**
 * カードを共通プール（GRADUATED: 卒業済）へ移動させる
 * バックグラウンドで Rating.Good を実行し、lastReviewedAt = now, due = 翌日以降をセット
 */
export function promoteCardToGraduate(
  card: Card,
  now: Date = new Date(),
  requestRetention: number = SYSTEM_CONSTANTS.TARGET_RETENTION,
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): Card {
  const { fsrsCard } = createGraduatedFsrsCard(now, requestRetention, cutoffHour);
  const graduated = graduateCardToCommonPool(card, fsrsCard);
  const nowIso = now.toISOString();

  return {
    ...graduated,
    lecturePool: {
      phase: "GRADUATED",
      consecutiveCorrect: Math.max(card.lecturePool.consecutiveCorrect, 2),
      lastAttemptAt: card.lecturePool.lastAttemptAt ?? nowIso,
    },
    commonPool: {
      fsrs: fsrsCard,
      lastReviewedAt: nowIso,
      consecutiveFailCount: 0,
    },
    updatedAt: nowIso,
  };
}

export interface LectureTrainingTransitionResult {
  updatedCard: Card;
  previousPhase: LectureCardPhase;
  nextPhase: LectureCardPhase;
  becameGraduationRecommended: boolean;
}

/**
 * 講義「チェック」モードでの1問回答（〇: correct / ×: incorrect）による状態遷移
 * - 正解でも不正解でも lastAttemptAt = 現在時刻 に更新
 * - 正解（〇）: consecutiveCorrect を +1 加算。1なら UNGRADUATED（未卒業）、2以上なら GRADUATION_RECOMMENDED（卒業推奨）
 * - 不正解（×）: consecutiveCorrect = 0、phase = UNGRADUATED（未卒業）へ戻す（一度取り組んだので未実施には戻らない）
 */
export function applyLectureTrainingAnswer(
  card: Card,
  result: "correct" | "incorrect",
  now: Date = new Date(),
): LectureTrainingTransitionResult {
  const previousPhase = card.lecturePool.phase;
  const nowIso = now.toISOString();

  if (result === "incorrect") {
    const nextPhase: LectureCardPhase = "UNGRADUATED";
    const updatedCard: Card = {
      ...card,
      lecturePool: {
        phase: nextPhase,
        consecutiveCorrect: 0,
        lastAttemptAt: nowIso,
      },
      commonPool: null,
      updatedAt: nowIso,
    };

    return {
      updatedCard,
      previousPhase,
      nextPhase,
      becameGraduationRecommended: false,
    };
  }

  // 正解（〇）の場合
  const nextConsecutive = card.lecturePool.consecutiveCorrect + 1;
  const nextPhase: LectureCardPhase =
    nextConsecutive >= 2 ? "GRADUATION_RECOMMENDED" : "UNGRADUATED";

  const updatedCard: Card = {
    ...card,
    lecturePool: {
      phase: nextPhase,
      consecutiveCorrect: nextConsecutive,
      lastAttemptAt: nowIso,
    },
    commonPool: null,
    updatedAt: nowIso,
  };

  return {
    updatedCard,
    previousPhase,
    nextPhase,
    becameGraduationRecommended: nextPhase === "GRADUATION_RECOMMENDED",
  };
}
