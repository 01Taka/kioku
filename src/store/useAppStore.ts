import { create } from "zustand";
import { persist } from "zustand/middleware";

import { reviewCommonPoolCard } from "../services/fsrsService";
import type {
  ActiveRating,
  AppBackupData,
  AppSettings,
  Card,
  Course,
  CourseProgress,
  FlashcardContent,
  Lecture,
  LectureCardPhase,
  LectureProgress,
  LectureTrainingQueueResult,
  PriorityMode,
  SessionStorageState,
} from "../types/schema";
import {
  createNewCard,
  demoteCardToLecturePool,
  getSuspensionStatus,
  importBackupData,
  isWaitingCardLocked,
  normalizeLecturePoolState,
  resetCardToUnattempted,
  SYSTEM_CONSTANTS,
} from "../types/schema";
import { getActiveDateKey, getNextCutoffTime, isReviewedToday } from "../utils/dateUtils";
import { buildCommonPoolQueue, type CommonPoolQueueBuildResult } from "../utils/queueBuilder";
import {
  applyLectureTrainingAnswer,
  buildLectureTrainingQueue,
  type LectureTrainingTransitionResult,
  promoteCardToGraduate,
} from "../utils/trainingQueue";

export function getBatchSignature(contents: FlashcardContent[]): string {
  return contents
    .map((c) => `${c.question.trim()}:::${c.answer.trim()}`)
    .sort()
    .join("|||");
}

export interface LastImportBatchInfo {
  lectureId: string;
  signature: string;
  bundleId: string;
  count: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  requestRetention: SYSTEM_CONSTANTS.TARGET_RETENTION,
  enableEarlyReview: true,
  sortOrder: "DUE_ASC",
  dayCutoffHour: SYSTEM_CONSTANTS.DAY_CUTOFF_HOUR,
  waitingDurationHours: SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS,
};

export const createDefaultSessionState = (now: Date = new Date()): SessionStorageState => ({
  retryCardIds: [],
  todayMistakeCardIds: [],
  lastActiveDateKey: getActiveDateKey(now),
});

interface AppState {
  courses: Course[];
  lectures: Lecture[];
  cards: Card[];
  settings: AppSettings;
  sessionState: SessionStorageState;

  selectedCourseId: string | null;
  selectedLectureId: string | null;

  lastImportBatch: LastImportBatchInfo | null;

  // Settings & Daily Cutoff actions
  updateSettings: (updates: Partial<AppSettings>) => void;
  syncDailyCutoff: (now?: Date) => void;

  // Course actions
  addCourse: (name: string, priorityMode?: PriorityMode) => Course;
  updateCourse: (id: string, updates: Partial<Pick<Course, "name" | "priorityMode">>) => void;
  deleteCourse: (id: string) => void;
  toggleCourseSuspension: (courseId: string) => void;

  // Lecture actions
  addLecture: (courseId: string, name: string) => Lecture;
  updateLecture: (
    id: string,
    updates: Partial<Pick<Lecture, "name" | "order" | "customPriorityMode">>,
  ) => void;
  deleteLecture: (id: string) => void;
  toggleLectureSuspension: (lectureId: string) => void;

  // Card actions
  addCard: (courseId: string, lectureId: string, front: string, back: string) => Card;
  updateCard: (id: string, updates: Partial<Pick<Card, "front" | "back" | "isSuspended">>) => void;
  deleteCard: (id: string) => void;
  setCardPhase: (id: string, phase: LectureCardPhase) => void;
  toggleCardSuspension: (id: string) => void;
  answerLectureTrainingCard: (
    cardId: string,
    result: "correct" | "incorrect",
    now?: Date,
  ) => LectureTrainingTransitionResult | null;
  graduateRecommendedCardsInLecture: (lectureId: string, now?: Date) => number;
  batchGraduateCards: (cardIds: string[], now?: Date) => number;

  // Common Pool & Recovery Room actions
  getCommonPoolQueue: (now?: Date, batchSize?: number) => CommonPoolQueueBuildResult;
  answerCommonPoolCard: (cardId: string, rating: ActiveRating, now?: Date) => void;
  batchDemoteToLecturePool: (cardIds: string[]) => number;
  answerRecoveryTestCard: (
    cardId: string,
    rating: ActiveRating,
    now?: Date,
  ) => "RECOVERED" | "DEMOTED" | null;

