import { useState, useEffect } from "react";
import {
  DesktopSidebar,
  MobileBottomNav,
  type NavCategory,
  type HomeSubTab,
} from "./components/navigation/AppNavigation";
import { HomeView } from "./components/home/HomeView";
import { CourseListView } from "./components/materials/CourseListView";
import { CourseDetailView } from "./components/materials/CourseDetailView";
import { CommonPoolSessionModal } from "./components/session/CommonPoolSessionModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { SettingsIcon } from "./components/icons";
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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      {/* PC版: 左固定サイドバー */}
      <div className="hidden md:flex h-full">
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
      <div className="flex-1 flex flex-col h-full overflow-hidden pb-14 md:pb-0">
        {/* スマホ版専用トップバー (ヘッダー端に設定アイコン) */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow">
              K
            </div>
            <span className="font-bold text-sm text-white">Kioku</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="設定"
          >
            <SettingsIcon size={18} />
          </button>
        </header>

        {/* 画面コンテンツのルーティング */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
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
            <CourseListView
              onSelectCourse={(courseId) => setSelectedCourseId(courseId)}
            />
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
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
