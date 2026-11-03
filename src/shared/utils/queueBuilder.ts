import { calculateCardRetrievability } from "../services/fsrsService";
import type {
  AppSettings,
  Card,
  Course,
  Lecture,
  PriorityMode,
  ReviewCategory,
} from "../types/schema";
import { SYSTEM_CONSTANTS } from "../types/schema";
import { getCutoffTime, getNextCutoffTime, isReviewedToday } from "./dateUtils";

export interface CommonPoolQueueItem {
  card: Card;
  courseName: string;
  lectureName: string;
  effectivePriority: PriorityMode;
  reviewCategory: ReviewCategory;
  /** due < 当日04:00 の期限切れカードか */
  isOverdue: boolean;
  /** 現在の推定想起確率 R (0.0 ~ 1.0) */
  retrievability: number;
}

export interface RecoveryCardItem {
  card: Card;
  courseName: string;
  lectureName: string;
  retrievability: number;
}

export interface CommonPoolQueueBuildResult {
  /** 10問マイクロセッションに出題するカード配列（最大10枚） */
  sessionBatch: CommonPoolQueueItem[];
  /** 本日出題対象の全カード（FORCE + PRIORITY(RETRY/DUE) + NORMAL(RETRY/DUE)） */
  allTargetCards: CommonPoolQueueItem[];
  /** 想起確率 R < 0.35 でリカバリー室へ隔離されたカード配列 */
  recoveryCards: RecoveryCardItem[];
  /** 今回の10問バッチに含まれるパープル（先取り）カード枚数 */
  earlyReviewCountInBatch: number;
  /** 今回の10問バッチに含まれるパープルカードの最長 due 日時 (ISO文字列) */
  farthestEarlyDueIso: string | null;
  /** 残りの通常出題対象カード総数（先取りを除く） */
  totalRemainingCount: number;
}

/**
 * 講義回の有効優先度を決定する（子の上書き設定 ＞ 親科目の設定）
 */
export function getEffectiveLecturePriority(
  lecture: Lecture | undefined,
  course: Course | undefined,
): PriorityMode {
  if (lecture?.customPriorityMode) {
    return lecture.customPriorityMode;
  }
  return course?.priorityMode ?? "NORMAL";
}

/**
 * Task 2-3: 3色カラーコーディング（リベンジ / 期日 / 先取り）を厳格な評価順序で判定
 * 1. retryCardIdSet.has(card.id) (isOrange) -> RETRY (🔁 オレンジ)
 * 2. due < 当日04:00:00 -> DUE (🎯 グリーン・期限切れ)
 * 3. 当日04:00:00 <= due < 翌日04:00:00 -> DUE (🎯 グリーン・当日分)
 * 4. due >= 翌日04:00:00 -> EARLY (⚡ パープル・先取り)
 */
export function classifyCommonPoolCard(
  card: Card,
  retryCardIdSet: Set<string>,
  now: Date = new Date(),
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): { category: ReviewCategory; isOverdue: boolean } {
  if (!card.commonPool) {
    throw new Error(`Card ${card.id} is not in the common pool`);
  }

  const cutoff = getCutoffTime(now, cutoffHour);
  const nextCutoff = getNextCutoffTime(now, cutoffHour);
  const dueDate = new Date(card.commonPool.fsrs.due);
  const isOverdue = dueDate < cutoff;

  // 1. 直近ミスしたリベンジ枠（isOrange）
  if (retryCardIdSet.has(card.id)) {
    return { category: "RETRY", isOverdue };
  }

  // 2. 期限切れ (due < 当日04:00)
  if (dueDate < cutoff) {
    return { category: "DUE", isOverdue: true };
  }

  // 3. 当日分 (当日04:00 <= due < 翌日04:00)
  if (dueDate < nextCutoff) {
    return { category: "DUE", isOverdue: false };
  }

  // 4. 先取り枠 (due >= 翌日04:00)
  return { category: "EARLY", isOverdue: false };
}

