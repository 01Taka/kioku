import type { Card as FSRSCard, RecordLogItem } from "ts-fsrs";
import { z } from "zod";

// =================================================================
// 1. システム定数 & 基本Enum / Zodスキーマ
// =================================================================

export const SYSTEM_CONSTANTS = {
  DAY_CUTOFF_HOUR: 4, // 日付変更線: 午前04:00
  DEFAULT_WAITING_HOURS: 8, // 待機中（WAITING）のデフォルトロック時間: 8時間
  TARGET_RETENTION: 0.82, // FSRS 目標保持率
  RECOVERY_RETRIEVABILITY_THRESHOLD: 0.35, // リカバリー室 送致しきい値 (想起確率 R < 0.35)
  SESSION_BATCH_SIZE: 10, // マイクロセッションの出題単位（10問）
} as const;

/** 講義専用プール（個別プール）内でのカードステータス */
export const LectureCardPhaseSchema = z.enum([
  "UNATTEMPTED", // 未実施: 過去に一回も取り組んでいない
  "UNGRADUATED", // 未卒業: 取り組んだことがあるがまだ卒業していない
  "GRADUATION_RECOMMENDED", // 卒業推奨: 現在2回以上連続で正解している
  "GRADUATED", // 卒業済: 共通プールに移動済み
]);
export type LectureCardPhase = z.infer<typeof LectureCardPhaseSchema>;

/**
 * 講義「チェック」モードにおける3つの出題区分（優先度: 3 > 2 > 1）
 * 3: 連続1回以上正解かつ未暗記（未卒業/卒業推奨）かつ前回の取り組みから規定時間（デフォルト8時間）経過
 * 2: 未実施（過去に一回も取り組んでいない）
 * 1: 連続正解0の未暗記（未卒業）
 */
export const LectureCheckCategorySchema = z.enum([
  "PRIORITY_3_COOLDOWN_CLEARED",
  "PRIORITY_2_UNATTEMPTED",
  "PRIORITY_1_ZERO_STREAK",
]);
export type LectureCheckCategory = z.infer<typeof LectureCheckCategorySchema>;

/** カテゴリー優先度モード（3段階 & 階層継承） */
export const PriorityModeSchema = z.enum([
  "FORCE", // 強制出題（due無視、配下のACTIVE全問を1日1回出題）
  "PRIORITY", // 優先（期日到来カードのみ最優先出題）
  "NORMAL", // 通常（期日到来カードのみ、通常順序）
]);
export type PriorityMode = z.infer<typeof PriorityModeSchema>;

/**
 * 共通プールにおけるカードの復習性質・出題枠区分（セマンティック命名）
 */
export const ReviewCategorySchema = z.enum([
  "RETRY", // 🔁 リベンジ枠（直近Again / 未克服 / 最優先出題）
  "DUE", // 🎯 期日枠（今日が最適期日 または 期限切れの通常カード）
  "EARLY", // ⚡ 先取り枠（未来期日カードの前倒し復習）
]);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

/** 共通プールの回答ボタン（2ボタン固定） */
export const ActiveRatingSchema = z.enum(["AGAIN", "GOOD"]);
export type ActiveRating = z.infer<typeof ActiveRatingSchema>;

/** AI生成フラッシュカードの入力フォーマット */
export const FlashcardContentSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(1, "問題文を入力してください"),
  answer: z.string().trim().min(1, "解答文を入力してください"),
});
export type FlashcardContent = z.infer<typeof FlashcardContentSchema>;

// =================================================================
// 2. 2階層カテゴリ構造（Course ＞ Lecture）
// =================================================================

/** 第1階層: 科目（親） */
export const CourseSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "科目名を入力してください"), // 例: "電気回路I", "線形代数"
  priorityMode: PriorityModeSchema, // 科目全体の優先度（デフォルト: 'NORMAL'）
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
  // ※ isSuspended は SSoT 原則に基づき Card 側でのみ保持
});
export type Course = z.infer<typeof CourseSchema>;

