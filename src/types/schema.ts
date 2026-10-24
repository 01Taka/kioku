import type { Card as FSRSCard, RecordLogItem } from "ts-fsrs";

// =================================================================
// 1. システム定数 & 基本Enum
// =================================================================

export const SYSTEM_CONSTANTS = {
  DAY_CUTOFF_HOUR: 4, // 日付変更線: 午前04:00
  DEFAULT_WAITING_HOURS: 8, // 待機中（WAITING）のデフォルトロック時間: 8時間
  TARGET_RETENTION: 0.82, // FSRS 目標保持率
  RECOVERY_RETRIEVABILITY_THRESHOLD: 0.35, // リカバリー室 送致しきい値 (想起確率 R < 0.35)
  SESSION_BATCH_SIZE: 10, // マイクロセッションの出題単位（10問）
} as const;

/** 講義専用プール（個別プール）内でのカードステータス */
export type LectureCardPhase =
  | "UNATTEMPTED" // 未実施: 過去に一回も取り組んでいない
  | "UNGRADUATED" // 未卒業: 取り組んだことがあるがまだ卒業していない
  | "GRADUATION_RECOMMENDED" // 卒業推奨: 現在2回以上連続で正解している
  | "GRADUATED"; // 卒業済: 共通プールに移動済み

/**
 * 講義「チェック」モードにおける3つの出題区分（優先度: 3 > 2 > 1）
 * 3: 連続1回以上正解かつ未暗記（未卒業/卒業推奨）かつ前回の取り組みから規定時間（デフォルト8時間）経過
 * 2: 未実施（過去に一回も取り組んでいない）
 * 1: 連続正解0の未暗記（未卒業）
 */
export type LectureCheckCategory =
  | "PRIORITY_3_COOLDOWN_CLEARED"
  | "PRIORITY_2_UNATTEMPTED"
  | "PRIORITY_1_ZERO_STREAK";

/** カテゴリー優先度モード（3段階 & 階層継承） */
export type PriorityMode =
  | "FORCE" // 強制出題（due無視、配下のACTIVE全問を1日1回出題）
  | "PRIORITY" // 優先（期日到来カードのみ最優先出題）
  | "NORMAL"; // 通常（期日到来カードのみ、通常順序）

/**
 * 共通プールにおけるカードの復習性質・出題枠区分（セマンティック命名）
 */
export type ReviewCategory =
  | "RETRY" // 🔁 リベンジ枠（直近Again / 未克服 / 最優先出題）
  | "DUE" // 🎯 期日枠（今日が最適期日 または 期限切れの通常カード）
  | "EARLY"; // ⚡ 先取り枠（未来期日カードの前倒し復習）

/** 共通プールの回答ボタン（2ボタン固定） */
export type ActiveRating = "AGAIN" | "GOOD";

/** AI生成フラッシュカードの入力フォーマット */
export interface FlashcardContent {
  question: string;
  answer: string;
}

// =================================================================
// 2. 2階層カテゴリ構造（Course ＞ Lecture）
// =================================================================

/** 第1階層: 科目（親） */
export interface Course {
  id: string;
  name: string; // 例: "電気回路I", "線形代数"
  priorityMode: PriorityMode; // 科目全体の優先度（デフォルト: 'NORMAL'）
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  // ※ isSuspended は SSoT 原則に基づき Card 側でのみ保持
}

/** 第2階層: 講義回（子） */
export interface Lecture {
  id: string;
  courseId: string; // 親CourseのID
  name: string; // 例: "第1回 オームの法則"
  order: number; // シラバス順の並び番号

  // 個別上書き用優先度。nullの場合は親Courseの priorityMode を継承
  customPriorityMode: PriorityMode | null;

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  // ※ 待機時間は AppSettings.waitingDurationHours で一元管理するため削除
  // ※ isSuspended は SSoT 原則に基づき Card 側でのみ保持
}

// =================================================================
// 3. 各プールのステート型 & カードモデル（Card）
// =================================================================

/**
 * 講義専用プール（個別プール）ステート
 * 講義ビューのカード一覧やプログレスバー表示に直接使用される
 */
export interface CardLecturePoolState {
  phase: LectureCardPhase;
  consecutiveCorrect: number; // 連続正解数（0, 1, 2...）
  lastAttemptAt: string | null; // 最後に取り組んだ日時（ISO 8601）
}

/**
 * 共通プール（全体FSRS）ステート
 * 卒業して共通プールへ出陣したカードのみ保持（未暗記・待機中は null）
 */
export interface CardCommonPoolState {
  fsrs: FSRSCard; // ts-fsrs の Card
  lastReviewedAt: string | null; // 午前4時境界の当日重複防止用（ISO 8601）
  consecutiveFailCount: number; // 共通プールでの連続ミス回数（2以上で降格推奨）
}

/**
 * 統合 Card モデル（2重構造）
 */
export interface Card {
  // --- 基本メタデータ（ステージ不変） ---
  id: string;
  courseId: string; // ★ 親科目ID（Webストレージでの高速アクセス・集計用）
  lectureId: string; // 所属講義回ID（永続固定・物理移動なし）
  front: string; // 問題面
  back: string; // 解答面