/** 配列のシャッフル（Fisher-Yates） */
function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * カテゴリ（PRIORITY / NORMAL）内のソート関数:
 * RETRY（オレンジ）を最優先し、次に DUE（グリーン）を並べる。
 * settings.sortOrder が "SHUFFLE" の場合は各色グループ内でシャッフル、"DUE_ASC" の場合は due 昇順。
 */
function sortCategoryItems(
  items: CommonPoolQueueItem[],
  sortOrder: AppSettings["sortOrder"],
): CommonPoolQueueItem[] {
  const retryItems = items.filter((i) => i.reviewCategory === "RETRY");
  const dueItems = items.filter((i) => i.reviewCategory !== "RETRY");

  const sortByDueAsc = (a: CommonPoolQueueItem, b: CommonPoolQueueItem) => {
    const dueA = new Date(a.card.commonPool!.fsrs.due).getTime();
    const dueB = new Date(b.card.commonPool!.fsrs.due).getTime();
    return dueA - dueB;
  };

  if (sortOrder === "SHUFFLE") {
    return [...shuffleArray(retryItems), ...shuffleArray(dueItems)];
  }

  return [...retryItems.sort(sortByDueAsc), ...dueItems.sort(sortByDueAsc)];
}

/**
 * 共通プール（長期ステージ / FSRS）の出題キューとリカバリー室対象カードを一括構築する
 */
