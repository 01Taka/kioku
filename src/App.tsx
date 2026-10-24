import { useEffect, useState } from "react";

import { HomeView } from "./components/home/HomeView";
import { SettingsIcon } from "./components/icons";
import { CourseDetailView } from "./components/materials/CourseDetailView";
import { CourseListView } from "./components/materials/CourseListView";
import {
  DesktopSidebar,
  type HomeSubTab,
  MobileBottomNav,
  type NavCategory,
} from "./components/navigation/AppNavigation";
import { CommonPoolSessionModal } from "./components/session/CommonPoolSessionModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const { courses, loadSampleData, syncDailyCutoff } = useAppStore();

  // 大カテゴリー: "HOME" | "MATERIALS"
  const [currentCategory, setCurrentCategory] = useState<NavCategory>("HOME");

  // ホーム内の中カテゴリー: "MAIN" | "MISTAKES" | "FORGOTTEN"
  const [homeSubTab, setHomeSubTab] = useState<HomeSubTab>("MAIN");

  // 教材内の選択科目ID（nullの場合は科目一覧を表示）
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // モーダル状態
  const [isCommonSessionOpen, setIsCommonSessionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 初回起動時、データが空の場合は自動でサンプルデータを投入
  useEffect(() => {
    if (courses.length === 0) {
      loadSampleData();
    }
  }, [courses.length, loadSampleData]);

  // 午前04:00日付変更線のチェック（起動時 ＆ 1分周期）
  useEffect(() => {
    syncDailyCutoff();
    const id = window.setInterval(() => {
      syncDailyCutoff();
    }, 60000);
    return () => window.clearInterval(id);
  }, [syncDailyCutoff]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      {/* PC版: 左固定サイドバー */}
      <div className="hidden h-full md:flex">
        <DesktopSidebar
          currentCategory={currentCategory}
          onSelectCategory={(cat) => {
            setCurrentCategory(cat);
          }}
          homeSubTab={homeSubTab}
          onSelectHomeSubTab={setHomeSubTab}
          onOpenSettings={() => setIsSettingsOpen(true)}
          selectedCourseId={selectedCourseId}
          onBackToCourseList={() => setSelectedCourseId(null)}
        />
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex h-full flex-1 flex-col overflow-hidden pb-14 md:pb-0">
        {/* スマホ版専用トップバー (ヘッダー端に設定アイコン) */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 md:hidden">
          <div className="flex items-center space-x-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow">
              K
            </div>
            <span className="text-sm font-bold text-white">Kioku</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="設定"
          >
            <SettingsIcon size={18} />
          </button>
        </header>

        {/* 画面コンテンツのルーティング */}
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          {currentCategory === "HOME" ? (
            <HomeView
              activeSubTab={homeSubTab}
              onSelectSubTab={setHomeSubTab}
              onStartCommonSession={() => setIsCommonSessionOpen(true)}
            />
          ) : selectedCourseId ? (
            <CourseDetailView
              courseId={selectedCourseId}
              onBackToCourseList={() => setSelectedCourseId(null)}
            />
          ) : (
            <CourseListView onSelectCourse={(courseId) => setSelectedCourseId(courseId)} />
          )}
        </main>
      </div>

      {/* スマホ版: ボトムナビゲーションバー */}
      <MobileBottomNav
        currentCategory={currentCategory}
        onSelectCategory={(cat) => {
          setCurrentCategory(cat);
        }}
      />

      {/* 共通プール 10問マイクロセッション モーダル */}
      {isCommonSessionOpen && (
        <CommonPoolSessionModal
          onClose={() => setIsCommonSessionOpen(false)}
          onOpenRecoveryRoom={() => {
            setCurrentCategory("HOME");
            setHomeSubTab("FORGOTTEN");
          }}
        />
      )}

      {/* 設定・データバックアップ モーダル */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
