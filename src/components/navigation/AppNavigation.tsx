import React from "react";

import { useAppStore } from "../../store/useAppStore";
import type { Card, Course } from "../../types/schema";
import { BookOpenIcon, ChevronDownIcon, HomeIcon, SettingsIcon } from "../icons";

export type NavCategory = "HOME" | "MATERIALS";
export type HomeSubTab = "MAIN" | "MISTAKES" | "FORGOTTEN";

interface AppNavigationProps {
  currentCategory: NavCategory;
  onSelectCategory: (category: NavCategory) => void;
  homeSubTab: HomeSubTab;
  onSelectHomeSubTab: (subTab: HomeSubTab) => void;
  onOpenSettings: () => void;
  selectedCourseId: string | null;
  onSelectCourse?: (courseId: string) => void;
  onBackToCourseList?: () => void;
}

/**
 * PC版: 左サイドバーナビゲーション
 */
export function DesktopSidebar({
  currentCategory,
  onSelectCategory,
  homeSubTab,
  onSelectHomeSubTab,
  onOpenSettings,
  selectedCourseId,
  onSelectCourse,
}: AppNavigationProps) {
  const { courses, cards, sessionState, getCommonPoolQueue, selectCourse } = useAppStore();
  const [isMaterialsOpen, setIsMaterialsOpen] = React.useState(true);

  // バッジ集計
  const mistakeCount = React.useMemo(() => {
    const mistakeSet = new Set(sessionState.todayMistakeCardIds);
    return cards.filter((c: Card) => mistakeSet.has(c.id) && c.lecturePool.phase === "GRADUATED")
      .length;
  }, [cards, sessionState.todayMistakeCardIds]);

  const forgottenCount = React.useMemo(() => {
    return getCommonPoolQueue().recoveryCards.length;
  }, [getCommonPoolQueue]);

  return (
    <aside className="z-20 flex h-full w-60 flex-shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900 select-none">
      <div className="space-y-4 overflow-y-auto p-3.5">
        {/* アプリロゴ / タイトル */}
        <div className="flex items-center space-x-2.5 px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-md shadow-indigo-600/30">
            K
          </div>
          <span className="text-sm font-bold tracking-wide text-white">Kioku</span>
        </div>

        {/* ナビゲーションリスト */}
        <nav className="space-y-1">
          {/* 大カテゴリー: ホーム */}
          <div>
            <button
              type="button"
              onClick={() => {
                onSelectCategory("HOME");
              }}
              className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                currentCategory === "HOME"
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center space-x-2">
                <HomeIcon size={16} />
                <span>ホーム</span>
              </div>
            </button>

            {/* ホーム配下の中カテゴリー (インデントしてぶら下がり表示) */}
            <div className="mt-1 ml-4 space-y-0.5 border-l border-slate-800 pl-2">
              <button
                type="button"
                onClick={() => {
                  onSelectCategory("HOME");
                  onSelectHomeSubTab("MAIN");
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                  currentCategory === "HOME" && homeSubTab === "MAIN"
                    ? "bg-slate-800 font-medium text-white"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <span>メイン</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectCategory("HOME");
                  onSelectHomeSubTab("MISTAKES");
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                  currentCategory === "HOME" && homeSubTab === "MISTAKES"
                    ? "bg-slate-800 font-medium text-amber-300"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <span>今日のミス</span>
                {mistakeCount > 0 && (
                  <span className="py-0.2 rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 font-mono text-[10px] font-bold text-amber-300">
                    {mistakeCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectCategory("HOME");
                  onSelectHomeSubTab("FORGOTTEN");
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                  currentCategory === "HOME" && homeSubTab === "FORGOTTEN"
                    ? "bg-slate-800 font-medium text-rose-300"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <span>忘れかけ</span>
                {forgottenCount > 0 && (
                  <span className="py-0.2 rounded-full border border-rose-500/40 bg-rose-500/20 px-1.5 font-mono text-[10px] font-bold text-rose-300">
                    {forgottenCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 大カテゴリー: 教材（アコーディオン） */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (currentCategory !== "MATERIALS") {
                  onSelectCategory("MATERIALS");
                  setIsMaterialsOpen(true);
                } else {
                  setIsMaterialsOpen(!isMaterialsOpen);
                }
              }}
              className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                currentCategory === "MATERIALS"
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpenIcon size={16} />
                <span>教材</span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-500">
                <span className="font-mono text-[11px]">{courses.length}科目</span>
                <ChevronDownIcon
                  size={14}
                  className={`transition-transform duration-200 ${
                    isMaterialsOpen ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              </div>
            </button>

            {/* 展開時: すべての教材（科目）を一覧表示 */}
            {isMaterialsOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l border-slate-800 pl-2">
                {courses.length === 0 ? (
                  <div className="px-2 py-1.5 text-[11px] text-slate-500">科目がありません</div>
                ) : (
                  courses.map((course: Course) => {
                    const isSelected =
                      currentCategory === "MATERIALS" && selectedCourseId === course.id;
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => {
                          onSelectCategory("MATERIALS");
                          if (onSelectCourse) {
                            onSelectCourse(course.id);
                          } else {
                            selectCourse(course.id);
                          }
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition ${
                          isSelected
                            ? "bg-slate-800 font-medium text-white"
                            : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                        }`}
                        title={course.name}
                      >
                        <span className="truncate">{course.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* サイドバー最下部: 設定ボタン */}
      <div className="border-t border-slate-800/80 p-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800/80 hover:text-white"
        >
          <SettingsIcon size={15} />
          <span>設定</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * スマホ版: ボトムナビゲーションバー
 */
export function MobileBottomNav({
  currentCategory,
  onSelectCategory,
}: {
  currentCategory: NavCategory;
  onSelectCategory: (category: NavCategory) => void;
}) {
  return (
    <nav className="fixed right-0 bottom-0 left-0 z-40 flex h-14 items-center justify-around border-t border-slate-800 bg-slate-900/95 backdrop-blur select-none md:hidden">
      <button
        type="button"
        onClick={() => onSelectCategory("HOME")}
        className={`flex h-full flex-1 flex-col items-center justify-center transition ${
          currentCategory === "HOME" ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <HomeIcon size={18} />
        <span className="mt-0.5 text-[10px] font-medium">ホーム</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectCategory("MATERIALS")}
        className={`flex h-full flex-1 flex-col items-center justify-center transition ${
          currentCategory === "MATERIALS"
            ? "text-indigo-400"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <BookOpenIcon size={18} />
        <span className="mt-0.5 text-[10px] font-medium">教材</span>
      </button>
    </nav>
  );
}
