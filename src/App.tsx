import { useState, useEffect } from "react";
import { HeaderNav } from "./components/HeaderNav";
import { Sidebar } from "./components/Sidebar";
import { LecturePoolDetail } from "./components/LecturePoolDetail";
import { CommonPoolSessionModal } from "./components/session/CommonPoolSessionModal";
import { TodayMistakesModal } from "./components/session/TodayMistakesView";
import { RecoveryRoomModal } from "./components/recovery/RecoveryRoomModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const { courses, loadSampleData, syncDailyCutoff } = useAppStore();

  const [isCommonSessionOpen, setIsCommonSessionOpen] = useState(false);
  const [isTodayMistakesOpen, setIsTodayMistakesOpen] = useState(false);
  const [isRecoveryRoomOpen, setIsRecoveryRoomOpen] = useState(false);
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      <HeaderNav
        onOpenCommonSession={() => setIsCommonSessionOpen(true)}
        onOpenTodayMistakes={() => setIsTodayMistakesOpen(true)}
        onOpenRecoveryRoom={() => setIsRecoveryRoomOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <LecturePoolDetail />
      </div>

      {/* 共通プール 10問マイクロセッション */}
      {isCommonSessionOpen && (
        <CommonPoolSessionModal
          onClose={() => setIsCommonSessionOpen(false)}
        />
      )}

      {/* 今日間違えた問題ハブ */}
      {isTodayMistakesOpen && (
        <TodayMistakesModal onClose={() => setIsTodayMistakesOpen(false)} />
      )}

      {/* リカバリー室 (R < 0.35 救済トリアージ) */}
      {isRecoveryRoomOpen && (
        <RecoveryRoomModal onClose={() => setIsRecoveryRoomOpen(false)} />
      )}

      {/* 設定・データバックアップ */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
