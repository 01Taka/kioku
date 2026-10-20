import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Course,
  Lecture,
  Card,
  PriorityMode,
  LectureCardPhase,
  LectureProgress,
  CourseProgress,
  FlashcardContent,
} from "../types/schema";
import {
  createNewCard,
  graduateCardToCommonPool,
  demoteCardToLecturePool,
  getSuspensionStatus,
  isWaitingCardLocked,
  SYSTEM_CONSTANTS,
} from "../types/schema";
import { createEmptyCard } from "ts-fsrs";

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

interface AppState {
  courses: Course[];
  lectures: Lecture[];
  cards: Card[];

  selectedCourseId: string | null;
  selectedLectureId: string | null;

  lastImportBatch: LastImportBatchInfo | null;

  // Course actions
  addCourse: (name: string, priorityMode?: PriorityMode) => Course;
  updateCourse: (
    id: string,
    updates: Partial<Pick<Course, "name" | "priorityMode">>,
  ) => void;
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
  addCard: (
    courseId: string,
    lectureId: string,
    front: string,
    back: string,
  ) => Card;
  updateCard: (
    id: string,
    updates: Partial<Pick<Card, "front" | "back" | "isSuspended">>,
  ) => void;
  deleteCard: (id: string) => void;
  setCardPhase: (id: string, phase: LectureCardPhase) => void;
  toggleCardSuspension: (id: string) => void;

  // Batch / Bundle actions
  addCardsBatch: (
    courseId: string,
    lectureId: string,
    contents: FlashcardContent[],
    customBundleId?: string,
  ) => { bundleId: string; addedCards: Card[] };
  deleteCardsByBundleId: (bundleId: string) => number;
  isDuplicateOfLastBatch: (
    lectureId: string,
    contents: FlashcardContent[],
  ) => boolean;

  // Navigation / Selection
  selectCourse: (courseId: string | null) => void;
  selectLecture: (lectureId: string | null) => void;

  // Aggregation helpers
  getLectureProgress: (lectureId: string) => LectureProgress;
  getCourseProgress: (courseId: string) => CourseProgress;

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
      selectedCourseId: null,
      selectedLectureId: null,
      lastImportBatch: null,

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
            course.id === id
              ? { ...course, ...updates, updatedAt: now }
              : course,
          ),
        }));
      },

      deleteCourse: (id) => {
        set((state) => {
          const remainingCourses = state.courses.filter((c) => c.id !== id);
          const remainingLectures = state.lectures.filter(
            (l) => l.courseId !== id,
          );
          const remainingCards = state.cards.filter((c) => c.courseId !== id);

          const nextSelectedCourseId =
            state.selectedCourseId === id
              ? remainingCourses[0]?.id ?? null
              : state.selectedCourseId;

          const nextSelectedLectureId =
            remainingLectures.some((l) => l.id === state.selectedLectureId)
              ? state.selectedLectureId
              : remainingLectures.find(
                  (l) => l.courseId === nextSelectedCourseId,
                )?.id ?? null;

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
        const currentLectures = get().lectures.filter(
          (l) => l.courseId === courseId,
        );
        const maxOrder = currentLectures.reduce(
          (max, l) => Math.max(max, l.order),
          0,
        );
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
            lecture.id === id
              ? { ...lecture, ...updates, updatedAt: now }
              : lecture,
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
              ? remainingLectures.find(
                  (l) => l.courseId === targetLecture?.courseId,
                )?.id ??
                remainingLectures[0]?.id ??
                null
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
        const now = new Date().toISOString();

        if (phase === "ACTIVE") {
          // Promote to common pool
          const initialFsrs = createEmptyCard();
          updatedCard = graduateCardToCommonPool(card, initialFsrs);
        } else if (phase === "WAITING") {
          updatedCard = {
            ...card,
            lecturePool: {
              phase: "WAITING",
              consecutiveCorrect: 1,
              lastCorrectAt: now,
            },
            commonPool: null,
            updatedAt: now,
          };
        } else {
          // Demote to UNMEMORIZED
          updatedCard = demoteCardToLecturePool(card);
        }

        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? updatedCard : c)),
        }));
      },

      toggleCardSuspension: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === id
              ? { ...card, isSuspended: !card.isSuspended, updatedAt: now }
              : card,
          ),
        }));
      },

      addCardsBatch: (courseId, lectureId, contents, customBundleId) => {
        const bundleId = customBundleId || `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
          lastImportBatch:
            currentLastBatch?.bundleId === bundleId
              ? null
              : currentLastBatch,
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
            const lectures = state.lectures.filter(
              (l) => l.courseId === courseId,
            );
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
        const cards = get().cards.filter((c) => c.lectureId === lectureId);
        let unmemorizedCount = 0;
        let waitingCount = 0;
        let activeCount = 0;
        let earliestUnlockAt: string | null = null;
        let isWaitingLocked = false;

        const now = new Date();

        for (const card of cards) {
          if (card.lecturePool.phase === "UNMEMORIZED") {
            unmemorizedCount++;
          } else if (card.lecturePool.phase === "WAITING") {
            waitingCount++;
            if (isWaitingCardLocked(card, SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS, now)) {
              isWaitingLocked = true;
              if (card.lecturePool.lastCorrectAt) {
                const unlock = new Date(card.lecturePool.lastCorrectAt);
                unlock.setHours(
                  unlock.getHours() + SYSTEM_CONSTANTS.DEFAULT_WAITING_HOURS,
                );
                const unlockIso = unlock.toISOString();
                if (!earliestUnlockAt || unlockIso < earliestUnlockAt) {
                  earliestUnlockAt = unlockIso;
                }
              }
            }
          } else if (card.lecturePool.phase === "ACTIVE") {
            activeCount++;
          }
        }

        return {
          lectureId,
          unmemorizedCount,
          waitingCount,
          activeCount,
          retryCount: 0,
          dueCount: 0,
          isWaitingLocked,
          earliestUnlockAt,
        };
      },

      getCourseProgress: (courseId) => {
        const cards = get().cards.filter((c) => c.courseId === courseId);
        const totalCards = cards.length;
        const activeCount = cards.filter(
          (c) => c.lecturePool.phase === "ACTIVE",
        ).length;
        const graduatedPercentage =
          totalCards === 0 ? 0 : Math.round((activeCount / totalCards) * 100);

        return {
          courseId,
          totalCards,
          activeCount,
          graduatedPercentage,
          retryCount: 0,
          dueCount: 0,
        };
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

        const card3 = createNewCard({
          id: "card_c1_3",
          courseId: course1.id,
          lectureId: lec1.id,
          front: "キルヒホッフの第2法則（電圧則 KVL）の内容は？",
          back: "回路内の任意の閉路に沿って一周したとき、起電力の総和と電圧降下の総和は等しい（ΣV = 0）。",
        });
        // 待機中サンプル
        card3.lecturePool = {
          phase: "WAITING",
          consecutiveCorrect: 1,
          lastCorrectAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4時間前
        };

        const card4 = graduateCardToCommonPool(
          createNewCard({
            id: "card_c1_4",
            courseId: course1.id,
            lectureId: lec1.id,
            front: "抵抗 R の単位とその記号は？",
            back: "オーム [Ω]",
          }),
          createEmptyCard(),
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
        selectedCourseId: state.selectedCourseId,
        selectedLectureId: state.selectedLectureId,
      }),
    },
  ),
);