  // Backup Export & Import actions
  exportBackupData: () => AppBackupData;
  importBackupJson: (backup: AppBackupData) => {
    addedCourses: number;
    addedLectures: number;
    addedCards: number;
  };

  // Batch / Bundle actions
  addCardsBatch: (
    courseId: string,
    lectureId: string,
    contents: FlashcardContent[],
    customBundleId?: string,
  ) => { bundleId: string; addedCards: Card[] };
  deleteCardsByBundleId: (bundleId: string) => number;
  isDuplicateOfLastBatch: (lectureId: string, contents: FlashcardContent[]) => boolean;

  // Navigation / Selection
  selectCourse: (courseId: string | null) => void;
  selectLecture: (lectureId: string | null) => void;

  // Aggregation helpers
  getLectureProgress: (lectureId: string) => LectureProgress;
  getCourseProgress: (courseId: string) => CourseProgress;
  getLectureTrainingQueue: (
    lectureId: string,
    waitingHours?: number,
    now?: Date,
  ) => LectureTrainingQueueResult;

  // Reset sample data
  loadSampleData: () => void;
}

const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      courses: [],
      lectures: [],
      cards: [],
      settings: DEFAULT_APP_SETTINGS,
      sessionState: createDefaultSessionState(),
      selectedCourseId: null,
      selectedLectureId: null,
      lastImportBatch: null,

      updateSettings: (updates) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...updates,
          },
        }));
      },

      syncDailyCutoff: (now = new Date()) => {
        const currentKey = getActiveDateKey(now, get().settings.dayCutoffHour);
        const prevKey = get().sessionState.lastActiveDateKey;
        if (currentKey !== prevKey) {
          set((state) => ({
            sessionState: {
              ...state.sessionState,
              todayMistakeCardIds: [],
              lastActiveDateKey: currentKey,
            },
          }));
        }
      },

      addCourse: (name, priorityMode = "NORMAL") => {
        const now = new Date().toISOString();
        const newCourse: Course = {
          id: `course_${generateId()}`,
          name: name.trim(),
          priorityMode,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          courses: [...state.courses, newCourse],
          selectedCourseId: state.selectedCourseId ?? newCourse.id,
        }));
        return newCourse;
      },

      updateCourse: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          courses: state.courses.map((course) =>
            course.id === id ? { ...course, ...updates, updatedAt: now } : course,
          ),
        }));
      },

      deleteCourse: (id) => {
        set((state) => {
          const remainingCourses = state.courses.filter((c) => c.id !== id);
          const remainingLectures = state.lectures.filter((l) => l.courseId !== id);
          const remainingCards = state.cards.filter((c) => c.courseId !== id);

          const nextSelectedCourseId =
            state.selectedCourseId === id
              ? (remainingCourses[0]?.id ?? null)
              : state.selectedCourseId;

          const nextSelectedLectureId = remainingLectures.some(
            (l) => l.id === state.selectedLectureId,
          )
            ? state.selectedLectureId
            : (remainingLectures.find((l) => l.courseId === nextSelectedCourseId)?.id ?? null);

          return {
            courses: remainingCourses,
            lectures: remainingLectures,
            cards: remainingCards,
            selectedCourseId: nextSelectedCourseId,
            selectedLectureId: nextSelectedLectureId,
          };
        });
      },

      toggleCourseSuspension: (courseId) => {
        const cards = get().cards.filter((c) => c.courseId === courseId);
        const currentStatus = getSuspensionStatus(cards);
        // If all suspended -> unsuspend all (false), otherwise suspend all (true)
        const targetSuspended = currentStatus !== "ALL_SUSPENDED";
        const now = new Date().toISOString();

        set((state) => ({
          cards: state.cards.map((card) =>
            card.courseId === courseId
              ? { ...card, isSuspended: targetSuspended, updatedAt: now }
              : card,
          ),
        }));
      },

      addLecture: (courseId, name) => {
        const currentLectures = get().lectures.filter((l) => l.courseId === courseId);
        const maxOrder = currentLectures.reduce((max, l) => Math.max(max, l.order), 0);
        const now = new Date().toISOString();

        const newLecture: Lecture = {
          id: `lec_${generateId()}`,
          courseId,
          name: name.trim(),
          order: maxOrder + 1,
          customPriorityMode: null,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          lectures: [...state.lectures, newLecture],
          selectedLectureId: newLecture.id,
          selectedCourseId: courseId,
        }));
        return newLecture;
      },

      updateLecture: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          lectures: state.lectures.map((lecture) =>
            lecture.id === id ? { ...lecture, ...updates, updatedAt: now } : lecture,
          ),
        }));
      },

      deleteLecture: (id) => {
        set((state) => {
          const targetLecture = state.lectures.find((l) => l.id === id);
          const remainingLectures = state.lectures.filter((l) => l.id !== id);
          const remainingCards = state.cards.filter((c) => c.lectureId !== id);

          const nextSelectedLectureId =
            state.selectedLectureId === id
              ? (remainingLectures.find((l) => l.courseId === targetLecture?.courseId)?.id ??
                remainingLectures[0]?.id ??
                null)
              : state.selectedLectureId;

          return {
            lectures: remainingLectures,
            cards: remainingCards,
            selectedLectureId: nextSelectedLectureId,
          };
        });
      },

      toggleLectureSuspension: (lectureId) => {
        const cards = get().cards.filter((c) => c.lectureId === lectureId);
        const currentStatus = getSuspensionStatus(cards);
        const targetSuspended = currentStatus !== "ALL_SUSPENDED";
        const now = new Date().toISOString();

        set((state) => ({
          cards: state.cards.map((card) =>
            card.lectureId === lectureId
              ? { ...card, isSuspended: targetSuspended, updatedAt: now }
              : card,
          ),
        }));
      },

      addCard: (courseId, lectureId, front, back) => {
        const newCard = createNewCard({
          id: `card_${generateId()}`,
          courseId,
          lectureId,
          front: front.trim(),
          back: back.trim(),
        });

        set((state) => ({
          cards: [newCard, ...state.cards],
        }));
        return newCard;
      },

      updateCard: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === id ? { ...card, ...updates, updatedAt: now } : card,
          ),
        }));
      },

      deleteCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((card) => card.id !== id),
        }));
      },

      setCardPhase: (id, phase) => {
        const card = get().cards.find((c) => c.id === id);
        if (!card) return;

        let updatedCard: Card;
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const { requestRetention, dayCutoffHour } = get().settings;

        if (phase === "GRADUATED") {
          // Promote to common pool with Rating.Good background calculation
          updatedCard = promoteCardToGraduate(card, nowDate, requestRetention, dayCutoffHour);
        } else if (phase === "GRADUATION_RECOMMENDED") {
          updatedCard = {
            ...card,
            lecturePool: {
              phase: "GRADUATION_RECOMMENDED",
              consecutiveCorrect: Math.max(card.lecturePool.consecutiveCorrect, 2),
              lastAttemptAt: card.lecturePool.lastAttemptAt ?? now,
            },
            commonPool: null,
            updatedAt: now,
          };
        } else if (phase === "UNGRADUATED") {
          updatedCard = demoteCardToLecturePool(card, nowDate);
        } else {
          // Reset to UNATTEMPTED (未実施)
          updatedCard = resetCardToUnattempted(card);
        }

        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? updatedCard : c)),
          sessionState:
            phase !== "GRADUATED"
              ? {
                  ...state.sessionState,
                  retryCardIds: state.sessionState.retryCardIds.filter((cid) => cid !== id),
                  todayMistakeCardIds: state.sessionState.todayMistakeCardIds.filter(
                    (cid) => cid !== id,
                  ),
                }
              : state.sessionState,
        }));
      },

      toggleCardSuspension: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === id ? { ...card, isSuspended: !card.isSuspended, updatedAt: now } : card,
          ),
        }));
      },

      answerLectureTrainingCard: (cardId, result, now = new Date()) => {
        const card = get().cards.find((c) => c.id === cardId);
        if (!card) return null;

        const transitionResult = applyLectureTrainingAnswer(card, result, now);

        set((state) => ({
          cards: state.cards.map((c) => (c.id === cardId ? transitionResult.updatedCard : c)),
        }));

        return transitionResult;
      },

      graduateRecommendedCardsInLecture: (lectureId, now = new Date()) => {
        const state = get();
        const { requestRetention, dayCutoffHour } = state.settings;
        let graduatedCount = 0;

        set((prev) => ({
          cards: prev.cards.map((card) => {
            if (
              card.lectureId === lectureId &&
              !card.isSuspended &&
              card.lecturePool.phase === "GRADUATION_RECOMMENDED"
            ) {
              graduatedCount++;
              return promoteCardToGraduate(card, now, requestRetention, dayCutoffHour);
            }
            return card;
          }),
        }));

        return graduatedCount;
      },

      batchGraduateCards: (cardIds, now = new Date()) => {
        if (cardIds.length === 0) return 0;
        const targetSet = new Set(cardIds);
        const state = get();
        const { requestRetention, dayCutoffHour } = state.settings;
        let graduatedCount = 0;

        set((prev) => ({
          cards: prev.cards.map((card) => {
            if (targetSet.has(card.id) && card.lecturePool.phase !== "GRADUATED") {
              graduatedCount++;
              return promoteCardToGraduate(card, now, requestRetention, dayCutoffHour);
            }
            return card;
          }),
        }));

        return graduatedCount;
      },

      getCommonPoolQueue: (now = new Date(), batchSize) => {
        const state = get();
        const activeKey = getActiveDateKey(now, state.settings.dayCutoffHour);
        const effectiveRetryIds = state.sessionState.retryCardIds;

        // もし日付が切り替わっていれば非同期に syncDailyCutoff も反映させる
        if (state.sessionState.lastActiveDateKey !== activeKey) {
          set((prev) => ({
            sessionState: {
              ...prev.sessionState,
              todayMistakeCardIds: [],
              lastActiveDateKey: activeKey,
            },
          }));
        }

        return buildCommonPoolQueue({
          cards: state.cards,
          courses: state.courses,
          lectures: state.lectures,
          retryCardIds: effectiveRetryIds,
          settings: state.settings,
          now,
          batchSize,
        });
      },

      answerCommonPoolCard: (cardId, rating, now = new Date()) => {
        const state = get();
        const card = state.cards.find((c) => c.id === cardId);
        if (!card || !card.commonPool) return;

        const { requestRetention, dayCutoffHour } = state.settings;
        const activeKey = getActiveDateKey(now, dayCutoffHour);
        const nowIso = now.toISOString();

        const { fsrsCard: updatedFsrs } = reviewCommonPoolCard(
          card.commonPool.fsrs,
          rating,
          now,
          requestRetention,
          dayCutoffHour,
        );

        const nextConsecutiveFailCount =
          rating === "AGAIN" ? card.commonPool.consecutiveFailCount + 1 : 0;

        const updatedCard: Card = {
          ...card,
          commonPool: {
            fsrs: updatedFsrs,
            lastReviewedAt: nowIso,
            consecutiveFailCount: nextConsecutiveFailCount,
          },
          updatedAt: nowIso,
        };

        set((prev) => {
          const baseTodayMistakes =
            prev.sessionState.lastActiveDateKey === activeKey
              ? prev.sessionState.todayMistakeCardIds
              : [];

          const nextRetryCardIds =
            rating === "AGAIN"
              ? Array.from(new Set([...prev.sessionState.retryCardIds, cardId]))
              : prev.sessionState.retryCardIds.filter((id) => id !== cardId);

          const nextTodayMistakeCardIds =
            rating === "AGAIN"
              ? Array.from(new Set([...baseTodayMistakes, cardId]))
              : baseTodayMistakes;

          return {
            cards: prev.cards.map((c) => (c.id === cardId ? updatedCard : c)),
            sessionState: {
              retryCardIds: nextRetryCardIds,
              todayMistakeCardIds: nextTodayMistakeCardIds,
              lastActiveDateKey: activeKey,
            },
          };
        });
      },

      batchDemoteToLecturePool: (cardIds) => {
        if (cardIds.length === 0) return 0;
        const targetSet = new Set(cardIds);
        let demotedCount = 0;

        set((state) => {
          const nextCards = state.cards.map((card) => {
            if (!targetSet.has(card.id)) return card;
            demotedCount++;
            return demoteCardToLecturePool(card);
          });

          return {
            cards: nextCards,
            sessionState: {
              ...state.sessionState,
              retryCardIds: state.sessionState.retryCardIds.filter((id) => !targetSet.has(id)),
              todayMistakeCardIds: state.sessionState.todayMistakeCardIds.filter(
                (id) => !targetSet.has(id),
              ),
            },
          };
        });

        return demotedCount;
      },

      answerRecoveryTestCard: (cardId, rating, now = new Date()) => {
        const state = get();
        const card = state.cards.find((c) => c.id === cardId);
        if (!card || !card.commonPool) return null;

        if (rating === "GOOD") {
          // 正解なら共通プールへ復帰（Rating.GoodでFSRS更新）
          get().answerCommonPoolCard(cardId, "GOOD", now);
          return "RECOVERED";
        } else {
          // 不正解なら即座に所属講義の専用プール（未暗記）へ降格
          get().batchDemoteToLecturePool([cardId]);
          return "DEMOTED";
        }
      },

      exportBackupData: () => {
        const state = get();
        const courseMap = new Map(state.courses.map((c) => [c.id, c]));
        const lectureMap = new Map(state.lectures.map((l) => [l.id, l]));

        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: state.settings,
          cards: state.cards.map((card) => {
            const course = courseMap.get(card.courseId);
            const lecture = lectureMap.get(card.lectureId);
            return {
              courseId: card.courseId,
              courseName: course?.name ?? "未分類科目",
              coursePriorityMode: course?.priorityMode ?? "NORMAL",
              lectureId: card.lectureId,
              lectureName: lecture?.name ?? "未分類講義",
              lectureOrder: lecture?.order ?? 0,
              id: card.id,
              front: card.front,
              back: card.back,
              isSuspended: card.isSuspended,
              bundleId: card.bundleId,
              lecturePool: card.lecturePool,
              commonPool: card.commonPool,
              createdAt: card.createdAt,
              updatedAt: card.updatedAt,
            };
          }),
        };
      },

      importBackupJson: (backup) => {
        const state = get();
        const prevCourseCount = state.courses.length;
        const prevLectureCount = state.lectures.length;
        const prevCardCount = state.cards.length;

        const merged = importBackupData(
          backup.cards ?? [],
          state.courses,
          state.lectures,
          state.cards,
        );

        set({
          courses: merged.courses,
          lectures: merged.lectures,
          cards: merged.cards,
          settings: backup.settings ? { ...state.settings, ...backup.settings } : state.settings,
          selectedCourseId: state.selectedCourseId ?? merged.courses[0]?.id ?? null,
          selectedLectureId: state.selectedLectureId ?? merged.lectures[0]?.id ?? null,
        });

        return {
          addedCourses: merged.courses.length - prevCourseCount,
          addedLectures: merged.lectures.length - prevLectureCount,
          addedCards: merged.cards.length - prevCardCount,
        };
      },

      addCardsBatch: (courseId, lectureId, contents, customBundleId) => {
        const bundleId =
          customBundleId || `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newCards: Card[] = contents.map((c) =>
          createNewCard({
            id: `card_${generateId()}`,
            courseId,
            lectureId,
            front: c.question.trim(),
            back: c.answer.trim(),
            bundleId,
          }),
        );

        const signature = getBatchSignature(contents);

        set((state) => ({
          cards: [...newCards, ...state.cards],
          lastImportBatch: {
            lectureId,
            signature,
            bundleId,
            count: contents.length,
          },
        }));

        return {
          bundleId,
          addedCards: newCards,
        };
      },

      deleteCardsByBundleId: (bundleId) => {
        const initialCount = get().cards.length;
        const currentLastBatch = get().lastImportBatch;

        set((state) => ({
          cards: state.cards.filter((card) => card.bundleId !== bundleId),
          lastImportBatch: currentLastBatch?.bundleId === bundleId ? null : currentLastBatch,
        }));
        const deletedCount = initialCount - get().cards.length;
        return deletedCount;
      },

      isDuplicateOfLastBatch: (lectureId, contents) => {
        const last = get().lastImportBatch;
        if (!last) return false;
        if (last.lectureId !== lectureId) return false;
        const currentSignature = getBatchSignature(contents);
        return last.signature === currentSignature;
      },

      selectCourse: (courseId) => {
        set((state) => {
          let nextLectureId = state.selectedLectureId;
          if (courseId) {
            const lectures = state.lectures.filter((l) => l.courseId === courseId);
            if (!lectures.some((l) => l.id === nextLectureId)) {
              nextLectureId = lectures[0]?.id ?? null;
            }
          }
          return {
            selectedCourseId: courseId,
            selectedLectureId: nextLectureId,
          };
        });
      },

      selectLecture: (lectureId) => {
        set((state) => {
          let nextCourseId = state.selectedCourseId;
          if (lectureId) {
            const lecture = state.lectures.find((l) => l.id === lectureId);
            if (lecture) {
              nextCourseId = lecture.courseId;
            }
          }
          return {
            selectedLectureId: lectureId,
            selectedCourseId: nextCourseId,
          };
        });
      },

      getLectureProgress: (lectureId) => {
        const state = get();
        const cards = state.cards.filter((c) => c.lectureId === lectureId);
        let unattemptedCount = 0;
        let ungraduatedCount = 0;
        let graduationRecommendedCount = 0;
        let graduatedCount = 0;
        let retryCount = 0;
        let dueCount = 0;
        let earliestUnlockAt: string | null = null;
        let isWaitingLocked = false;

        const now = new Date();
        const waitingHours = state.settings.waitingDurationHours;
        const cutoffHour = state.settings.dayCutoffHour;
        const nextCutoff = getNextCutoffTime(now, cutoffHour);
        const retrySet = new Set(state.sessionState.retryCardIds);

        for (const card of cards) {
          const { phase, lastAttemptAt } = card.lecturePool;
          if (phase === "UNATTEMPTED") {
            unattemptedCount++;
          } else if (phase === "UNGRADUATED") {
            ungraduatedCount++;
          } else if (phase === "GRADUATION_RECOMMENDED") {
            graduationRecommendedCount++;
          } else if (phase === "GRADUATED") {
            graduatedCount++;
          }

          if (phase !== "GRADUATED" && isWaitingCardLocked(card, waitingHours, now)) {
            isWaitingLocked = true;
            if (lastAttemptAt) {
              const unlock = new Date(lastAttemptAt);
              unlock.setHours(unlock.getHours() + waitingHours);
              const unlockIso = unlock.toISOString();
              if (!earliestUnlockAt || unlockIso < earliestUnlockAt) {
                earliestUnlockAt = unlockIso;
              }
            }
          }

          if (
            phase === "GRADUATED" &&
            !card.isSuspended &&
            card.commonPool &&
            !isReviewedToday(card.commonPool.lastReviewedAt, now, cutoffHour)
          ) {
            if (retrySet.has(card.id)) {
              retryCount++;
            } else if (new Date(card.commonPool.fsrs.due) < nextCutoff) {
              dueCount++;
            }
          }
        }

        return {
          lectureId,
          totalCards: cards.length,
          unattemptedCount,
          ungraduatedCount,
          graduationRecommendedCount,
          graduatedCount,
          retryCount,
          dueCount,
          isWaitingLocked,
          earliestUnlockAt,
        };
      },

      getCourseProgress: (courseId) => {
        const state = get();
        const cards = state.cards.filter((c) => c.courseId === courseId);
        const totalCards = cards.length;
        let unattemptedCount = 0;
        let ungraduatedCount = 0;
        let graduationRecommendedCount = 0;
        let graduatedCount = 0;
        let retryCount = 0;
        let dueCount = 0;

        const now = new Date();
        const cutoffHour = state.settings.dayCutoffHour;
        const nextCutoff = getNextCutoffTime(now, cutoffHour);
        const retrySet = new Set(state.sessionState.retryCardIds);

        for (const card of cards) {
          const phase = card.lecturePool.phase;
          if (phase === "UNATTEMPTED") {
            unattemptedCount++;
          } else if (phase === "UNGRADUATED") {
            ungraduatedCount++;
          } else if (phase === "GRADUATION_RECOMMENDED") {
            graduationRecommendedCount++;
          } else if (phase === "GRADUATED") {
            graduatedCount++;
            if (
              !card.isSuspended &&
              card.commonPool &&
              !isReviewedToday(card.commonPool.lastReviewedAt, now, cutoffHour)
            ) {
              if (retrySet.has(card.id)) {
                retryCount++;
              } else if (new Date(card.commonPool.fsrs.due) < nextCutoff) {
                dueCount++;
              }
            }
          }
        }

        const graduatedPercentage =
          totalCards === 0 ? 0 : Math.round((graduatedCount / totalCards) * 100);

        return {
          courseId,
          totalCards,
          unattemptedCount,
          ungraduatedCount,
          graduationRecommendedCount,
          graduatedCount,
          graduatedPercentage,
          retryCount,
          dueCount,
        };
      },

      getLectureTrainingQueue: (lectureId, waitingHours, now) => {
        return buildLectureTrainingQueue(
          get().cards,
          lectureId,
          waitingHours ?? get().settings.waitingDurationHours,
          now ?? new Date(),
        );
      },

      loadSampleData: () => {
        const now = new Date().toISOString();
        const course1: Course = {
          id: "course_circuits",
          name: "電気回路I",
          priorityMode: "NORMAL",
          createdAt: now,
          updatedAt: now,
        };
        const course2: Course = {
          id: "course_linear_algebra",
          name: "線形代数",
          priorityMode: "NORMAL",
          createdAt: now,
          updatedAt: now,
        };

        const lec1: Lecture = {
          id: "lec_circuits_1",
          courseId: course1.id,
          name: "第1回 オームの法則とキルヒホッフの法則",
          order: 1,
          customPriorityMode: null,
          createdAt: now,
          updatedAt: now,
        };
        const lec2: Lecture = {
          id: "lec_circuits_2",
          courseId: course1.id,
          name: "第2回 RL・RC過渡現象",
          order: 2,
          customPriorityMode: null,
          createdAt: now,
          updatedAt: now,
        };
        const lec3: Lecture = {
          id: "lec_algebra_1",
          courseId: course2.id,
          name: "第1回 行列の基本変形と階数",
          order: 1,
          customPriorityMode: null,
          createdAt: now,
          updatedAt: now,
        };

        const card1 = createNewCard({
          id: "card_c1_1",
          courseId: course1.id,
          lectureId: lec1.id,
          front: "オームの法則の基本方程式は？",
          back: "V = R · I (電圧 = 抵抗 × 電流)",
        });

        const card2 = createNewCard({
          id: "card_c1_2",
          courseId: course1.id,
          lectureId: lec1.id,
          front: "キルヒホッフの第1法則（電流則 KCL）の内容は？",
          back: "回路の任意の接続点（節点）に流入する電流の総和は、流出する電流の総和に等しい（ΣI = 0）。",
        });
        // 未卒業（連続正解0・前回ミス）サンプル
        card2.lecturePool = {
          phase: "UNGRADUATED",
          consecutiveCorrect: 0,
          lastAttemptAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        };

        const card3 = createNewCard({
          id: "card_c1_3",
          courseId: course1.id,
          lectureId: lec1.id,
          front: "キルヒホッフの第2法則（電圧則 KVL）の内容は？",
          back: "回路内の任意の閉路に沿って一周したとき、起電力の総和と電圧降下の総和は等しい（ΣV = 0）。",
        });
        // 未卒業（1回正解・8時間経過済み -> チェック区分3の対象）サンプル
        card3.lecturePool = {
          phase: "UNGRADUATED",
          consecutiveCorrect: 1,
          lastAttemptAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        };

        const card4 = promoteCardToGraduate(
          createNewCard({
            id: "card_c1_4",
            courseId: course1.id,
            lectureId: lec1.id,
            front: "抵抗 R の単位とその記号は？",
            back: "オーム [Ω]",
          }),
          new Date(Date.now() - 24 * 3600 * 1000), // 1日前に卒業したサンプル
        );

        const card5 = createNewCard({
          id: "card_c2_1",
          courseId: course2.id,
          lectureId: lec3.id,
          front: "行列の行基本変形における3つの許容操作は？",
          back: "1. 2つの行を入れ替える\n2. ある行を0でない定数倍する\n3. ある行の定数倍を別の行に加える",
        });

        set({
          courses: [course1, course2],
          lectures: [lec1, lec2, lec3],
          cards: [card1, card2, card3, card4, card5],
          selectedCourseId: course1.id,
          selectedLectureId: lec1.id,
        });
      },
    }),
    {
      name: "kioku-app-storage",
      partialize: (state) => ({
        courses: state.courses,
        lectures: state.lectures,
        cards: state.cards,
        settings: state.settings,
        sessionState: state.sessionState,
        selectedCourseId: state.selectedCourseId,
        selectedLectureId: state.selectedLectureId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state || !Array.isArray(state.cards)) return;
        // 旧データスキーマからの自動正規化
        state.cards = state.cards.map((card) => ({
          ...card,
          lecturePool: normalizeLecturePoolState(card.lecturePool),
        }));
      },
    },
  ),
);