export function buildCommonPoolQueue(params: {
  cards: Card[];
  courses: Course[];
  lectures: Lecture[];
  retryCardIds: string[];
  settings: AppSettings;
  now?: Date;
  batchSize?: number;
}): CommonPoolQueueBuildResult {
  const {
    cards,
    courses,
    lectures,
    retryCardIds,
    settings,
    now = new Date(),
    batchSize = SYSTEM_CONSTANTS.SESSION_BATCH_SIZE,
  } = params;

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const lectureMap = new Map(lectures.map((l) => [l.id, l]));
  const retrySet = new Set(retryCardIds);

  const forceBucket: CommonPoolQueueItem[] = [];
  const priorityBucket: CommonPoolQueueItem[] = [];
  const normalBucket: CommonPoolQueueItem[] = [];
  const earlyBucket: CommonPoolQueueItem[] = [];
  const recoveryCards: RecoveryCardItem[] = [];

  for (const card of cards) {
    // 1. 共通プール（GRADUATED: 卒業済）でないカード・休止中カードは除外
    if (card.lecturePool.phase !== "GRADUATED" || !card.commonPool || card.isSuspended) {
      continue;
    }

    // 2. Task 2-2: 当日04:00以降に回答済み（または本日卒業した）カードは100%除外
    if (isReviewedToday(card.commonPool.lastReviewedAt, now, settings.dayCutoffHour)) {
      continue;
    }

    const course = courseMap.get(card.courseId);
    const lecture = lectureMap.get(card.lectureId);
    const courseName = course?.name ?? "不明な科目";
    const lectureName = lecture?.name ?? "不明な講義";
    const effectivePriority = getEffectiveLecturePriority(lecture, course);

    // 3. Task 5-1: 現在の推定想起確率 R を計算
    const retrievability = calculateCardRetrievability(
      card.commonPool.fsrs,
      now,
      settings.requestRetention,
    );

    const { category, isOverdue } = classifyCommonPoolCard(
      card,
      retrySet,
      now,
      settings.dayCutoffHour,
    );

    // 4. Task 2-4 & Task 5-1: 「強制出題（FORCE）」の講義は R < 0.35 の隔離をバイパスし、due 日時に関わらず強制出題枠へ
    if (effectivePriority === "FORCE") {
      forceBucket.push({
        card,
        courseName,
        lectureName,
        effectivePriority,
        reviewCategory: category,
        isOverdue,
        retrievability,
      });
      continue;
    }

    // 5. 想起確率 R < 0.35 の危険水域カードをリカバリー対象としてリストアップ
    // ※ ユーザーが明示的にリカバリー室で取り除く（講義プールへ戻す）まで共通プールからは自動除外せず、通常通り出題キューにも含める
    if (retrievability < SYSTEM_CONSTANTS.RECOVERY_RETRIEVABILITY_THRESHOLD) {
      recoveryCards.push({
        card,
        courseName,
        lectureName,
        retrievability,
      });
    }

    const queueItem: CommonPoolQueueItem = {
      card,
      courseName,
      lectureName,
      effectivePriority,
      reviewCategory: category,
      isOverdue,
      retrievability,
    };

    // 6. Task 2-3 & 2-4: カラーと優先度でバケット振り分け
    if (category === "RETRY" || category === "DUE") {
      if (effectivePriority === "PRIORITY") {
        priorityBucket.push(queueItem);
      } else {
        normalBucket.push(queueItem);
      }
    } else {
      // category === "EARLY" (⚡ パープル: due >= 翌日04:00)
      earlyBucket.push(queueItem);
    }
  }

  // 各バケットの整列
  // ① 強制出題（FORCE）はシャッフルして出題（リベンジ枠があれば先頭に寄せる）
  const sortedForce = [
    ...shuffleArray(forceBucket.filter((i) => i.reviewCategory === "RETRY")),
    ...shuffleArray(forceBucket.filter((i) => i.reviewCategory !== "RETRY")),
  ];
  // ② 優先（PRIORITY）
  const sortedPriority = sortCategoryItems(priorityBucket, settings.sortOrder);
  // ③ 通常（NORMAL）
  const sortedNormal = sortCategoryItems(normalBucket, settings.sortOrder);

  const allTargetCards = [...sortedForce, ...sortedPriority, ...sortedNormal];

  // 10問マイクロセッションの構築
  const sessionBatch: CommonPoolQueueItem[] = allTargetCards.slice(0, batchSize);
  let farthestEarlyDueIso: string | null = null;

  // ④ 先取り（EARLY / パープル）補充:
  // 1〜3の合計が10枚に満たない場合、かつ settings.enableEarlyReview が ON の場合のみ due 昇順で補充
  if (sessionBatch.length < batchSize && settings.enableEarlyReview && earlyBucket.length > 0) {
    const needed = batchSize - sessionBatch.length;
    const sortedEarly = [...earlyBucket].sort((a, b) => {
      const dueA = new Date(a.card.commonPool!.fsrs.due).getTime();
      const dueB = new Date(b.card.commonPool!.fsrs.due).getTime();
      return dueA - dueB;
    });
    const supplementalEarly = sortedEarly.slice(0, needed);
    sessionBatch.push(...supplementalEarly);
  }

  // バッチ内のパープル（EARLY）カードの最長 due を集計（FORCE内にEARLYが含まれる場合も考慮）
  const earlyItemsInBatch = sessionBatch.filter((i) => i.reviewCategory === "EARLY");
  const earlyReviewCountInBatch = earlyItemsInBatch.length;
  if (earlyItemsInBatch.length > 0) {
    let maxDueMs = 0;
    for (const item of earlyItemsInBatch) {
      const dueDate = new Date(item.card.commonPool!.fsrs.due);
      const dueMs = dueDate.getTime();
      if (dueMs > maxDueMs) {
        maxDueMs = dueMs;
        farthestEarlyDueIso = dueDate.toISOString();
      }
    }
  }

  // リカバリー室カードは R が低い順（重症順）に並べる
  recoveryCards.sort((a, b) => a.retrievability - b.retrievability);

  return {
    sessionBatch,
    allTargetCards,
    recoveryCards,
    earlyReviewCountInBatch,
    farthestEarlyDueIso,
    totalRemainingCount: allTargetCards.length,
  };
}
