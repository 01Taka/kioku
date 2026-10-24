import { getCutoffTime, getNextCutoffTime,SYSTEM_CONSTANTS } from "../types/schema";

/**
 * 午前04:00（cutoffHour）基準の活動日付キー（YYYY-MM-DD）を取得する。
 * 例: 2026-10-25 02:30 の場合、"2026-10-24" を返す。
 */
export function getActiveDateKey(
  now: Date = new Date(),
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): string {
  const cutoff = getCutoffTime(now, cutoffHour);
  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, "0");
  const day = String(cutoff.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 指定された ISO 日時文字列が「当日04:00以降」に回答済みかどうかを判定する。
 * `lastReviewedAt >= 当日04:00:00` なら true（本日の共通プールから100%除外）。
 */
export function isReviewedToday(
  lastReviewedAt: string | null | undefined,
  now: Date = new Date(),
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): boolean {
  if (!lastReviewedAt) return false;
  const reviewedDate = new Date(lastReviewedAt);
  if (Number.isNaN(reviewedDate.getTime())) return false;
  const cutoff = getCutoffTime(now, cutoffHour);
  return reviewedDate >= cutoff;
}

/**
 * 先取り（パープル）カードの最長 due 日時を「○月○日（あと○日後）」形式でフォーマットする。
 */
export function formatFutureDueNotice(
  dueIso: string,
  now: Date = new Date(),
): {
  dateLabel: string;
  daysAhead: number;
} {
  const dueDate = new Date(dueIso);
  const month = dueDate.getMonth() + 1;
  const day = dueDate.getDate();
  const cutoffToday = getCutoffTime(now);
  const diffMs = dueDate.getTime() - cutoffToday.getTime();
  const daysAhead = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return {
    dateLabel: `${month}月${day}日`,
    daysAhead,
  };
}

export { getCutoffTime, getNextCutoffTime };