/** 第2階層: 講義回（子） */
export const LectureSchema = z.object({
  id: z.string(),
  courseId: z.string(), // 親CourseのID
  name: z.string().trim().min(1, "講義名を入力してください"), // 例: "第1回 オームの法則"
  order: z.number(), // シラバス順の並び番号
  // 個別上書き用優先度。nullの場合は親Courseの priorityMode を継承
  customPriorityMode: PriorityModeSchema.nullable(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
});
export type Lecture = z.infer<typeof LectureSchema>;

// =================================================================
// 3. 各プールのステート型 & カードモデル（Card）
// =================================================================

/**
 * 講義専用プール（個別プール）ステート
 * 講義ビューのカード一覧やプログレスバー表示に直接使用される
 */
export const CardLecturePoolStateSchema = z.object({
  phase: LectureCardPhaseSchema,
  consecutiveCorrect: z.number().int().min(0), // 連続正解数（0, 1, 2...）
  lastAttemptAt: z.string().nullable(), // 最後に取り組んだ日時（ISO 8601）
});
export type CardLecturePoolState = z.infer<typeof CardLecturePoolStateSchema>;

/** FSRS Card スキーマ */
export const FSRSCardSchema = z
  .object({
    due: z.union([z.string(), z.date()]),
    stability: z.number(),
    difficulty: z.number(),
    elapsed_days: z.number(),
    scheduled_days: z.number(),
    reps: z.number(),
    lapses: z.number(),
    state: z.number(),
    last_review: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

/**
 * 共通プール（全体FSRS）ステート
 * 卒業して共通プールへ出陣したカードのみ保持（未暗記・待機中は null）
 */
export const CardCommonPoolStateSchema = z.object({
  fsrs: FSRSCardSchema as unknown as z.ZodType<FSRSCard>, // ts-fsrs の Card
  lastReviewedAt: z.string().nullable(), // 午前4時境界の当日重複防止用（ISO 8601）
  consecutiveFailCount: z.number().int().min(0), // 共通プールでの連続ミス回数（2以上で降格推奨）
});
export interface CardCommonPoolState {
  fsrs: FSRSCard;
  lastReviewedAt: string | null;
  consecutiveFailCount: number;
}

/**
 * 統合 Card モデル（2重構造）
 */
export const CardSchema = z.object({
  // --- 基本メタデータ（ステージ不変） ---
  id: z.string(),
  courseId: z.string(), // 親科目ID（Webストレージでの高速アクセス・集計用）
  lectureId: z.string(), // 所属講義回ID（永続固定・物理移動なし）
  front: z.string().trim().min(1, "問題文を入力してください"), // 問題面
  back: z.string().trim().min(1, "解答文を入力してください"), // 解答面
  isSuspended: z.boolean(), // 出題除外フラグ（未暗記・ACTIVE問わず全停止 / SSoT）
  bundleId: z.string().optional(), // 一括追加時のグループ識別ID（取り消し・管理用）
  lecturePool: CardLecturePoolStateSchema, // 講義専用（個別）プール用データ
  commonPool: CardCommonPoolStateSchema.nullable(), // 共通プール用データ
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
});
export type Card = z.infer<typeof CardSchema>;

// =================================================================
// 4. アプリケーション設定 & セッション状態
// =================================================================

export const AppSettingsSchema = z.object({
  requestRetention: z.number().min(0.5).max(0.99), // デフォルト: 0.82
  enableEarlyReview: z.boolean(), // 先取り枠（EARLY）の出題ON/OFF
  sortOrder: z.enum(["DUE_ASC", "SHUFFLE"]), // 出題順
  dayCutoffHour: z.number().int().min(0).max(23), // デフォルト: 4 (午前4:00)
  waitingDurationHours: z.number().min(0), // デフォルト: 8
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

/**
 * LocalStorage / IndexedDB に保持する日次・セッション状態
 */
export const SessionStorageStateSchema = z.object({
  retryCardIds: z.array(z.string()),
  todayMistakeCardIds: z.array(z.string()),
  lastActiveDateKey: z.string(),
});
export type SessionStorageState = z.infer<typeof SessionStorageStateSchema>;

export const ReviewLogSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  courseId: z.string(),
  lectureId: z.string(),
  stage: z.enum(["LECTURE_POOL", "COMMON_POOL", "FREE_PRACTICE"]),
  rating: ActiveRatingSchema,
  fsrsLogItem: z.custom<RecordLogItem>().optional(),
  reviewedAt: z.string(),
});
export type ReviewLog = z.infer<typeof ReviewLogSchema>;

// =================================================================
// 5. フラットなエクスポート / インポート用スキーマ（配布・マージ対応）
// =================================================================

/**
 * 1枚のカードの中に親情報も内包した完全自己完結型レコード
 */
export const ExportCardRecordSchema = z.object({
  courseId: z.string(),
  courseName: z.string(),
  coursePriorityMode: PriorityModeSchema.optional(),
  lectureId: z.string(),
  lectureName: z.string(),
  lectureOrder: z.number().optional(),
  id: z.string(),
  front: z.string(),
  back: z.string(),
  isSuspended: z.boolean().default(false),
  bundleId: z.string().optional(),
  lecturePool: z.unknown(), // normalizeLecturePoolState で安全に変換
  commonPool: CardCommonPoolStateSchema.nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ExportCardRecord = z.infer<typeof ExportCardRecordSchema>;

/**
 * バックアップ・教材共有用 JSON ルート
 */
export const AppBackupDataSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  settings: AppSettingsSchema.optional(),
  cards: z.array(ExportCardRecordSchema),
});
export type AppBackupData = z.infer<typeof AppBackupDataSchema>;

/**
 * バックアップJSONのパース & バリデーションヘルパー
 */
export function parseBackupData(raw: unknown): {
  success: boolean;
  data?: AppBackupData;
  error?: string;
} {
  const result = AppBackupDataSchema.safeParse(raw);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return { success: false, error: errorDetails };
  }
  return { success: true, data: result.data };
}

// =================================================================
// 6. UI表示・一覧集計用モデル（煽らず静かに表示する用）
// =================================================================

/** 講義回ごとの状況 */
export interface LectureProgress {
  lectureId: string;
  totalCards: number;
  unattemptedCount: number; // 未実施（過去に一回も取り組んでいない）
  ungraduatedCount: number; // 未卒業（取り組んだことがあるがまだ卒業していない）
  graduationRecommendedCount: number; // 卒業推奨（現在2回以上連続で正解している）
  graduatedCount: number; // 卒業済（共通プールに移動済み）

  // 本日の対象件数（静かに一覧で確認できる用）
  retryCount: number; // 🔁 リベンジ枠件数
  dueCount: number; // 🎯 期日到来枠件数

  isWaitingLocked: boolean; // 規定時間待機中（ロック中）カードが存在するか
  earliestUnlockAt: string | null; // 最短のロック解除予定日時（ISO 8601）
}

export interface LectureCheckQueueItem {
  card: Card;
  checkCategory: LectureCheckCategory;
}

/** 講義「チェック」モードの出題対象キュー結果 */
export interface LectureTrainingQueueResult {
  lectureId: string;
  cards: Card[]; // 出題対象カード一覧（優先度 3 > 2 > 1 順）
  items: LectureCheckQueueItem[]; // 出題区分付きアイテム一覧（優先度 3 > 2 > 1 順）
  priority3Count: number; // 区分3: 連続1回以上正解＆8h経過の枚数
  priority2Count: number; // 区分2: 未実施の枚数
  priority1Count: number; // 区分1: 連続正解0の未暗記の枚数
  lockedWaitingCount: number; // 連続1回以上正解だが8h未満でロック中の枚数
  earliestUnlockAt: string | null; // 最短のロック解除予定日時（ISO 8601）
}

/** 科目全体の進捗 */
export interface CourseProgress {
  courseId: string;
  totalCards: number;
  unattemptedCount: number;
  ungraduatedCount: number;
  graduationRecommendedCount: number;
  graduatedCount: number;
  graduatedPercentage: number; // 卒業済の割合（0〜100%）
  retryCount: number; // 科目内のリベンジ合計
  dueCount: number; // 科目内の期日合計
}

// =================================================================
// 7. プレゼンテーション用テーマ定義（ビュー層専用）
// =================================================================

export const REVIEW_CATEGORY_THEME: Record<
  ReviewCategory,
  {
    label: string;
    icon: string;
    colorName: "orange" | "green" | "purple";
    badgeClass: string;
  }
> = {
  RETRY: {
    label: "リベンジ",
    icon: "🔁",
    colorName: "orange",
    badgeClass: "text-orange-600 bg-orange-100 border-orange-300",
  },
  DUE: {
    label: "期日",
    icon: "🎯",
    colorName: "green",
    badgeClass: "text-green-600 bg-green-100 border-green-300",
  },
  EARLY: {
    label: "先取り",
    icon: "⚡",
    colorName: "purple",
    badgeClass: "text-purple-600 bg-purple-100 border-purple-300",
  },
} as const;

// =================================================================
// 8. ドメインロジック補助関数
// =================================================================

/** 午前04:00基準の当日境界日時を取得 */
export function getCutoffTime(
  now: Date = new Date(),
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): Date {
  const cutoff = new Date(now);
  if (cutoff.getHours() < cutoffHour) {
    cutoff.setDate(cutoff.getDate() - 1);
  }
  cutoff.setHours(cutoffHour, 0, 0, 0);
  return cutoff;
}

/** 午前04:00基準の翌日境界日時を取得 */
export function getNextCutoffTime(
  now: Date = new Date(),
  cutoffHour: number = SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
): Date {
  const cutoff = getCutoffTime(now, cutoffHour);
  cutoff.setDate(cutoff.getDate() + 1);
  return cutoff;
}

/**
 * 共通プールカードの復習性質（リベンジ / 期日 / 先取り）を判定
 */
export function determineReviewCategory(
  card: Card,
  retryCardIdSet: Set<string>,
  now: Date = new Date(),
): ReviewCategory {
  if (!card.commonPool) {
    throw new Error(`Card ${card.id} is not in the common pool.`);
  }

  // 1. 直近ミスしたリベンジ枠か（O(1)で判定）
  if (retryCardIdSet.has(card.id)) {
    return "RETRY";
  }

  const nextCutoff = getNextCutoffTime(now);
  const dueDate = new Date(card.commonPool.fsrs.due);

  // 2. 翌日04:00未満 -> 期日枠（期限切れ または 当日分）
  if (dueDate < nextCutoff) {
    return "DUE";
  }

  // 3. 翌日04:00以降 -> 先取り枠
  return "EARLY";
}

/**
 * 連続1回以上正解している未卒業（または卒業推奨）カードの規定時間（8h）ロック判定
 */
export function isWaitingCardLocked(
  card: Card,
  waitingHours: number = SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS,
  now: Date = new Date(),
): boolean {
  const { phase, consecutiveCorrect, lastAttemptAt } = card.lecturePool;
  if (phase === "GRADUATED" || phase === "UNATTEMPTED") {
    return false;
  }
  if (consecutiveCorrect < 1 || !lastAttemptAt) {
    return false;
  }
  const unlockTime = new Date(lastAttemptAt);
  unlockTime.setHours(unlockTime.getHours() + waitingHours);
  return now < unlockTime;
}

/**
 * 配下カード群から休止ステータスを動的に導出（SSoT）
 */
export type SuspensionStatus = "ALL_ACTIVE" | "PARTIAL" | "ALL_SUSPENDED";

export function getSuspensionStatus(cards: Card[]): SuspensionStatus {
  if (cards.length === 0) return "ALL_ACTIVE";

  const suspendedCount = cards.filter((c) => c.isSuspended).length;
  if (suspendedCount === 0) return "ALL_ACTIVE";
  if (suspendedCount === cards.length) return "ALL_SUSPENDED";
  return "PARTIAL";
}

// =================================================================
// 9. ライフサイクル操作ヘルパー（新規作成・卒業・降格）
// =================================================================

/** 新規カードの生成 */
export function createNewCard(params: {
  id: string;
  courseId: string;
  lectureId: string;
  front: string;
  back: string;
  bundleId?: string;
}): Card {
  const now = new Date().toISOString();
  return {
    ...params,
    isSuspended: false,
    lecturePool: {
      phase: "UNATTEMPTED",
      consecutiveCorrect: 0,
      lastAttemptAt: null,
    },
    commonPool: null, // 初期状態は共通プールなし
    createdAt: now,
    updatedAt: now,
  };
}

/** 講義プール卒業（共通プール昇格） */
export function graduateCardToCommonPool(card: Card, initialFsrsCard: FSRSCard): Card {
  const now = new Date().toISOString();
  return {
    ...card,
    lecturePool: {
      ...card.lecturePool,
      phase: "GRADUATED", // 卒業済（共通プールに移動済み）
      lastAttemptAt: card.lecturePool.lastAttemptAt ?? now,
    },
    commonPool: {
      fsrs: initialFsrsCard,
      lastReviewedAt: now, // 当日は共通プールに出さない
      consecutiveFailCount: 0,
    },
    updatedAt: now,
  };
}

/** 共通プールから講義プールへ降格（FSRS履歴リセット ➔ 未卒業・連続正解0・lastAttemptAt=現在時刻） */
export function demoteCardToLecturePool(card: Card, now: Date = new Date()): Card {
  const nowIso = now.toISOString();
  return {
    ...card,
    lecturePool: {
      phase: "UNGRADUATED", // 一度取り組んでいるため未卒業（連続正解0）へ戻す
      consecutiveCorrect: 0,
      lastAttemptAt: nowIso,
    },
    commonPool: null, // ★ FSRSデータは完全破棄・リセット
    updatedAt: nowIso,
  };
}

/** カードを完全初期状態（未実施: UNATTEMPTED）へ手動リセット */
export function resetCardToUnattempted(card: Card): Card {
  const now = new Date().toISOString();
  return {
    ...card,
    lecturePool: {
      phase: "UNATTEMPTED",
      consecutiveCorrect: 0,
      lastAttemptAt: null,
    },
    commonPool: null,
    updatedAt: now,
  };
}

/**
 * 旧スキーマ（UNMEMORIZED / WAITING / ACTIVE, lastCorrectAt）対応用の入力スキーマ
 */
const RawLecturePoolStateSchema = z
  .object({
    phase: z.unknown().optional(),
    consecutiveCorrect: z.unknown().optional(),
    lastAttemptAt: z.unknown().optional(),
    lastCorrectAt: z.unknown().optional(),
  })
  .passthrough();

/**
 * 旧スキーマ（UNMEMORIZED / WAITING / ACTIVE, lastCorrectAt）からの後方互換マイグレーション
 */
export function normalizeLecturePoolState(raw: unknown): CardLecturePoolState {
  const parseResult = RawLecturePoolStateSchema.safeParse(raw ?? {});
  const obj = parseResult.success ? parseResult.data : {};
  const rawPhase = String(obj.phase ?? "UNATTEMPTED");
  const consecutiveCorrect =
    typeof obj.consecutiveCorrect === "number" && !Number.isNaN(obj.consecutiveCorrect)
      ? Math.max(0, Math.floor(obj.consecutiveCorrect))
      : 0;
  const lastAttemptAt =
    typeof obj.lastAttemptAt === "string"
      ? obj.lastAttemptAt
      : typeof obj.lastCorrectAt === "string"
        ? obj.lastCorrectAt
        : null;

  let phase: LectureCardPhase;
  if (rawPhase === "GRADUATED" || rawPhase === "ACTIVE") {
    phase = "GRADUATED";
  } else if (rawPhase === "GRADUATION_RECOMMENDED") {
    phase = "GRADUATION_RECOMMENDED";
  } else if (rawPhase === "UNGRADUATED" || rawPhase === "WAITING") {
    phase = consecutiveCorrect >= 2 ? "GRADUATION_RECOMMENDED" : "UNGRADUATED";
  } else if (rawPhase === "UNMEMORIZED") {
    phase = lastAttemptAt ? "UNGRADUATED" : "UNATTEMPTED";
  } else {
    phase = "UNATTEMPTED";
  }

  return {
    phase,
    consecutiveCorrect,
    lastAttemptAt,
  };
}

// =================================================================
// 10. マージインポート処理（既存名維持・差分追記）
// =================================================================

/**
 * 自己完結型レコード配列から内部データへマージインポート
 * ・同じcourseId/lectureIdがあれば既存の名前は上書きせず保持
 * ・なければ新規作成
 * ・カードは最新化または追加
 */
export function importBackupData(
  importedCards: ExportCardRecord[],
  currentCourses: Course[],
  currentLectures: Lecture[],
  currentCards: Card[],
): {
  courses: Course[];
  lectures: Lecture[];
  cards: Card[];
} {
  const now = new Date().toISOString();
  const courseMap = new Map(currentCourses.map((c) => [c.id, c]));
  const lectureMap = new Map(currentLectures.map((l) => [l.id, l]));
  const cardMap = new Map(currentCards.map((c) => [c.id, c]));

  for (const rawRecord of importedCards) {
    const parsedRecord = ExportCardRecordSchema.safeParse(rawRecord);
    if (!parsedRecord.success) {
      // スキーマを満たさない不正なカードレコードは安全にスキップ
      continue;
    }
    const record = parsedRecord.data;

    // 1. 科目（Course）: なければ作成、あれば名前は既存を維持
    if (!courseMap.has(record.courseId)) {
      courseMap.set(record.courseId, {
        id: record.courseId,
        name: record.courseName,
        priorityMode: record.coursePriorityMode ?? "NORMAL",
        createdAt: record.createdAt ?? now,
        updatedAt: record.updatedAt ?? now,
      });
    }

    // 2. 講義回（Lecture）: なければ作成、あれば名前は既存を維持
    if (!lectureMap.has(record.lectureId)) {
      lectureMap.set(record.lectureId, {
        id: record.lectureId,
        courseId: record.courseId,
        name: record.lectureName,
        order: record.lectureOrder ?? 0,
        customPriorityMode: null,
        createdAt: record.createdAt ?? now,
        updatedAt: record.updatedAt ?? now,
      });
    }

    // 3. カード（Card）: 常に最新データでマップ
    cardMap.set(record.id, {
      id: record.id,
      courseId: record.courseId,
      lectureId: record.lectureId,
      front: record.front,
      back: record.back,
      isSuspended: Boolean(record.isSuspended),
      bundleId: record.bundleId,
      lecturePool: normalizeLecturePoolState(record.lecturePool),
      commonPool: record.commonPool ?? null,
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    });
  }

  return {
    courses: Array.from(courseMap.values()),
    lectures: Array.from(lectureMap.values()),
    cards: Array.from(cardMap.values()),
  };
}
