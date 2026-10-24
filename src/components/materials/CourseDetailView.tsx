import { useState, useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";
import {
  PlayIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  ArrowLeftIcon,
} from "../icons";
import { LectureEditView } from "./LectureEditView";
import { LecturePlayer, type PracticeCardItem } from "../practice/LecturePlayer";

export type CourseTab = "CHECK" | "REVIEW" | "EDIT";

interface CourseDetailViewProps {
  courseId: string;
  onBackToCourseList: () => void;
}

export function CourseDetailView({
  courseId,
  onBackToCourseList,
}: CourseDetailViewProps) {
  const {
    courses,
    lectures,
    cards,
    settings,
    addLecture,
    deleteLecture,
    getLectureProgress,
    getLectureTrainingQueue,
    answerLectureTrainingCard,
    graduateRecommendedCardsInLecture,
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
  } | null>(null);

  // チェック対象キュー
  const checkTrainingQueue = useMemo(() => {
    if (!selectedCheckLectureId) return null;
    return getLectureTrainingQueue(
      selectedCheckLectureId,
      settings.waitingDurationHours,
      new Date(),
    );
  }, [selectedCheckLectureId, getLectureTrainingQueue, settings.waitingDurationHours, cards]);

  const selectedCheckLecture = courseLectures.find(
    (l) => l.id === selectedCheckLectureId,
  );

  const checkProgress = selectedCheckLectureId
    ? getLectureProgress(selectedCheckLectureId)
    : null;

  // ① チェックタブ: はじめる実行
  const handleStartCheck = () => {
    if (!checkTrainingQueue || checkTrainingQueue.items.length === 0) return;
    setPracticeSession({
      mode: "TRAINING",
      title: `${course?.name} - ${selectedCheckLecture?.name} (チェック)`,
      cards: checkTrainingQueue.items.map((item) => {
        const c = item.card;
        let badge = "";
        if (item.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED") {
          badge =
            c.lecturePool.phase === "GRADUATION_RECOMMENDED"
              ? `卒業推奨 (連続${c.lecturePool.consecutiveCorrect}回正解)`
              : `未卒業 (連続${c.lecturePool.consecutiveCorrect}回正解 → 正解で卒業推奨)`;
        } else if (item.checkCategory === "PRIORITY_2_UNATTEMPTED") {
          badge = "未実施 (初回チャレンジ)";
        } else {
          badge = "未卒業 (連続正解0・リベンジ)";
        }
        return {
          id: c.id,
          front: c.front,
          back: c.back,
          checkCategory: item.checkCategory,
          badge,
        };
      }),
      recommendedCount: checkProgress?.graduationRecommendedCount ?? 0,
      lectureIdForGraduation: selectedCheckLectureId || undefined,
    });
  };

  // ② 復習タブ: はじめる実行（複数講義の全問シャッフル）
  const handleStartReview = () => {
    const targetCards = cards.filter(
      (c) => selectedReviewLectureIds.has(c.lectureId) && !c.isSuspended,
    );
    if (targetCards.length === 0) return;

    // シャッフル
    const shuffled = [...targetCards].sort(() => Math.random() - 0.5);

    setPracticeSession({
      mode: "FREE_PRACTICE",
      title: `${course?.name} - 複数講義の全問復習 (${targetCards.length}枚)`,
      cards: shuffled.map((c) => ({
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
  };

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
          className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs"
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
        <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-4 sm:p-6 max-w-4xl w-full mx-auto select-none">
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
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden select-none p-4 sm:p-6 max-w-4xl w-full mx-auto">
      {/* 科目ヘッダー & パンくず */}
      <div className="border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onBackToCourseList}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="教材一覧へ戻る"
          >
            <ArrowLeftIcon size={16} />
          </button>
          <div>
            <h1 className="text-base font-bold text-white flex items-center space-x-2">
              <span>{course.name}</span>
            </h1>
            <span className="text-[11px] text-slate-400 font-mono">
              全 {courseLectures.length} 講義
            </span>
          </div>
        </div>
      </div>

      {/* 上部に チェック / 復習 / 編集 のタブ */}
      <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 mb-4 bg-slate-950">
        <button
          type="button"
          onClick={() => setActiveTab("CHECK")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "CHECK"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          ✅ チェック
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REVIEW")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "REVIEW"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          🔁 復習
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EDIT")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "EDIT"
              ? "bg-slate-800 text-white border border-slate-700"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          ✏️ 編集
        </button>
      </div>

      {/* ======================================================== */}
      {/* ① チェックタブ */}
      {/* ======================================================== */}
      {activeTab === "CHECK" && (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* リストの上、タブの下に「はじめる」ボタンを配置 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleStartCheck}
              disabled={!checkTrainingQueue || checkTrainingQueue.items.length === 0}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/30 flex items-center space-x-2 transition cursor-pointer"
            >
              <PlayIcon size={14} />
              <span>
                チェックをはじめる ({checkTrainingQueue?.items.length ?? 0}枚)
              </span>
            </button>

            {selectedCheckLecture && (
              <span className="text-xs text-indigo-300 font-medium">
                選択中: <strong>{selectedCheckLecture.name}</strong>
              </span>
            )}
          </div>

          {/* 講義リストをクリックして一つだけ選択 */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {courseLectures.length === 0 ? (
              <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-400">
                講義がありません。「編集」タブから講義を追加してください。
              </div>
            ) : (
              courseLectures.map((lecture) => {
                const isSelected = selectedCheckLectureId === lecture.id;
                const prog = getLectureProgress(lecture.id);
                return (
                  <div
                    key={lecture.id}
                    onClick={() => setSelectedCheckLectureId(lecture.id)}
                    className={`p-3.5 border rounded-xl transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-amber-950/20 border-amber-500/80 shadow-sm"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">
                          {lecture.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                            選択中
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                        <span className="text-cyan-400">推奨: {prog.graduationRecommendedCount}</span>
                        <span className="text-amber-400">未卒: {prog.ungraduatedCount}</span>
                        <span className="text-indigo-400">未実施: {prog.unattemptedCount}</span>
                        <span className="text-emerald-400">卒業: {prog.graduatedCount}</span>
                      </div>
                    </div>

                    <span className="text-xs font-mono text-slate-400 font-semibold">
                      計 {prog.totalCards} 枚
                    </span>
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
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          {/* リストの上 タブの下にはじめるボタンを配置 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleStartReview}
              disabled={selectedReviewLectureIds.size === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center space-x-2 transition cursor-pointer"
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
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              {selectedReviewLectureIds.size === courseLectures.length
                ? "すべて選択解除"
                : "すべて選択"}
            </button>
          </div>

          {/* 講義リストをクリックしてマルチセレクト */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {courseLectures.length === 0 ? (
              <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-400">
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
                    className={`p-3.5 border rounded-xl transition cursor-pointer flex items-center justify-between gap-3 ${
                      isChecked
                        ? "bg-indigo-950/20 border-indigo-500/70 shadow-sm"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // 親divクリックで処理
                        className="accent-indigo-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">
                        {lecture.name}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-slate-400">
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
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          {/* 講義リストの一番上に新しい講義を追加するためのボタンを追加 */}
          <div>
            {isAddingLecture ? (
              <form
                onSubmit={handleCreateLecture}
                className="p-3 bg-slate-900 border border-indigo-500/50 rounded-xl space-y-2 animate-fadeIn"
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
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newLectureName.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition cursor-pointer"
                  >
                    追加
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingLecture(true)}
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <PlusIcon size={14} />
                <span>新しい講義を追加</span>
              </button>
            )}
          </div>

          {/* 講義リストをクリックして講義の編集画面を開ける */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {courseLectures.map((lecture) => {
              const cardCount = cards.filter((c) => c.lectureId === lecture.id).length;
              return (
                <div
                  key={lecture.id}
                  onClick={() => setEditingLectureId(lecture.id)}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 hover:border-indigo-500/60 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-2.5">
                    <EditIcon
                      size={15}
                      className="text-slate-500 group-hover:text-indigo-400 transition"
                    />
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                        {lecture.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono ml-2">
                        ({cardCount} 枚)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `講義「${lecture.name}」とカードを削除しますか？`,
                          )
                        ) {
                          deleteLecture(lecture.id);
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                      title="講義を削除"
                    >
                      <TrashIcon size={13} />
                    </button>
                    <span className="text-xs text-indigo-400 group-hover:translate-x-0.5 transition font-medium">
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
          onAnswer={(cardId, result) => {
            if (practiceSession.mode === "TRAINING") {
              answerLectureTrainingCard(cardId, result);
            }
          }}
          recommendedCount={practiceSession.recommendedCount}
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
