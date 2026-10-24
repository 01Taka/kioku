import type {
  Card,
  LectureCardPhase,
  LectureTrainingQueueResult,
} from "../types/schema";
import {
  SYSTEM_CONSTANTS,
  isWaitingCardLocked,
  graduateCardToCommonPool,
  demoteCardToLecturePool,
} from "../types/schema";
import { createGraduatedFsrsCard } from "../services/fsrsService";

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

/**
 * カードを共通プール（ACTIVE）へ卒業させる（2回連続正解 または 個別スキップ移動）
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
      phase: "ACTIVE",
      consecutiveCorrect: 2,
      lastCorrectAt: nowIso,
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
  graduated: boolean;
}

/**
 * 講義特訓モードでの1問回答（〇: correct / ×: incorrect）による3段階状態遷移
 */
export function applyLectureTrainingAnswer(
  card: Card,
  result: "correct" | "incorrect",
  now: Date = new Date(),
  requestRetention: number = SYSTEM_CONSTANTS.TARGET_RETENTION,
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): LectureTrainingTransitionResult {
  const previousPhase = card.lecturePool.phase;
  const nowIso = now.toISOString();

  // 不正解（×）の場合: 未暗記（UNMEMORIZED）へ逆戻り（consecutiveCorrect = 0 にリセット）
  if (result === "incorrect") {
    const demoted = demoteCardToLecturePool(card);
    return {
      updatedCard: {
        ...demoted,
        updatedAt: nowIso,
      },
      previousPhase,
      nextPhase: "UNMEMORIZED",
      graduated: false,
    };
  }

  // 正解（〇）の場合:
  // 1. 現在 WAITING（待機解除後の2回目テスト）または ACTIVE なら卒業（ACTIVE）へ昇格
  if (previousPhase === "WAITING" || previousPhase === "ACTIVE") {
    const graduatedCard = promoteCardToGraduate(
      card,
      now,
      requestRetention,
      cutoffHour,
    );
    return {
      updatedCard: graduatedCard,
      previousPhase,
      nextPhase: "ACTIVE",
      graduated: true,
    };
  }

  // 2. 現在 UNMEMORIZED（1回目正解）なら WAITING（待機中: 8hロック）へ移行
  const waitingCard: Card = {
    ...card,
    lecturePool: {
      phase: "WAITING",
      consecutiveCorrect: 1,
      lastCorrectAt: nowIso,
    },
    commonPool: null,
    updatedAt: nowIso,
  };

  return {
    updatedCard: waitingCard,
    previousPhase,
    nextPhase: "WAITING",
    graduated: false,
  };
}

