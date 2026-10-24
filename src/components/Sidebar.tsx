import React, { useState, useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import type { PriorityMode } from "../types/schema";
import { getSuspensionStatus } from "../types/schema";
import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  BookOpenIcon,
  LayersIcon,
  PauseIcon,
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

  const [expandedCourseIds, setExpandedCourseIds] = useState<
    Record<string, boolean>
  >(() => {
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
  const [addingLectureForCourseId, setAddingLectureForCourseId] = useState<
    string | null
  >(null);
  const [newLectureName, setNewLectureName] = useState("");

  // 科目編集状態
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [editingCoursePriority, setEditingCoursePriority] =
    useState<PriorityMode>("NORMAL");

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

  const handleStartEditCourse = (
    courseId: string,
    currentName: string,
    priority: PriorityMode,
  ) => {
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
      return courseLectures.some((l) =>
        l.name.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [courses, lectures, normalizedQuery]);

  // 折りたたみ時のスリムバー表示
  if (isCollapsed) {
    return (
      <aside className="w-12 flex-shrink-0 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col items-center py-3 justify-between h-full select-none">
        <div className="flex flex-col items-center space-y-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition cursor-pointer"
            title="サイドバーを展開"
          >
            <ChevronRightIcon size={16} />
          </button>
          <div
            className="text-[11px] font-bold text-slate-400 tracking-widest"
            style={{ writingMode: "vertical-rl" }}
          >
            講義専用プール ({courses.length}科目)
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-500">
          {cards.length}枚
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col h-full select-none">
      {/* ヘッダー */}
      <div className="p-3.5 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LayersIcon className="text-indigo-400" size={18} />
            <h1 className="font-bold text-sm tracking-wide text-white">
              講義専用プール管理
            </h1>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsAddingCourse(true)}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1 shadow transition cursor-pointer"
              title="新しい科目を追加"
            >
              <PlusIcon size={13} />
              <span>科目</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
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
            className="w-full px-2.5 py-1.5 pr-7 text-xs bg-slate-950/90 text-slate-100 placeholder-slate-500 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              title="検索をクリア"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>

        {/* ステータスカラーの静かな凡例 */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
          <div className="flex items-center space-x-2.5">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>未暗記</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>待機(8h)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>卒業</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-500">🔁/🎯=本日復習</span>
        </div>
      </div>

      {/* 新規科目インライン追加フォーム */}
      {isAddingCourse && (
        <form
          onSubmit={handleCreateCourse}
          className="p-3 bg-slate-800/80 border-b border-slate-700 space-y-2"
        >
          <div className="text-xs font-semibold text-slate-300">
            新しい科目を作成
          </div>
          <input
            type="text"
            placeholder="例: 電気回路I"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            autoFocus
            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 text-white border border-slate-700 rounded focus:outline-none focus:border-indigo-500"
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
              className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
            >
              作成
            </button>
          </div>
        </form>
      )}

      {/* ツリーリスト */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-1.5"
        data-retention={settings.requestRetention}
        data-session-key={sessionState.lastActiveDateKey}
      >
        {filteredCourses.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-3">
            <p className="text-xs text-slate-400">
              {normalizedQuery
                ? "一致する科目・講義が見つかりません"
                : "科目が登録されていません"}
            </p>
            {!normalizedQuery && (
              <button
                onClick={loadSampleData}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs rounded border border-indigo-500/30 transition shadow"
              >
                サンプルデータを読み込む
              </button>
            )}
          </div>
        ) : (
          filteredCourses.map((course) => {
            const isExpanded =
              normalizedQuery.length > 0 || !!expandedCourseIds[course.id];
            const courseLectures = lectures
              .filter((l) => l.courseId === course.id)
              .filter((l) => {
                if (!normalizedQuery) return true;
                if (course.name.toLowerCase().includes(normalizedQuery))
                  return true;
                return l.name.toLowerCase().includes(normalizedQuery);
              });
            const courseCards = cards.filter((c) => c.courseId === course.id);
            const suspensionStatus = getSuspensionStatus(courseCards);
            const progress = getCourseProgress(course.id);
            const isSelected = selectedCourseId === course.id;

            return (
              <div
                key={course.id}
                className="rounded-xl bg-slate-800/35 border border-slate-800/90 overflow-hidden"
              >
                {/* 科目行 */}
                {editingCourseId === course.id ? (
                  <div className="p-2 bg-slate-800 space-y-2">
                    <input
                      type="text"
                      value={editingCourseName}
                      onChange={(e) => setEditingCourseName(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-slate-950 text-white border border-slate-700 rounded"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <select
                        value={editingCoursePriority}
                        onChange={(e) =>
                          setEditingCoursePriority(
                            e.target.value as PriorityMode,
                          )
                        }
                        className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-1.5 py-1 text-xs"
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
                          className="px-2 py-0.5 bg-indigo-600 text-white rounded"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => selectCourse(course.id)}
                    className={`group px-2.5 pt-2 pb-1.5 cursor-pointer transition ${
                      isSelected
                        ? "bg-slate-800/90 text-white"
                        : "hover:bg-slate-800/60 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(course.id);
                          }}
                          className="text-slate-400 hover:text-white p-0.5 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDownIcon size={14} />
                          ) : (
                            <ChevronRightIcon size={14} />
                          )}
                        </button>
                        <BookOpenIcon
                          size={14}
                          className="text-indigo-400 flex-shrink-0"
                        />
                        <span className="text-xs font-bold truncate flex-1">
                          {course.name}
                        </span>
                      </div>

                      {/* アクション & バッジ */}
                      <div className="flex items-center space-x-1">
                        {course.priorityMode !== "NORMAL" && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                              course.priorityMode === "FORCE"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            }`}
                          >
                            {course.priorityMode === "FORCE" ? "強制" : "優先"}
                          </span>
                        )}

                        {suspensionStatus === "ALL_SUSPENDED" && (
                          <span className="text-[10px] px-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded">
                            休止中
                          </span>
                        )}

                        {progress.retryCount > 0 && (
                          <span
                            className="text-[10px] px-1 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-700/60 font-mono"
                            title={`本日のリベンジ枠: ${progress.retryCount}枚`}
                          >
                            🔁{progress.retryCount}
                          </span>
                        )}
                        {progress.dueCount > 0 && (
                          <span
                            className="text-[10px] px-1 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-mono"
                            title={`本日の期日到来枠: ${progress.dueCount}枚`}
                          >
                            🎯{progress.dueCount}
                          </span>
                        )}

                        <span
                          className="text-[10px] text-slate-400 font-mono pl-0.5"
                          title={`卒業率: ${progress.activeCount} / ${progress.totalCards}枚`}
                        >
                          {progress.graduatedPercentage}%
                        </span>

                        {/* ホバー時メニュー */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 ml-0.5 transition">
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
                            className="p-1 hover:text-amber-400 text-slate-400 rounded"
                          >
                            <PauseIcon size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditCourse(
                                course.id,
                                course.name,
                                course.priorityMode,
                              );
                            }}
                            title="科目名を編集"
                            className="p-1 hover:text-indigo-300 text-slate-400 rounded"
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
                            className="p-1 hover:text-rose-400 text-slate-400 rounded"
                          >
                            <TrashIcon size={11} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 科目の卒業プログレスミニバー */}
                    <div className="mt-1.5 w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500/80 h-full transition-all duration-300"
                        style={{ width: `${progress.graduatedPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 講義回リスト（アコーディオン内） */}
                {isExpanded && (
                  <div className="border-t border-slate-800/60 bg-slate-950/50 px-1.5 py-1.5 space-y-1">
                    {courseLectures.map((lecture) => {
                      const isLectureSelected =
                        selectedLectureId === lecture.id;
                      const lecProgress = getLectureProgress(lecture.id);
                      const lecCards = cards.filter(
                        (c) => c.lectureId === lecture.id,
                      );
                      const isLecSuspended =
                        getSuspensionStatus(lecCards) === "ALL_SUSPENDED";

                      return (
                        <div
                          key={lecture.id}
                          onClick={() => selectLecture(lecture.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                            isLectureSelected
                              ? "bg-indigo-600/90 text-white font-medium shadow-xs"
                              : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isLectureSelected
                                  ? "bg-white"
                                  : lecProgress.unmemorizedCount > 0
                                    ? "bg-amber-400"
                                    : lecProgress.activeCount > 0
                                      ? "bg-emerald-400"
                                      : "bg-slate-600"
                              }`}
                            />
                            <span className="truncate">{lecture.name}</span>
                          </div>

                          <div className="flex items-center space-x-1 flex-shrink-0 ml-1.5">
                            {/* 本日の共通プール対象ドット */}
                            {lecProgress.retryCount > 0 && (
                              <span
                                className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-200 border border-amber-400/40 font-mono"
                                title={`リベンジ対象: ${lecProgress.retryCount}枚`}
                              >
                                🔁{lecProgress.retryCount}
                              </span>
                            )}
                            {lecProgress.dueCount > 0 && (
                              <span
                                className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 font-mono"
                                title={`本日復習対象: ${lecProgress.dueCount}枚`}
                              >
                                🎯{lecProgress.dueCount}
                              </span>
                            )}

                            {/* 未暗記 / 待機中 / 卒業 の色分けピル */}
                            <div
                              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                isLectureSelected
                                  ? "bg-indigo-950/60"
                                  : "bg-slate-900/90 border border-slate-800"
                              }`}
                              title={`未暗記: ${lecProgress.unmemorizedCount}枚 / 待機中(8h): ${lecProgress.waitingCount}枚 / 卒業済: ${lecProgress.activeCount}枚`}
                            >
                              <span
                                className={
                                  lecProgress.unmemorizedCount > 0
                                    ? "text-slate-200 font-bold"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.unmemorizedCount}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={
                                  lecProgress.waitingCount > 0
                                    ? "text-amber-300 font-bold"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.waitingCount}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={
                                  lecProgress.activeCount > 0
                                    ? "text-emerald-300 font-bold"
                                    : "text-slate-500"
                                }
                              >
                                {lecProgress.activeCount}
                              </span>
                            </div>

                            {isLecSuspended && (
                              <span className="text-[9px] px-1 py-0.2 bg-rose-500/20 text-rose-300 rounded">
                                休
                              </span>
                            )}

                            {/* 講義削除などのクイック操作 */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLectureSuspension(lecture.id);
                                }}
                                title={
                                  isLecSuspended
                                    ? "講義を再開"
                                    : "講義を一括休止"
                                }
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
                        className="p-1.5 space-y-1.5 bg-slate-800/80 rounded-lg"
                      >
                        <input
                          type="text"
                          placeholder="例: 第1回 オームの法則"
                          value={newLectureName}
                          onChange={(e) => setNewLectureName(e.target.value)}
                          autoFocus
                          className="w-full px-2 py-1 text-xs bg-slate-950 text-white border border-slate-700 rounded focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingLectureForCourseId(null);
                              setNewLectureName("");
                            }}
                            className="text-[11px] px-1.5 py-0.5 text-slate-400 hover:text-white"
                          >
                            キャンセル
                          </button>
                          <button
                            type="submit"
                            className="text-[11px] px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
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
                        className="w-full py-1 px-2 text-[11px] text-slate-400 hover:text-indigo-300 hover:bg-slate-800/40 rounded-lg flex items-center justify-center space-x-1 transition cursor-pointer"
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
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span>カード総数: {cards.length}枚</span>
        <button
          onClick={() => {
            if (
              window.confirm(
                "サンプルデータを再読み込みしますか？現在のデータは上書きされます。",
              )
            ) {
              loadSampleData();
            }
          }}
          className="text-slate-400 hover:text-slate-200 underline text-[11px] cursor-pointer"
        >
          サンプル復元
        </button>
      </div>
    </aside>
  );
}
