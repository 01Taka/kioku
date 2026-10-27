import React, { useMemo, useState } from "react";

import { useAppStore } from "../store/useAppStore";
import type { PriorityMode } from "../types/schema";
import { getSuspensionStatus } from "../types/schema";
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  LayersIcon,
  PauseIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "./icons";

export function Sidebar() {
  const {
    courses,
    lectures,
    cards,
    settings,
    sessionState,
    selectedCourseId,
    selectedLectureId,
    selectCourse,
    selectLecture,
    addCourse,
    updateCourse,
    deleteCourse,
    toggleCourseSuspension,
    addLecture,
    deleteLecture,
    toggleLectureSuspension,
    getCourseProgress,
    getLectureProgress,
    loadSampleData,
  } = useAppStore();

  // サイドバー自体の折りたたみ状態
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 科目・講義クイック検索キーワード
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    courses.forEach((c) => {
      init[c.id] = true;
    });
    return init;
  });

  // 科目作成インライン状態
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");

  // 講義作成状態
  const [addingLectureForCourseId, setAddingLectureForCourseId] = useState<string | null>(null);
  const [newLectureName, setNewLectureName] = useState("");

  // 科目編集状態
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [editingCoursePriority, setEditingCoursePriority] = useState<PriorityMode>("NORMAL");

  const toggleExpand = (courseId: string) => {
    setExpandedCourseIds((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    const course = addCourse(newCourseName);
    setNewCourseName("");
    setIsAddingCourse(false);
    setExpandedCourseIds((prev) => ({ ...prev, [course.id]: true }));
  };

  const handleStartEditCourse = (courseId: string, currentName: string, priority: PriorityMode) => {
    setEditingCourseId(courseId);
    setEditingCourseName(currentName);
    setEditingCoursePriority(priority);
  };

  const handleSaveEditCourse = (courseId: string) => {
    if (!editingCourseName.trim()) return;
    updateCourse(courseId, {
      name: editingCourseName.trim(),
      priorityMode: editingCoursePriority,
    });
    setEditingCourseId(null);
  };

  const handleCreateLecture = (courseId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newLectureName.trim()) return;
    addLecture(courseId, newLectureName);
    setNewLectureName("");
    setAddingLectureForCourseId(null);
  };

  // 検索クエリによる科目・講義のフィルタリング
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCourses = useMemo(() => {
    if (!normalizedQuery) return courses;
    return courses.filter((course) => {
      if (course.name.toLowerCase().includes(normalizedQuery)) return true;
      const courseLectures = lectures.filter((l) => l.courseId === course.id);
      return courseLectures.some((l) => l.name.toLowerCase().includes(normalizedQuery));
    });
  }, [courses, lectures, normalizedQuery]);

  // 折りたたみ時のスリムバー表示
  if (isCollapsed) {
    return (
      <aside className="flex h-full w-12 flex-shrink-0 flex-col items-center justify-between border-r border-slate-800 bg-slate-900 py-3 text-slate-100 select-none">
        <div className="flex flex-col items-center space-y-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="cursor-pointer rounded-xl bg-slate-800 p-2 text-slate-300 transition hover:bg-indigo-600 hover:text-white"
            title="サイドバーを展開"
          >
            <ChevronRightIcon size={16} />
          </button>
          <div
            className="text-[11px] font-bold tracking-widest text-slate-400"
            style={{ writingMode: "vertical-rl" }}
          >
            講義専用プール ({courses.length}科目)
          </div>
        </div>

        <div className="font-mono text-[10px] text-slate-500">{cards.length}枚</div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 select-none">
      {/* ヘッダー */}
      <div className="space-y-2.5 border-b border-slate-800 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LayersIcon className="text-indigo-400" size={18} />
            <h1 className="text-sm font-bold tracking-wide text-white">講義専用プール管理</h1>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsAddingCourse(true)}
              className="flex cursor-pointer items-center space-x-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white shadow transition hover:bg-indigo-500"
              title="新しい科目を追加"
            >
              <PlusIcon size={13} />
              <span>科目</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="サイドバーを折りたたむ"
            >
              <span className="text-xs leading-none">«</span>
            </button>
          </div>
        </div>

        {/* クイック検索フィルタ & 凡例 */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 科目・講義名を検索..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/90 px-2.5 py-1.5 pr-7 text-base text-slate-100 placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-white"
              title="検索をクリア"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>

        {/* ステータスカラーの静かな凡例 */}
        <div className="flex items-center justify-between px-0.5 text-[10px] text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              <span>未実施</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>未卒業</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>卒業推奨</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>卒業済</span>
            </span>
          </div>
        </div>
      </div>

      {/* 新規科目インライン追加フォーム */}
      {isAddingCourse && (
        <form
          onSubmit={handleCreateCourse}
          className="space-y-2 border-b border-slate-700 bg-slate-800/80 p-3"
        >
          <div className="text-xs font-semibold text-slate-300">新しい科目を作成</div>
          <input
            type="text"
            placeholder="例: 電気回路I"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            autoFocus
            className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-base text-white focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsAddingCourse(false);
                setNewCourseName("");
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
            >
              作成
            </button>
          </div>
        </form>
      )}

      {/* ツリーリスト */}
      <div
        className="flex-1 space-y-1.5 overflow-y-auto p-2"
        data-retention={settings.requestRetention}
        data-session-key={sessionState.lastActiveDateKey}
      >
        {filteredCourses.length === 0 ? (
          <div className="space-y-3 px-4 py-10 text-center">
            <p className="text-xs text-slate-400">
              {normalizedQuery ? "一致する科目・講義が見つかりません" : "科目が登録されていません"}
            </p>
            {!normalizedQuery && (
              <button
                onClick={loadSampleData}
                className="rounded border border-indigo-500/30 bg-slate-800 px-3 py-1.5 text-xs text-indigo-300 shadow transition hover:bg-slate-700"
              >
                サンプルデータを読み込む
              </button>
            )}
          </div>
        ) : (
          filteredCourses.map((course) => {
            const isExpanded = normalizedQuery.length > 0 || !!expandedCourseIds[course.id];
            const courseLectures = lectures
              .filter((l) => l.courseId === course.id)
              .filter((l) => {
                if (!normalizedQuery) return true;
                if (course.name.toLowerCase().includes(normalizedQuery)) return true;
                return l.name.toLowerCase().includes(normalizedQuery);
              });
            const courseCards = cards.filter((c) => c.courseId === course.id);
            const suspensionStatus = getSuspensionStatus(courseCards);
            const progress = getCourseProgress(course.id);
            const isSelected = selectedCourseId === course.id;

            return (
              <div
                key={course.id}
                className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-800/35"
              >
                {/* 科目行 */}
                {editingCourseId === course.id ? (
                  <div className="space-y-2 bg-slate-800 p-2">
                    <input
                      type="text"
                      value={editingCourseName}
                      onChange={(e) => setEditingCourseName(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-base text-white"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <select
                        value={editingCoursePriority}
                        onChange={(e) => setEditingCoursePriority(e.target.value as PriorityMode)}
                        className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-base text-slate-200"
                      >
                        <option value="NORMAL">通常</option>
                        <option value="PRIORITY">優先</option>
                        <option value="FORCE">強制出題</option>
                      </select>
                      <div className="space-x-1">
                        <button
                          onClick={() => setEditingCourseId(null)}
                          className="px-2 py-0.5 text-slate-400 hover:text-white"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleSaveEditCourse(course.id)}
                          className="rounded bg-indigo-600 px-2 py-0.5 text-white"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => selectCourse(course.id)}
                    className={`group cursor-pointer px-2.5 pt-2 pb-1.5 transition ${
                      isSelected
                        ? "bg-slate-800/90 text-white"
                        : "text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 flex-1 items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(course.id);
                          }}
                          className="rounded p-0.5 text-slate-400 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDownIcon size={14} />
                          ) : (
                            <ChevronRightIcon size={14} />
                          )}
                        </button>
                        <BookOpenIcon size={14} className="flex-shrink-0 text-indigo-400" />
                        <span className="flex-1 truncate text-xs font-bold">{course.name}</span>
                      </div>

                      {/* アクション & バッジ */}
                      <div className="flex items-center space-x-1">
                        {course.priorityMode !== "NORMAL" && (
                          <span
                            className={`py-0.2 rounded border px-1.5 text-[10px] font-semibold ${
                              course.priorityMode === "FORCE"
                                ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
                                : "border-amber-500/40 bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {course.priorityMode === "FORCE" ? "強制" : "優先"}
                          </span>
                        )}

                        {suspensionStatus === "ALL_SUSPENDED" && (
                          <span className="rounded border border-rose-500/40 bg-rose-500/20 px-1 text-[10px] text-rose-300">
                            休止中
                          </span>
                        )}

                        {progress.retryCount > 0 && (
                          <span
                            className="py-0.2 rounded border border-amber-700/60 bg-amber-950/90 px-1 font-mono text-[10px] text-amber-300"
                            title={`本日のリベンジ枠: ${progress.retryCount}枚`}
                          >
                            🔁{progress.retryCount}
                          </span>
                        )}
                        {progress.dueCount > 0 && (
                          <span
                            className="py-0.2 rounded border border-emerald-700/60 bg-emerald-950/90 px-1 font-mono text-[10px] text-emerald-300"
                            title={`本日の期日到来枠: ${progress.dueCount}枚`}
                          >
                            🎯{progress.dueCount}
                          </span>
                        )}

                        <span
                          className="pl-0.5 font-mono text-[10px] text-slate-400"
                          title={`卒業率: ${progress.graduatedCount} / ${progress.totalCards}枚`}
                        >
                          {progress.graduatedPercentage}%
                        </span>

                        {/* ホバー時メニュー */}
                        <div className="ml-0.5 flex items-center space-x-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCourseSuspension(course.id);
                            }}
                            title={
                              suspensionStatus === "ALL_SUSPENDED"
                                ? "科目配下を再開"
                                : "科目配下を一括休止"
                            }
                            className="rounded p-1 text-slate-400 hover:text-amber-400"
                          >
                            <PauseIcon size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditCourse(course.id, course.name, course.priorityMode);
                            }}
                            title="科目名を編集"
                            className="rounded p-1 text-slate-400 hover:text-indigo-300"
                          >
                            <EditIcon size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `科目「${course.name}」と配下の全講義・カードを削除しますか？`,
                                )
                              ) {
                                deleteCourse(course.id);
                              }
                            }}
                            title="科目を削除"
                            className="rounded p-1 text-slate-400 hover:text-rose-400"
                          >
                            <TrashIcon size={11} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 科目の卒業プログレスミニバー */}
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-950">
                      <div
                        className="h-full bg-emerald-500/80 transition-all duration-300"
                        style={{ width: `${progress.graduatedPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 講義回リスト（アコーディオン内） */}
                {isExpanded && (
                  <div className="space-y-1 border-t border-slate-800/60 bg-slate-950/50 px-1.5 py-1.5">
                    {courseLectures.map((lecture) => {
                      const isLectureSelected = selectedLectureId === lecture.id;
                      const lecProgress = getLectureProgress(lecture.id);
                      const lecCards = cards.filter((c) => c.lectureId === lecture.id);
                      const isLecSuspended = getSuspensionStatus(lecCards) === "ALL_SUSPENDED";

                      return (
                        <div
                          key={lecture.id}
                          onClick={() => selectLecture(lecture.id)}
                          className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                            isLectureSelected
                              ? "bg-indigo-600/90 font-medium text-white shadow-xs"
                              : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-center space-x-2 truncate">
                            <span
                              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                                isLectureSelected
                                  ? "bg-white"
                                  : lecProgress.graduationRecommendedCount > 0
                                    ? "bg-cyan-400"
                                    : lecProgress.ungraduatedCount > 0
                                      ? "bg-amber-400"
                                      : lecProgress.unattemptedCount > 0
                                        ? "bg-indigo-400"
                                        : lecProgress.graduatedCount > 0
                                          ? "bg-emerald-400"
                                          : "bg-slate-600"
                              }`}
                            />
                            <span className="truncate">{lecture.name}</span>
                          </div>

                          <div className="ml-1.5 flex flex-shrink-0 items-center space-x-1">
                            {/* 本日の共通プール対象ドット */}
                            {lecProgress.retryCount > 0 && (
                              <span
                                className="rounded border border-amber-400/40 bg-amber-500/20 px-1 font-mono text-[9px] text-amber-200"
                                title={`リベンジ対象: ${lecProgress.retryCount}枚`}
                              >
                                🔁{lecProgress.retryCount}
                              </span>
                            )}
                            {lecProgress.dueCount > 0 && (
                              <span
                                className="rounded border border-emerald-400/40 bg-emerald-500/20 px-1 font-mono text-[9px] text-emerald-200"
                                title={`本日復習対象: ${lecProgress.dueCount}枚`}
                              >
                                🎯{lecProgress.dueCount}
                              </span>
                            )}

                            {/* 未実施 / 未卒業 / 卒業推奨 / 卒業済 の色分けピル */}
                            <div
                              className={`flex items-center space-x-1 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                isLectureSelected
                                  ? "bg-indigo-950/60"
                                  : "border border-slate-800 bg-slate-900/90"
                              }`}
                              title={`未実施: ${lecProgress.unattemptedCount}枚 / 未卒業: ${lecProgress.ungraduatedCount}枚 / 卒業推奨: ${lecProgress.graduationRecommendedCount}枚 / 卒業済: ${lecProgress.graduatedCount}枚`}
                            >
                              <span
                                className={
                                  lecProgress.unattemptedCount > 0
                                    ? "font-bold text-indigo-300"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.unattemptedCount}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={
                                  lecProgress.ungraduatedCount > 0
                                    ? "font-bold text-amber-300"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.ungraduatedCount}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={
                                  lecProgress.graduationRecommendedCount > 0
                                    ? "font-bold text-cyan-300"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.graduationRecommendedCount}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={
                                  lecProgress.graduatedCount > 0
                                    ? "font-bold text-emerald-300"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.graduatedCount}
                              </span>
                            </div>

                            {isLecSuspended && (
                              <span className="py-0.2 rounded bg-rose-500/20 px-1 text-[9px] text-rose-300">
                                休
                              </span>
                            )}

                            {/* 講義削除などのクイック操作 */}
                            <div className="flex items-center space-x-0.5 opacity-0 transition group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLectureSuspension(lecture.id);
                                }}
                                title={isLecSuspended ? "講義を再開" : "講義を一括休止"}
                                className="p-0.5 hover:text-amber-300"
                              >
                                <PauseIcon size={11} />
                              </button>
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
                                title="講義を削除"
                                className="p-0.5 hover:text-rose-300"
                              >
                                <TrashIcon size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* 講義回追加インラインフォーム */}
                    {addingLectureForCourseId === course.id ? (
                      <form
                        onSubmit={(e) => handleCreateLecture(course.id, e)}
                        className="space-y-1.5 rounded-lg bg-slate-800/80 p-1.5"
                      >
                        <input
                          type="text"
                          placeholder="例: 第1回 オームの法則"
                          value={newLectureName}
                          onChange={(e) => setNewLectureName(e.target.value)}
                          autoFocus
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-base text-white focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingLectureForCourseId(null);
                              setNewLectureName("");
                            }}
                            className="px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-white"
                          >
                            キャンセル
                          </button>
                          <button
                            type="submit"
                            className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                          >
                            追加
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingLectureForCourseId(course.id);
                          setNewLectureName("");
                        }}
                        className="flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800/40 hover:text-indigo-300"
                      >
                        <PlusIcon size={12} />
                        <span>講義回を追加</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* フッター */}
      <div className="flex items-center justify-between border-t border-slate-800 p-3 text-xs text-slate-400">
        <span>カード総数: {cards.length}枚</span>
        <button
          onClick={() => {
            if (
              window.confirm("サンプルデータを再読み込みしますか？現在のデータは上書きされます。")
            ) {
              loadSampleData();
            }
          }}
          className="cursor-pointer text-[11px] text-slate-400 underline hover:text-slate-200"
        >
          サンプル復元
        </button>
      </div>
    </aside>
  );
}
