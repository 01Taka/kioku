import {
  type Card as FSRSCard,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type RecordLogItem,
  TypeConvert,
} from "ts-fsrs";

import { type ActiveRating, getNextCutoffTime, SYSTEM_CONSTANTS } from "../types/schema";

/**
 * システム仕様（目標保持率 0.82、サブデイ無効化）に準拠した FSRS インスタンスを生成
 */
export function createFsrsInstance(requestRetention: number = SYSTEM_CONSTANTS.TARGET_RETENTION) {
  const params = generatorParameters({
    request_retention: requestRetention,
    enable_short_term: false,
  });
  return fsrs(params);
}

/**
 * 講義プール卒業時（2回連続正解または強制移動）の初期 FSRS カード生成
 * バックグラウンドで Rating.Good を実行し、due を翌日以降にセットする
 */
export function createGraduatedFsrsCard(
  now: Date = new Date(),
  requestRetention: number = SYSTEM_CONSTANTS.TARGET_RETENTION,
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): { fsrsCard: FSRSCard; logItem: RecordLogItem } {
  const f = createFsrsInstance(requestRetention);
  const emptyCard = createEmptyCard(now);
  const logItem = f.next(emptyCard, now, Rating.Good);
  const nextCard = { ...logItem.card };

  // 万一 due が翌日境界（04:00）より前になった場合でも翌日以降を保証
  const nextCutoff = getNextCutoffTime(now, cutoffHour);
  if (new Date(nextCard.due) < nextCutoff) {
    nextCard.due = nextCutoff;
  }

  return {
    fsrsCard: nextCard,
    logItem: {
      ...logItem,
      card: nextCard,
    },
  };
}

/**
 * 共通プールでの 2ボタン（AGAIN / GOOD）回答による FSRS パラメータ更新
 * ※ Hard と Easy は一切使用しない
 */
export function reviewCommonPoolCard(
  currentFsrsCard: FSRSCard,
  rating: ActiveRating,
  now: Date = new Date(),
  requestRetention: number = SYSTEM_CONSTANTS.TARGET_RETENTION,
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): { fsrsCard: FSRSCard; logItem: RecordLogItem } {
  const f = createFsrsInstance(requestRetention);
  const normalizedCard = TypeConvert.card(currentFsrsCard);
  const fsrsRating = rating === "GOOD" ? Rating.Good : Rating.Again;

  const logItem = f.next(normalizedCard, now, fsrsRating);
  const nextCard = { ...logItem.card };

  // サブデイ無効化（最低翌日04:00以降を保証）
  const nextCutoff = getNextCutoffTime(now, cutoffHour);
  if (new Date(nextCard.due) < nextCutoff) {
    nextCard.due = nextCutoff;
  }

  return {
    fsrsCard: nextCard,
    logItem: {
      ...logItem,
      card: nextCard,
    },
  };
}

/**
 * 現在時刻におけるカードの想起確率 R (0.0 〜 1.0) を算出
 */
export function calculateCardRetrievability(
  currentFsrsCard: FSRSCard,
  now: Date = new Date(),
  requestRetention: number = SYSTEM_CONSTANTS.TARGET_RETENTION,
): number {
  try {
    const f = createFsrsInstance(requestRetention);
    const normalizedCard = TypeConvert.card(currentFsrsCard);
    const r = f.get_retrievability(normalizedCard, now, false);
    if (typeof r === "number" && !Number.isNaN(r)) {
      return r;
    }
    return 1.0;
  } catch {
    return 1.0;
  }
}
