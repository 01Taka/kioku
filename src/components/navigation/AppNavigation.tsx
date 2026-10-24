import React from "react";
import {
  HomeIcon,
  BookOpenIcon,
  SettingsIcon,
  ArrowLeftIcon,
} from "../icons";
import { useAppStore } from "../../store/useAppStore";
import type { Course, Card } from "../../types/schema";

export type NavCategory = "HOME" | "MATERIALS";
export type HomeSubTab = "MAIN" | "MISTAKES" | "FORGOTTEN";

interface AppNavigationProps {
  currentCategory: NavCategory;
  onSelectCategory: (category: NavCategory) => void;
  homeSubTab: HomeSubTab;
  onSelectHomeSubTab: (subTab: HomeSubTab) => void;
  onOpenSettings: () => void;
  selectedCourseId: string | null;
  onBackToCourseList: () => void;
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
  onBackToCourseList,
}: AppNavigationProps) {
  const { courses, cards, sessionState, getCommonPoolQueue } = useAppStore();

  const selectedCourse = courses.find((c: Course) => c.id === selectedCourseId);

  // バッジ集計
  const mistakeCount = React.useMemo(() => {
    const mistakeSet = new Set(sessionState.todayMistakeCardIds);
    return cards.filter(
      (c: Card) => mistakeSet.has(c.id) && c.lecturePool.phase === "GRADUATED",
    ).length;
  }, [cards, sessionState.todayMistakeCardIds]);

  const forgottenCount = React.useMemo(() => {
    return getCommonPoolQueue().recoveryCards.length;
  }, [getCommonPoolQueue]);

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-full select-none flex-shrink-0 z-20">
      <div className="p-3.5 space-y-4 overflow-y-auto">
        {/* アプリロゴ / タイトル */}
        <div className="flex items-center space-x-2.5 px-2 py-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-indigo-600/30">
            K
          </div>
          <span className="font-bold text-sm tracking-wide text-white">Kioku</span>
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
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentCategory === "HOME"
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center space-x-2">
                <HomeIcon size={16} />
                <span>ホーム</span>
              </div>
            </button>

            {/* ホーム配下の中カテゴリー (インデントしてぶら下がり表示) */}
            <div className="ml-4 pl-2 border-l border-slate-800 mt-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onSelectCategory("HOME");
                  onSelectHomeSubTab("MAIN");
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  currentCategory === "HOME" && homeSubTab === "MAIN"
                    ? "bg-slate-800 text-white font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
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
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  currentCategory === "HOME" && homeSubTab === "MISTAKES"
                    ? "bg-slate-800 text-amber-300 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <span>今日のミス</span>
                {mistakeCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
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
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  currentCategory === "HOME" && homeSubTab === "FORGOTTEN"
                    ? "bg-slate-800 text-rose-300 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <span>忘れかけ</span>
                {forgottenCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono text-[10px] font-bold">
                    {forgottenCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 大カテゴリー: 教材 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onSelectCategory("MATERIALS");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentCategory === "MATERIALS"
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpenIcon size={16} />
                <span>教材</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {courses.length}科目
              </span>
            </button>

            {/* 教材選択中かつ科目選択時のパンくず・戻るボタン */}
            {currentCategory === "MATERIALS" && selectedCourse && (
              <div className="ml-4 pl-2 border-l border-slate-800 mt-1">
                <button
                  type="button"
                  onClick={onBackToCourseList}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 flex items-center space-x-1 transition cursor-pointer"
                  title="教材一覧（科目リスト）へ戻る"
                >
                  <ArrowLeftIcon size={12} />
                  <span>教材一覧へ</span>
                </button>
                <div className="px-2 py-1 text-xs text-white font-medium truncate">
                  📚 {selectedCourse.name}
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* サイドバー最下部: 設定ボタン */}
      <div className="p-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex items-center justify-around z-40 select-none">
      <button
        type="button"
        onClick={() => onSelectCategory("HOME")}
        className={`flex-1 flex flex-col items-center justify-center h-full transition ${
          currentCategory === "HOME" ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <HomeIcon size={18} />
        <span className="text-[10px] mt-0.5 font-medium">ホーム</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectCategory("MATERIALS")}
        className={`flex-1 flex flex-col items-center justify-center h-full transition ${
          currentCategory === "MATERIALS" ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <BookOpenIcon size={18} />
        <span className="text-[10px] mt-0.5 font-medium">教材</span>
      </button>
    </nav>
  );
}
