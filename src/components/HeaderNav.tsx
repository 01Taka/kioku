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
      (c) => mistakeSet.has(c.id) && c.lecturePool.phase === "GRADUATED",
    ).length;
  }, [cards, sessionState.todayMistakeCardIds]);

  const recoveryCount = queueSummary.recoveryCards.length;
  const sessionBatch = queueSummary.sessionBatch;
  const sessionBatchCount = sessionBatch.length;
  const totalDueCount = queueSummary.totalRemainingCount;

  // 3色の内訳を集計（全対象 + 先取り補充枠）
  const colorBreakdown = useMemo(() => {
    const retryInTarget = queueSummary.allTargetCards.filter(
      (i) => i.reviewCategory === "RETRY",
    ).length;
    const dueInTarget = queueSummary.allTargetCards.filter(
      (i) => i.reviewCategory === "DUE",
    ).length;
    const earlyInBatch = queueSummary.earlyReviewCountInBatch;

    return {
      retryCount: retryInTarget,
      dueCount: dueInTarget,
      earlyCount: earlyInBatch,
    };
  }, [queueSummary]);

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
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-medium hidden md:inline">
              2段階キュー × FSRS 長期記憶システム
            </span>
          </div>
        </div>
      </div>

      {/* 右側: グローバルナビゲーション・アクションボタン群 */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 text-xs">
        {/* 1. 今日の共通プール復習（10問マイクロセッション + 3色内訳ピル） */}
        <div className="flex items-center rounded-xl bg-slate-950/90 border border-emerald-600/50 p-0.5 shadow-md shadow-emerald-950/40">
          <button
            type="button"
            onClick={onOpenCommonSession}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
            title="卒業済みカードの共通プール復習（10問マイクロセッション）を開始"
          >
            <PlayIcon size={12} />
            <span>🎯 今日の共通復習</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-900/90 text-emerald-100 font-mono text-[11px]">
              {totalDueCount > 0
                ? `${totalDueCount}枚`
                : sessionBatchCount > 0
                  ? `先取り${sessionBatchCount}枚`
                  : "0枚"}
            </span>
          </button>

          {/* 3色カラーコーディング内訳（リベンジ / 期日 / 先取り） */}
          {(colorBreakdown.retryCount > 0 ||
            colorBreakdown.dueCount > 0 ||
            colorBreakdown.earlyCount > 0) && (
            <div
              onClick={onOpenCommonSession}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-mono cursor-pointer"
              title={`本日のキュー内訳 — 🔁リベンジ: ${colorBreakdown.retryCount}枚 / 🎯期日到来: ${colorBreakdown.dueCount}枚 / ⚡先取り補充: ${colorBreakdown.earlyCount}枚`}
            >
              {colorBreakdown.retryCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  🔁{colorBreakdown.retryCount}
                </span>
              )}
              {colorBreakdown.dueCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  🎯{colorBreakdown.dueCount}
                </span>
              )}
              {colorBreakdown.earlyCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  ⚡{colorBreakdown.earlyCount}
                </span>
              )}
            </div>
          )}
        </div>

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

        {/* 3. リカバリー室（R < 0.35 救済アラート） */}
        <button
          type="button"
          onClick={onOpenRecoveryRoom}
          className={`px-3 py-1.5 rounded-xl border font-medium flex items-center space-x-1.5 transition cursor-pointer ${
            recoveryCount > 0
              ? "bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border-rose-700/70 animate-pulse"
              : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60"
          }`}
          title="想起確率 R < 35% に低下したカードの救済トリアージ室（放置カードの一括整理）"
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
