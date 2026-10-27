import { useState } from "react";

import templateMainData from "../../../templates/template-main-data.json";
import { useAppStore } from "../../store/useAppStore";
import type { AppBackupData } from "../../types/schema";
import { CourseSchema, isWaitingCardLocked } from "../../types/schema";
import { BookOpenIcon, PlusIcon, TrashIcon } from "../icons";

interface CourseListViewProps {
  onSelectCourse: (courseId: string) => void;
}

export function CourseListView({ onSelectCourse }: CourseListViewProps) {
  const { courses, lectures, cards, settings, addCourse, deleteCourse, importBackupJson } =
    useAppStore();

  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const result = CourseSchema.shape.name.safeParse(newCourseName);
    if (!result.success) return;
    const created = addCourse(result.data);
    setNewCourseName("");
    setIsAddingCourse(false);
    onSelectCourse(created.id);
  };

  const handleImportTemplate = () => {
    importBackupJson(templateMainData as unknown as AppBackupData);
    const latestCourses = useAppStore.getState().courses;
    if (latestCourses.length > 0) {
      onSelectCourse(latestCourses[0].id);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col overflow-hidden bg-slate-950 p-4 select-none sm:p-6">
      {/* 上部ヘッダー & 科目追加ボタン */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <h1 className="flex items-center space-x-2 text-base font-bold text-white">
          <BookOpenIcon size={18} className="text-indigo-400" />
          <span>教材一覧</span>
        </h1>

        <button
          type="button"
          onClick={() => setIsAddingCourse(true)}
          className="flex cursor-pointer items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500"
        >
          <PlusIcon size={14} />
          <span>科目を追加</span>
        </button>
      </div>

      {/* 新規科目追加インラインフォーム */}
      {isAddingCourse && (
        <form
          onSubmit={handleCreateCourse}
          className="animate-fadeIn mb-5 space-y-3 rounded-2xl border border-indigo-500/50 bg-slate-900 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">新しい科目を追加</span>
            <button
              type="button"
              onClick={() => setIsAddingCourse(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              キャンセル
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="科目名を入力 (例: 電気回路I, 線形代数)"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newCourseName.trim()}
              className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              作成
            </button>
          </div>
        </form>
      )}

      {/* 科目カードグリッド / リスト */}
      <div className="flex-1 overflow-y-auto pr-1">
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <span className="text-3xl">📚</span>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-300">登録されている科目がありません</p>
              <p className="text-[11px] text-slate-500">
                右上の「科目を追加」ボタンから最初の科目を登録するか、テンプレートを取り込むことができます。
              </p>
            </div>
            <button
              type="button"
              onClick={handleImportTemplate}
              className="inline-flex cursor-pointer items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-[0.98]"
            >
              <span>📥</span>
              <span>テンプレートを取り込む</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {courses.map((course) => {
              const courseLectures = lectures.filter((l) => l.courseId === course.id);
              const courseCards = cards.filter((c) => c.courseId === course.id);
              const totalCards = courseCards.length;

              let graduatedCount = 0;
              let checkAvailableCount = 0;
              let otherCount = 0;

              const now = new Date();
              for (const card of courseCards) {
                if (card.lecturePool.phase === "GRADUATED") {
                  graduatedCount++;
                } else if (!card.isSuspended) {
                  if (
                    card.lecturePool.consecutiveCorrect >= 1 &&
                    isWaitingCardLocked(card, settings.waitingDurationHours, now)
                  ) {
                    otherCount++;
                  } else {
                    checkAvailableCount++;
                  }
                } else {
                  otherCount++;
                }
              }

              return (
                <div
                  key={course.id}
                  onClick={() => onSelectCourse(course.id)}
                  className="group flex cursor-pointer flex-col justify-between space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition hover:border-indigo-500/60 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-white transition group-hover:text-indigo-300">
                        {course.name}
                      </h2>
                      <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                        講義: {courseLectures.length} 回 / カード: {totalCards} 枚
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `科目「${course.name}」と配下の講義・カードをすべて削除しますか？`,
                          )
                        ) {
                          deleteCourse(course.id);
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                      title="科目を削除"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>

                  {/* 3フェーズ進捗バー（卒業済み / 現在チェック可能 / それ以外） */}
                  {totalCards > 0 ? (
                    <div
                      className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                      title={`卒業済み: ${graduatedCount} / 現在チェック可能: ${checkAvailableCount} / それ以外: ${otherCount}`}
                    >
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${(graduatedCount / totalCards) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-amber-400"
                        style={{
                          width: `${(checkAvailableCount / totalCards) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-slate-600"
                        style={{
                          width: `${(otherCount / totalCards) * 100}%`,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">カード未登録</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
