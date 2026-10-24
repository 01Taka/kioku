import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { PlayIcon, SlidersIcon } from "./icons";

export interface HeaderNavProps {
  onOpenCommonSession: () => void;
  onOpenTodayMistakes: () => void;
  onOpenRecoveryRoom: () => void;
  onOpenSettings: () => void;
}

export function HeaderNav({
  onOpenCommonSession,
  onOpenTodayMistakes,
  onOpenRecoveryRoom,
  onOpenSettings,
}: HeaderNavProps) {
  const {
    cards,
    courses,
    lectures,
    settings,
    sessionState,
    getCommonPoolQueue,
  } = useAppStore();

  const queueSummary = useMemo(() => {
    return getCommonPoolQueue();
  }, [getCommonPoolQueue, cards, courses, lectures, settings, sessionState]);

  const mistakeCount = useMemo(() => {
    const mistakeSet = new Set(sessionState.todayMistakeCardIds);
    return cards.filter(
      (c) => mistakeSet.has(c.id) && c.lecturePool.phase === "ACTIVE",
    ).length;
  }, [cards, sessionState.todayMistakeCardIds]);

  const recoveryCount = queueSummary.recoveryCards.length;
  const sessionBatchCount = queueSummary.sessionBatch.length;
  const totalDueCount = queueSummary.totalRemainingCount;

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 select-none">
      {/* 左側: ブランドロゴ & システム概要 */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-base">
          🧠
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-white tracking-tight">
              Kioku
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-medium hidden sm:inline">
              2段階キュー × FSRS 長期記憶システム
            </span>
          </div>
        </div>
      </div>

      {/* 右側: グローバルナビゲーション・アクションボタン群 */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 text-xs">
        {/* 1. 今日の共通プール復習（10問マイクロセッション） */}
        <button
          type="button"
          onClick={onOpenCommonSession}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md shadow-emerald-950/60 flex items-center space-x-1.5 transition cursor-pointer"
          title="卒業済みカードの共通プール復習（10問マイクロセッション）を開始"
        >
          <PlayIcon size={12} />
          <span>🎯 今日の共通復習</span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-900/90 text-emerald-100 font-mono text-[11px]">
            {totalDueCount > 0
              ? `${totalDueCount}枚`
              : sessionBatchCount > 0
                ? `先取り${sessionBatchCount}枚`
                : "0枚"}
          </span>
        </button>

        {/* 2. 今日間違えた問題ハブ */}
        <button
          type="button"
          onClick={onOpenTodayMistakes}
          className={`px-3 py-1.5 rounded-xl border font-medium flex items-center space-x-1.5 transition cursor-pointer ${
            mistakeCount > 0
              ? "bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 border-amber-700/60"
              : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60"
          }`}
          title="本日の午前04:00以降に共通プールで間違えた問題の確認・一括降格"
        >
          <span>📝 今日のミス</span>
          {mistakeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono font-bold text-[10px]">
              {mistakeCount}
            </span>
          )}
        </button>

        {/* 3. リカバリー室（R < 0.35 隔離アラート） */}
        <button
          type="button"
          onClick={onOpenRecoveryRoom}
          className={`px-3 py-1.5 rounded-xl border font-medium flex items-center space-x-1.5 transition cursor-pointer ${
            recoveryCount > 0
              ? "bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border-rose-700/70 animate-pulse"
              : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60"
          }`}
          title="想起確率 R < 35% に低下したカードの隔離・救済トリアージ室"
        >
          <span>🏥 リカバリー室</span>
          {recoveryCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px]">
              {recoveryCount}
            </span>
          )}
        </button>

        {/* 4. 設定 & バックアップ */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition cursor-pointer"
          title="FSRS設定・JSONバックアップと復元"
        >
          <SlidersIcon size={15} />
        </button>
      </div>
    </header>
  );
}
