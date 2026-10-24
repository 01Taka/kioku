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
  const { cards, courses, lectures, settings, sessionState, getCommonPoolQueue } = useAppStore();

  const queueSummary = useMemo(() => {
    return getCommonPoolQueue();
  }, [getCommonPoolQueue, cards, courses, lectures, settings, sessionState]);

  const mistakeCount = useMemo(() => {
    const mistakeSet = new Set(sessionState.todayMistakeCardIds);
    return cards.filter((c) => mistakeSet.has(c.id) && c.lecturePool.phase === "GRADUATED").length;
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
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 select-none sm:px-6">
      {/* 左側: ブランドロゴ & システム概要 */}
      <div className="flex items-center space-x-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-600/20 text-base">
          🧠
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold tracking-tight text-white">Kioku</span>
            <span className="hidden rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-indigo-300 md:inline">
              2段階キュー × FSRS 長期記憶システム
            </span>
          </div>
        </div>
      </div>

      {/* 右側: グローバルナビゲーション・アクションボタン群 */}
      <div className="flex items-center space-x-2 text-xs sm:space-x-2.5">
        {/* 1. 今日の共通プール復習（10問マイクロセッション + 3色内訳ピル） */}
        <div className="flex items-center rounded-xl border border-emerald-600/50 bg-slate-950/90 p-0.5 shadow-md shadow-emerald-950/40">
          <button
            type="button"
            onClick={onOpenCommonSession}
            className="flex cursor-pointer items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white transition hover:bg-emerald-500"
            title="卒業済みカードの共通プール復習（10問マイクロセッション）を開始"
          >
            <PlayIcon size={12} />
            <span>🎯 今日の共通復習</span>
            <span className="py-0.2 rounded-full bg-emerald-900/90 px-1.5 font-mono text-[11px] text-emerald-100">
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
              className="hidden cursor-pointer items-center space-x-1.5 px-2.5 py-1 font-mono text-[11px] sm:flex"
              title={`本日のキュー内訳 — 🔁リベンジ: ${colorBreakdown.retryCount}枚 / 🎯期日到来: ${colorBreakdown.dueCount}枚 / ⚡先取り補充: ${colorBreakdown.earlyCount}枚`}
            >
              {colorBreakdown.retryCount > 0 && (
                <span className="py-0.2 rounded border border-amber-500/40 bg-amber-500/20 px-1.5 font-bold text-amber-300">
                  🔁{colorBreakdown.retryCount}
                </span>
              )}
              {colorBreakdown.dueCount > 0 && (
                <span className="py-0.2 rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 font-bold text-emerald-300">
                  🎯{colorBreakdown.dueCount}
                </span>
              )}
              {colorBreakdown.earlyCount > 0 && (
                <span className="py-0.2 rounded border border-purple-500/40 bg-purple-500/20 px-1.5 font-bold text-purple-300">
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
          className={`flex cursor-pointer items-center space-x-1.5 rounded-xl border px-3 py-1.5 font-medium transition ${
            mistakeCount > 0
              ? "border-amber-700/60 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60"
              : "border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-800"
          }`}
          title="本日の午前04:00以降に共通プールで間違えた問題の確認・一括降格"
        >
          <span>📝 今日のミス</span>
          {mistakeCount > 0 && (
            <span className="py-0.2 rounded-full bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-slate-950">
              {mistakeCount}
            </span>
          )}
        </button>

        {/* 3. リカバリー室（R < 0.35 救済アラート） */}
        <button
          type="button"
          onClick={onOpenRecoveryRoom}
          className={`flex cursor-pointer items-center space-x-1.5 rounded-xl border px-3 py-1.5 font-medium transition ${
            recoveryCount > 0
              ? "animate-pulse border-rose-700/70 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70"
              : "border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-800"
          }`}
          title="想起確率 R < 35% に低下したカードの救済トリアージ室（放置カードの一括整理）"
        >
          <span>🏥 リカバリー室</span>
          {recoveryCount > 0 && (
            <span className="py-0.2 rounded-full bg-rose-500 px-1.5 font-mono text-[10px] font-bold text-white">
              {recoveryCount}
            </span>
          )}
        </button>

        {/* 4. 設定 & バックアップ */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="cursor-pointer rounded-xl border border-slate-700/60 bg-slate-800/80 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          title="FSRS設定・JSONバックアップと復元"
        >
          <SlidersIcon size={15} />
        </button>
      </div>
    </header>
  );
}