  // ★ 出題除外フラグ（未暗記・ACTIVE問わず全停止 / SSoT）
  isSuspended: boolean;

  // ★ 一括追加時のグループ識別ID（取り消し・管理用）
  bundleId?: string;

  // --- 各プール専用ステート ---
  // ★ 講義専用（個別）プール用データ（常に存在し、ACTIVE時も状態を保持）
  lecturePool: CardLecturePoolState;

  // ★ 共通プール用データ（ACTIVE時のみ存在、未暗記・待機中は null）
  commonPool: CardCommonPoolState | null;

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// =================================================================
// 4. アプリケーション設定 & セッション状態
// =================================================================

export interface AppSettings {
  requestRetention: number; // デフォルト: 0.82
  enableEarlyReview: boolean; // 先取り枠（EARLY）の出題ON/OFF
  sortOrder: "DUE_ASC" | "SHUFFLE"; // 出題順（due昇順 または カテゴリ内シャッフル）
  dayCutoffHour: number; // デフォルト: 4 (午前4:00)

  // ★ 講義専用プールの待機ロック時間（アプリ共通で管理 / 時間単位）
  waitingDurationHours: number; // デフォルト: 8
}

/**
 * LocalStorage / IndexedDB に保持する日次・セッション状態
 * 単なる string[] のため、保存・読み出し・リセットが極めて軽量
 */
export interface SessionStorageState {
  // 🔁 現在リベンジ枠（最優先キュー）にある Card ID 一覧
  retryCardIds: string[];

  // 📝 本日の午前4時以降にミスした Card ID 一覧（「今日間違えた問題」画面の表示用）
  todayMistakeCardIds: string[];

  // 最後に日付変更線（午前4:00）をまたいだ日付キー（例: "2026-10-12"）
  // 午前4時を跨いだ際の todayMistakeCardIds 自動クリア判定に使用
  lastActiveDateKey: string;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  courseId: string;
  lectureId: string;
  stage: "LECTURE_POOL" | "COMMON_POOL" | "FREE_PRACTICE";
  rating: ActiveRating;
  fsrsLogItem?: RecordLogItem; // ts-fsrs の更新ログ
  reviewedAt: string; // ISO 8601
}

// =================================================================
// 5. フラットなエクスポート / インポート用スキーマ（配布・マージ対応）
// =================================================================

/**
 * 1枚のカードの中に親情報も内包した完全自己完結型レコード
 * IDの衝突を避けるため親側のキーを prefix 付与
 */
export interface ExportCardRecord {
  // --- 親: 科目情報 ---
  courseId: string;
  courseName: string;
  coursePriorityMode?: PriorityMode;

  // --- 親: 講義回情報 ---
  lectureId: string;
  lectureName: string;
  lectureOrder?: number;

  // --- カード本体 ---
  id: string; // カードID
  front: string;
  back: string;
  isSuspended: boolean;
  bundleId?: string;

  // 各プールステート
  lecturePool: CardLecturePoolState;
  commonPool: CardCommonPoolState | null;

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * バックアップ・教材共有用 JSON ルート
 */
export interface AppBackupData {
  version: 1; // スキーマバージョン
  exportedAt: string; // ISO 8601
  settings?: AppSettings; // 全体バックアップ時のみ含める
  cards: ExportCardRecord[]; // ★ これ1本で全階層が復元・マージ可能
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
export function graduateCardToCommonPool(
  card: Card,
  initialFsrsCard: FSRSCard,
): Card {
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
export function demoteCardToLecturePool(
  card: Card,
  now: Date = new Date(),
): Card {
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
 * 旧スキーマ（UNMEMORIZED / WAITING / ACTIVE, lastCorrectAt）からの後方互換マイグレーション
 */
export function normalizeLecturePoolState(raw: unknown): CardLecturePoolState {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawPhase = String(obj.phase ?? "UNATTEMPTED");
  const consecutiveCorrect =
    typeof obj.consecutiveCorrect === "number" ? obj.consecutiveCorrect : 0;
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
  const courseMap = new Map(currentCourses.map((c) => [c.id, c]));
  const lectureMap = new Map(currentLectures.map((l) => [l.id, l]));
  const cardMap = new Map(currentCards.map((c) => [c.id, c]));

  for (const record of importedCards) {
    // 1. 科目（Course）: なければ作成、あれば名前は既存を維持
    if (!courseMap.has(record.courseId)) {
      courseMap.set(record.courseId, {
        id: record.courseId,
        name: record.courseName,
        priorityMode: record.coursePriorityMode ?? "NORMAL",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
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
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }

    // 3. カード（Card）: 常に最新データでマップ
    cardMap.set(record.id, {
      id: record.id,
      courseId: record.courseId,
      lectureId: record.lectureId,
      front: record.front,
      back: record.back,
      isSuspended: record.isSuspended,
      bundleId: record.bundleId,
      lecturePool: normalizeLecturePoolState(record.lecturePool),
      commonPool: record.commonPool,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  return {
    courses: Array.from(courseMap.values()),
    lectures: Array.from(lectureMap.values()),
    cards: Array.from(cardMap.values()),
  };
}
