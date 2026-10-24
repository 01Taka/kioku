import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import { ArrowLeftIcon, EditIcon, PlayIcon, PlusIcon, TrashIcon } from "../icons";
import { LecturePlayer, type PracticeCardItem } from "../practice/LecturePlayer";
import { LectureEditView } from "./LectureEditView";

export type CourseTab = "CHECK" | "REVIEW" | "EDIT";

interface CourseDetailViewProps {
  courseId: string;
  onBackToCourseList: () => void;
}

export function CourseDetailView({ courseId, onBackToCourseList }: CourseDetailViewProps) {
  const {
    courses,
    lectures,
    cards,
    settings,
    addLecture,
    deleteLecture,
    getLectureTrainingQueue,
    answerLectureTrainingCard,
    graduateRecommendedCardsInLecture,
    batchGraduateCards,
  } = useAppStore();

  const course = courses.find((c) => c.id === courseId);
  const courseLectures = useMemo(
    () => lectures.filter((l) => l.courseId === courseId),
    [lectures, courseId],
  );

  // 上部タブ（チェック / 復習 / 編集）
  const [activeTab, setActiveTab] = useState<CourseTab>("CHECK");

  // ① チェックタブ: 単一選択講義ID
  const [selectedCheckLectureId, setSelectedCheckLectureId] = useState<string | null>(
    courseLectures[0]?.id || null,
  );

  // ② 復習タブ: 複数選択講義IDセット
  const [selectedReviewLectureIds, setSelectedReviewLectureIds] = useState<Set<string>>(
    () => new Set(courseLectures.map((l) => l.id)),
  );

  // ③ 編集タブ: 現在編集中の講義ID
  const [editingLectureId, setEditingLectureId] = useState<string | null>(null);

  // 新規講義作成状態
  const [isAddingLecture, setIsAddingLecture] = useState(false);
  const [newLectureName, setNewLectureName] = useState("");

  // 演習セッション状態
  const [practiceSession, setPracticeSession] = useState<{
    mode: "TRAINING" | "FREE_PRACTICE";
    title: string;
    cards: PracticeCardItem[];
    recommendedCount: number;
    lectureIdForGraduation?: string;
    currentLectureId?: string;
  } | null>(null);

  // リアルタイム時間更新用タイマー (30秒ごと)
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  // チェック対象キュー
  const checkTrainingQueue = useMemo(() => {
    if (!selectedCheckLectureId) return null;
    return getLectureTrainingQueue(
      selectedCheckLectureId,
      settings.waitingDurationHours,
      new Date(nowTick),
    );
  }, [selectedCheckLectureId, getLectureTrainingQueue, settings.waitingDurationHours, nowTick]);

  const selectedCheckLecture = courseLectures.find((l) => l.id === selectedCheckLectureId);

  // 指定した講義IDのチェック演習を開始する（最大10問）
  const startCheckSessionForLecture = useCallback(
    (lectureId: string) => {
      const queue = getLectureTrainingQueue(lectureId, settings.waitingDurationHours, new Date());
      if (queue.items.length === 0) return;

      const targetLecture = courseLectures.find((l) => l.id === lectureId);
      const batchItems = queue.items.slice(0, 10);

      setPracticeSession({
        mode: "TRAINING",
        title: `${course?.name} - ${targetLecture?.name} (チェック)`,
        currentLectureId: lectureId,
        cards: batchItems.map((item) => {
          const c = item.card;
          const badge =
            item.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED"
              ? c.lecturePool.phase === "GRADUATION_RECOMMENDED"
                ? `卒業推奨 (連続${c.lecturePool.consecutiveCorrect}回正解)`
                : `未卒業 (連続${c.lecturePool.consecutiveCorrect}回正解 → 正解で卒業推奨)`
              : item.checkCategory === "PRIORITY_2_UNATTEMPTED"
                ? "未実施 (初回チャレンジ)"
                : "未卒業 (連続正解0・リベンジ)";
          return {
            id: c.id,
            front: c.front,
            back: c.back,
            checkCategory: item.checkCategory,
            badge,
          };
        }),
        recommendedCount: 0,
        lectureIdForGraduation: lectureId,
      });
    },
    [course?.name, courseLectures, getLectureTrainingQueue, settings.waitingDurationHours],
  );

  // ① チェックタブ: はじめる実行
  const handleStartCheck = () => {
    if (!selectedCheckLectureId) return;
    startCheckSessionForLecture(selectedCheckLectureId);
  };

  // ② 復習タブ: はじめる実行（複数講義の全問シャッフルから最大10問）
  const handleStartReview = useCallback(() => {
    const targetCards = cards.filter(
      (c) => selectedReviewLectureIds.has(c.lectureId) && !c.isSuspended,
    );
    if (targetCards.length === 0) return;

    // シャッフル
    const shuffled = [...targetCards].sort(() => Math.random() - 0.5);
    const batchCards = shuffled.slice(0, 10);

    setPracticeSession({
      mode: "FREE_PRACTICE",
      title: `${course?.name} - 全問復習`,
      cards: batchCards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        badge:
          c.lecturePool.phase === "GRADUATED"
            ? "卒業済"
            : c.lecturePool.phase === "GRADUATION_RECOMMENDED"
              ? `卒業推奨 (連続${c.lecturePool.consecutiveCorrect}回)`
              : c.lecturePool.phase === "UNGRADUATED"
                ? `未卒業 (連続${c.lecturePool.consecutiveCorrect}回)`
                : "未実施",
      })),
      recommendedCount: 0,
    });
  }, [cards, selectedReviewLectureIds, course?.name]);

  // 結果画面用のメインアクション算出
  const getMainActionForSession = useCallback(() => {
    if (!practiceSession) return undefined;

    if (practiceSession.mode === "TRAINING") {
      const currentLectureId = practiceSession.currentLectureId || selectedCheckLectureId;
      if (!currentLectureId) return undefined;

      // 1. 同じ教材（同じ講義）内でまだチェック対象がある場合
      const currentQueue = getLectureTrainingQueue(
        currentLectureId,
        settings.waitingDurationHours,
        new Date(),
      );
      if (currentQueue.items.length > 0) {
        const count = Math.min(10, currentQueue.items.length);
        return {
          label: count === 10 ? "次の10問" : `次の${count}問`,
          onClick: () => {
            startCheckSessionForLecture(currentLectureId);
          },
        };
      }

      // 2. 同じ科目内の他の教材（他の講義）にチェック対象がある場合
      const otherLectures = courseLectures.filter((l) => l.id !== currentLectureId);
      for (const otherL of otherLectures) {
        const otherQueue = getLectureTrainingQueue(
          otherL.id,
          settings.waitingDurationHours,
          new Date(),
        );
        if (otherQueue.items.length > 0) {
          const count = Math.min(10, otherQueue.items.length);
          return {
            label: `${otherL.name}のチェックを開始（${count}問）`,
            onClick: () => {
              setSelectedCheckLectureId(otherL.id);
              startCheckSessionForLecture(otherL.id);
            },
          };
        }
      }

      // 3. どちらもない場合
      return {
        label: "完了",
        isComplete: true,
        onClick: () => {
          setPracticeSession(null);
        },
      };
    }

    if (practiceSession.mode === "FREE_PRACTICE") {
      // 教材の復習: 「次の10問」 (ランダムで同じ教材内で10問選択)
      return {
        label: "次の10問",
        onClick: () => {
          handleStartReview();
        },
      };
    }

    return undefined;
  }, [
    practiceSession,
    selectedCheckLectureId,
    getLectureTrainingQueue,
    settings.waitingDurationHours,
    courseLectures,
    startCheckSessionForLecture,
    handleStartReview,
  ]);

  // 新規講義作成
  const handleCreateLecture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLectureName.trim() || !courseId) return;
    const created = addLecture(courseId, newLectureName.trim());
    setNewLectureName("");
    setIsAddingLecture(false);
    setSelectedCheckLectureId(created.id);
  };

  if (!course) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>科目が見つかりません</p>
        <button
          onClick={onBackToCourseList}
          className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-xs text-white"
        >
          教材一覧へ戻る
        </button>
      </div>
    );
  }

  // もし編集タブで特定の講義を編集中なら LectureEditView を表示
  if (activeTab === "EDIT" && editingLectureId) {
    const lectureToEdit = courseLectures.find((l) => l.id === editingLectureId);
    if (lectureToEdit) {
      return (
        <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col overflow-y-auto bg-slate-950 p-4 select-none sm:p-6">
          <LectureEditView
            courseId={course.id}
            courseName={course.name}
            lectureId={lectureToEdit.id}
            lectureName={lectureToEdit.name}
            onBack={() => setEditingLectureId(null)}
          />
        </div>
      );
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col overflow-hidden bg-slate-950 p-4 select-none sm:p-6">
      {/* 科目ヘッダー & パンくず */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onBackToCourseList}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="教材一覧へ戻る"
          >
            <ArrowLeftIcon size={16} />
          </button>
          <div>
            <h1 className="flex items-center space-x-2 text-base font-bold text-white">
              <span>{course.name}</span>
            </h1>
            <span className="font-mono text-[11px] text-slate-400">
              全 {courseLectures.length} 講義
            </span>
          </div>
        </div>
      </div>

      {/* 上部に チェック / 復習 / 編集 のタブ（画面幅全体を等間隔で配置） */}
      <div className="mb-4 grid grid-cols-3 gap-1.5 border-b border-slate-800 bg-slate-950 pb-2 sm:flex sm:items-center sm:space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("CHECK")}
          className={`flex cursor-pointer items-center justify-center rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-4 ${
            activeTab === "CHECK"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          ✅ チェック
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REVIEW")}
          className={`flex cursor-pointer items-center justify-center rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-4 ${
            activeTab === "REVIEW"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          🔁 復習
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EDIT")}
          className={`flex cursor-pointer items-center justify-center rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-4 ${
            activeTab === "EDIT"
              ? "border border-slate-700 bg-slate-800 text-white"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          ✏️ 編集
        </button>
      </div>

      {/* ======================================================== */}
      {/* ① チェックタブ */}
      {/* ======================================================== */}
      {activeTab === "CHECK" && (
        <div className="flex flex-1 flex-col space-y-4 overflow-hidden">
          {/* リストの上、タブの下に「はじめる」ボタンを配置 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleStartCheck}
              disabled={!checkTrainingQueue || checkTrainingQueue.items.length === 0}
              className="flex cursor-pointer items-center space-x-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-600/30 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayIcon size={14} />
              <span>チェックをはじめる ({checkTrainingQueue?.items.length ?? 0}枚)</span>
            </button>

            {selectedCheckLecture && (
              <span className="text-xs font-medium text-indigo-300">
                選択中: <strong>{selectedCheckLecture.name}</strong>
              </span>
            )}
          </div>

          {/* 講義リストをクリックして一つだけ選択 */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {courseLectures.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
                講義がありません。「編集」タブから講義を追加してください。
              </div>
            ) : (
              courseLectures.map((lecture) => {
                const isSelected = selectedCheckLectureId === lecture.id;
                const queue = getLectureTrainingQueue(
                  lecture.id,
                  settings.waitingDurationHours,
                  new Date(nowTick),
                );
                const checkCount = queue.cards.length;

                // 残り時間表示ロジック
                let rightSideContent: React.ReactNode;
                if (checkCount > 0) {
                  rightSideContent = (
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {checkCount} 枚
                    </span>
                  );
                } else if (queue.earliestUnlockAt) {
                  const unlockTimeMs = new Date(queue.earliestUnlockAt).getTime();
                  const diffMs = unlockTimeMs - nowTick;
                  if (diffMs <= 0) {
                    rightSideContent = (
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        チェック可能
                      </span>
                    );
                  } else {
                    const totalMinutes = Math.ceil(diffMs / 60000);
                    if (totalMinutes < 120) {
                      rightSideContent = (
                        <span className="font-mono text-xs text-slate-400">
                          あと {totalMinutes}分
                        </span>
                      );
                    } else {
                      const hours = Math.ceil(totalMinutes / 60);
                      rightSideContent = (
                        <span className="font-mono text-xs text-slate-400">あと {hours}時間</span>
                      );
                    }
                  }
                } else {
                  rightSideContent = (
                    <span className="text-xs font-semibold text-emerald-400/90">完了</span>
                  );
                }

                return (
                  <div
                    key={lecture.id}
                    onClick={() => setSelectedCheckLectureId(lecture.id)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                      isSelected
                        ? "border-amber-500/80 bg-amber-950/20 shadow-sm"
                        : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-white">{lecture.name}</span>
                    <div className="flex-shrink-0">{rightSideContent}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ② 復習タブ */}
      {/* ======================================================== */}
      {activeTab === "REVIEW" && (
        <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
          {/* リストの上 タブの下にはじめるボタンを配置 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleStartReview}
              disabled={selectedReviewLectureIds.size === 0}
              className="flex cursor-pointer items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayIcon size={14} />
              <span>全問復習をはじめる ({selectedReviewLectureIds.size}講義)</span>
            </button>

            {/* その下にすべて選択 / すべて選択解除 第二ボタンを配置 */}
            <button
              type="button"
              onClick={() => {
                if (selectedReviewLectureIds.size === courseLectures.length) {
                  setSelectedReviewLectureIds(new Set());
                } else {
                  setSelectedReviewLectureIds(new Set(courseLectures.map((l) => l.id)));
                }
              }}
              className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
            >
              {selectedReviewLectureIds.size === courseLectures.length
                ? "すべて選択解除"
                : "すべて選択"}
            </button>
          </div>

          {/* 講義リストをクリックしてマルチセレクト */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {courseLectures.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
                講義がありません。「編集」タブから講義を追加してください。
              </div>
            ) : (
              courseLectures.map((lecture) => {
                const isChecked = selectedReviewLectureIds.has(lecture.id);
                const lectureCardCount = cards.filter(
                  (c) => c.lectureId === lecture.id && !c.isSuspended,
                ).length;

                return (
                  <div
                    key={lecture.id}
                    onClick={() => {
                      const next = new Set(selectedReviewLectureIds);
                      if (isChecked) {
                        next.delete(lecture.id);
                      } else {
                        next.add(lecture.id);
                      }
                      setSelectedReviewLectureIds(next);
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                      isChecked
                        ? "border-indigo-500/70 bg-indigo-950/20 shadow-sm"
                        : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // 親divクリックで処理
                        className="cursor-pointer rounded accent-indigo-500"
                      />
                      <span className="text-xs font-bold text-white">{lecture.name}</span>
                    </div>

                    <span className="font-mono text-xs text-slate-400">
                      出題可能: {lectureCardCount} 枚
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ③ 編集タブ */}
      {/* ======================================================== */}
      {activeTab === "EDIT" && (
        <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
          {/* 講義リストの一番上に新しい講義を追加するためのボタンを追加 */}
          <div>
            {isAddingLecture ? (
              <form
                onSubmit={handleCreateLecture}
                className="animate-fadeIn space-y-2 rounded-xl border border-indigo-500/50 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">新規講義を追加</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingLecture(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    キャンセル
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newLectureName}
                    onChange={(e) => setNewLectureName(e.target.value)}
                    placeholder="講義名を入力 (例: 第1回 オームの法則)"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newLectureName.trim()}
                    className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    追加
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingLecture(true)}
                className="flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-indigo-400 transition hover:border-indigo-500/60 hover:bg-slate-800 hover:text-indigo-300"
              >
                <PlusIcon size={14} />
                <span>新しい講義を追加</span>
              </button>
            )}
          </div>

          {/* 講義リストをクリックして講義の編集画面を開ける */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {courseLectures.map((lecture) => {
              const cardCount = cards.filter((c) => c.lectureId === lecture.id).length;
              return (
                <div
                  key={lecture.id}
                  onClick={() => setEditingLectureId(lecture.id)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 transition hover:border-indigo-500/60"
                >
                  <div className="flex items-center space-x-2.5">
                    <EditIcon
                      size={15}
                      className="text-slate-500 transition group-hover:text-indigo-400"
                    />
                    <div>
                      <span className="text-xs font-bold text-white transition group-hover:text-indigo-300">
                        {lecture.name}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">
                        ({cardCount} 枚)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`講義「${lecture.name}」とカードを削除しますか？`)) {
                          deleteLecture(lecture.id);
                        }
                      }}
                      className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                      title="講義を削除"
                    >
                      <TrashIcon size={13} />
                    </button>
                    <span className="text-xs font-medium text-indigo-400 transition group-hover:translate-x-0.5">
                      編集 &gt;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 演習プレイヤー（チェックモード または 全問復習モード） */}
      {practiceSession && (
        <LecturePlayer
          lectureTitle={practiceSession.title}
          mode={practiceSession.mode}
          cards={practiceSession.cards}
          mainAction={getMainActionForSession()}
          onAnswer={(cardId, result) => {
            if (practiceSession.mode === "TRAINING") {
              answerLectureTrainingCard(cardId, result);
            }
          }}
          recommendedCount={practiceSession.recommendedCount}
          onGraduateSelected={(cardIds) => {
            const count = batchGraduateCards(cardIds);
            return count;
          }}
          onGraduateRecommended={() => {
            if (practiceSession.lectureIdForGraduation) {
              const count = graduateRecommendedCardsInLecture(
                practiceSession.lectureIdForGraduation,
              );
              if (count > 0) {
                alert(`🎓 ${count} 枚の卒業推奨カードを共通プール（卒業済）へ移動しました！`);
              }
              return count;
            }
            return 0;
          }}
          onClose={() => setPracticeSession(null)}
        />
      )}
    </div>
  );
}
