import React, { useState } from "react";
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
} from "./icons";

export function Sidebar() {
  const {
    courses,
    lectures,
    cards,
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

  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>(() => {
    // デフォルトで全科目展開
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

  return (
    <aside className="w-80 flex-shrink-0 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col h-screen select-none">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <LayersIcon className="text-indigo-400" size={20} />
          <h1 className="font-bold text-base tracking-wide text-white">講義専用プール管理</h1>
        </div>
        <button
          onClick={() => setIsAddingCourse(true)}
          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center space-x-1 shadow transition"
          title="科目を追加"
        >
          <PlusIcon size={14} />
          <span>科目</span>
        </button>
      </div>

      {/* 新規科目インライン追加フォーム */}
      {isAddingCourse && (
        <form onSubmit={handleCreateCourse} className="p-3 bg-slate-800/80 border-b border-slate-700 space-y-2">
          <div className="text-xs font-semibold text-slate-300">新しい科目を作成</div>
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
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {courses.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-3">
            <p className="text-xs text-slate-400">科目が登録されていません</p>
            <button
              onClick={loadSampleData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs rounded border border-indigo-500/30 transition shadow"
            >
              サンプルデータを読み込む
            </button>
          </div>
        ) : (
          courses.map((course) => {
            const isExpanded = !!expandedCourseIds[course.id];
            const courseLectures = lectures.filter((l) => l.courseId === course.id);
            const courseCards = cards.filter((c) => c.courseId === course.id);
            const suspensionStatus = getSuspensionStatus(courseCards);
            const progress = getCourseProgress(course.id);
            const isSelected = selectedCourseId === course.id;

            return (
              <div key={course.id} className="rounded-lg bg-slate-800/40 border border-slate-800/80 overflow-hidden">
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
                        onChange={(e) => setEditingCoursePriority(e.target.value as PriorityMode)}
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
                    onClick={() => {
                      selectCourse(course.id);
                    }}
                    className={`group px-2.5 py-2 flex items-center justify-between cursor-pointer transition ${
                      isSelected ? "bg-slate-800 text-white" : "hover:bg-slate-800/60 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(course.id);
                        }}
                        className="text-slate-400 hover:text-white p-0.5 rounded"
                      >
                        {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                      </button>
                      <BookOpenIcon size={15} className="text-indigo-400 flex-shrink-0" />
                      <span className="text-xs font-semibold truncate flex-1">{course.name}</span>
                    </div>

                    {/* アクション & バッジ */}
                    <div className="flex items-center space-x-1">
                      {course.priorityMode !== "NORMAL" && (
                        <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                          {course.priorityMode === "FORCE" ? "強制" : "優先"}
                        </span>
                      )}

                      {/* 休止状態インジケータ */}
                      {suspensionStatus === "ALL_SUSPENDED" && (
                        <span className="text-[10px] px-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded">
                          休止中
                        </span>
                      )}

                      {/* 卒業進捗パーセント */}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {progress.graduatedPercentage}%
                      </span>

                      {/* ホバー時メニュー */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 ml-1 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCourseSuspension(course.id);
                          }}
                          title={suspensionStatus === "ALL_SUSPENDED" ? "科目配下を再開" : "科目配下を一括休止"}
                          className="p-1 hover:text-amber-400 text-slate-400 rounded"
                        >
                          <PauseIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditCourse(course.id, course.name, course.priorityMode);
                          }}
                          title="科目名を編集"
                          className="p-1 hover:text-indigo-300 text-slate-400 rounded"
                        >
                          <EditIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`科目「${course.name}」と配下の全講義・カードを削除しますか？`)) {
                              deleteCourse(course.id);
                            }
                          }}
                          title="科目を削除"
                          className="p-1 hover:text-rose-400 text-slate-400 rounded"
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 講義回リスト（アコーディオン内） */}
                {isExpanded && (
                  <div className="border-t border-slate-800/60 bg-slate-900/60 px-1 py-1 space-y-0.5">
                    {courseLectures.map((lecture) => {
                      const isLectureSelected = selectedLectureId === lecture.id;
                      const lecProgress = getLectureProgress(lecture.id);
                      const lecCards = cards.filter((c) => c.lectureId === lecture.id);
                      const isLecSuspended = getSuspensionStatus(lecCards) === "ALL_SUSPENDED";

                      return (
                        <div
                          key={lecture.id}
                          onClick={() => selectLecture(lecture.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition ${
                            isLectureSelected
                              ? "bg-indigo-600 text-white font-medium shadow-sm"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-indigo-400 flex-shrink-0" />
                            <span className="truncate">{lecture.name}</span>
                          </div>

                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            {/* 未暗記 / 待機中 / 卒業 のコンパクトバッジ */}
                            <span className="text-[10px] font-mono opacity-80">
                              {lecProgress.unmemorizedCount} / {lecProgress.waitingCount} / {lecProgress.activeCount}
                            </span>

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
                                title={isLecSuspended ? "講義を再開" : "講義を一括休止"}
                                className="p-0.5 hover:text-amber-300"
                              >
                                <PauseIcon size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`講義「${lecture.name}」とカードを削除しますか？`)) {
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
                        className="p-1.5 space-y-1.5 bg-slate-800/80 rounded"
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
                        className="w-full py-1 px-2 text-[11px] text-slate-400 hover:text-indigo-300 hover:bg-slate-800/40 rounded flex items-center justify-center space-x-1 transition"
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
            if (window.confirm("サンプルデータを再読み込みしますか？現在のデータは上書きされます。")) {
              loadSampleData();
            }
          }}
          className="text-slate-400 hover:text-slate-200 underline text-[11px]"
        >
          サンプル復元
        </button>
      </div>
    </aside>
  );
}
