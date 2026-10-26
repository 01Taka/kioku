import { useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import type { PriorityMode } from "../../types/schema";
import { PlayIcon, SlidersIcon, XIcon } from "../icons";

interface HomeMainStartModalProps {
  onClose: () => void;
  onStartSession: () => void;
}

export function HomeMainStartModal({ onClose, onStartSession }: HomeMainStartModalProps) {
  const { getCommonPoolQueue, courses, updateCourse, settings, updateSettings } = useAppStore();

  const [isDetailSettingsOpen, setIsDetailSettingsOpen] = useState(false);

  const queueResult = getCommonPoolQueue();
  const batch = queueResult.sessionBatch;

  // 3色内訳（今回出題するバッチの内訳）
  const retryCount = batch.filter((c) => c.reviewCategory === "RETRY").length;
  const dueCount = batch.filter((c) => c.reviewCategory === "DUE").length;
  const earlyCount = batch.filter((c) => c.reviewCategory === "EARLY").length;
  const totalRemainingCount = Math.max(queueResult.totalRemainingCount, batch.length);

  // スタートボタンの色判定
  // 1. 出題できる問題がなければグレー
  // 2. リベンジが1つでもあればリベンジの色（amber）
  // 3. リベンジがなく本日期日が1つでもあれば本日期日の色（emerald）
  // 4. 先取りしかなければ先取りの色（purple）
  const startButtonColor =
    batch.length === 0
      ? "bg-slate-800 text-slate-500 border border-slate-700/60 shadow-none cursor-not-allowed"
      : retryCount > 0
        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 cursor-pointer"
        : dueCount > 0
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 cursor-pointer"
          : "bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 cursor-pointer";

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="flex items-center space-x-2 text-base font-bold text-white">
            <span>🎯 今日の復習をはじめる</span>
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* 1. 上部: 今回出題の問題内訳（オレンジ・グリーン・パープル） */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">出題の内訳</span>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/40 p-2.5 text-center">
              <span className="block text-[11px] font-semibold text-amber-300">🔁 リベンジ</span>
              <strong className="mt-0.5 block font-mono text-xl font-bold text-amber-200">
                {retryCount}
              </strong>
            </div>

            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-2.5 text-center">
              <span className="block text-[11px] font-semibold text-emerald-300">🎯 本日期日</span>
              <strong className="mt-0.5 block font-mono text-xl font-bold text-emerald-200">
                {dueCount}
              </strong>
            </div>

            <div className="rounded-xl border border-purple-800/60 bg-purple-950/40 p-2.5 text-center">
              <span className="block text-[11px] font-semibold text-purple-300">⚡ 先取り</span>
              <strong className="mt-0.5 block font-mono text-xl font-bold text-purple-200">
                {earlyCount}
              </strong>
            </div>
          </div>
          <p className="pt-1 text-center font-mono text-[11px] text-slate-400">
            合計出題待ち: <strong>{totalRemainingCount}</strong> 枚
          </p>
        </div>

        {/* 2. 中部: 詳細設定ボタン */}
        <div>
          <button
            type="button"
            onClick={() => setIsDetailSettingsOpen(true)}
            className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <SlidersIcon size={14} />
            <span>詳細設定</span>
          </button>
        </div>

        {/* 3. 下部: スタートボタン */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartSession();
            }}
            disabled={batch.length === 0}
            className={`flex w-full items-center justify-center space-x-2 rounded-xl py-3.5 text-sm font-bold transition ${startButtonColor}`}
          >
            <PlayIcon size={16} />
            <span>
              {batch.length > 0
                ? `スタート (${batch.length}問マイクロセッション)`
                : "出題対象のカードがありません"}
            </span>
          </button>
        </div>
      </div>

      {/* 詳細設定サブモーダル */}
      {isDetailSettingsOpen && (
        <div className="animate-fadeIn fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="flex items-center space-x-2 text-sm font-bold text-white">
                <SlidersIcon size={16} className="text-indigo-400" />
                <span>出題詳細設定</span>
              </h3>
              <button
                onClick={() => setIsDetailSettingsOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pr-1 text-xs">
              {/* 出題順のソート設定（ドロップダウン） */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">出題順のソート設定</label>
                <select
                  value={settings.sortOrder}
                  onChange={(e) =>
                    updateSettings({
                      sortOrder: e.target.value as "DUE_ASC" | "SHUFFLE",
                    })
                  }
                  className="w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-indigo-500"
                >
                  <option value="DUE_ASC">📅 due順（復習期日が古い順に確実に出題）</option>
                  <option value="SHUFFLE">
                    🔀 カテゴリ内シャッフル（オレンジ・グリーンをシャッフル）
                  </option>
                </select>
              </div>

              {/* 教材の優先順位（教材名 | 強制 優先 通常 の縦リスト） */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">教材（科目）の優先順位</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {courses.length} 科目
                  </span>
                </div>

                <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40">
                  {courses.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      登録されている科目がありません
                    </div>
                  ) : (
                    courses.map((course) => {
                      const mode: PriorityMode = course.priorityMode || "NORMAL";
                      return (
                        <div
                          key={course.id}
                          className="flex items-center justify-between gap-3 p-3"
                        >
                          <span className="flex-1 truncate font-medium text-slate-200">
                            {course.name}
                          </span>

                          {/* 横並びのラジオボタン */}
                          <div className="flex flex-shrink-0 items-center space-x-3 text-[11px]">
                            <label className="flex cursor-pointer items-center space-x-1 text-slate-400 hover:text-white">
                              <input
                                type="radio"
                                name={`priority-${course.id}`}
                                checked={mode === "FORCE"}
                                onChange={() => updateCourse(course.id, { priorityMode: "FORCE" })}
                                className="cursor-pointer accent-rose-500"
                              />
                              <span className={mode === "FORCE" ? "font-bold text-rose-400" : ""}>
                                強制
                              </span>
                            </label>

                            <label className="flex cursor-pointer items-center space-x-1 text-slate-400 hover:text-white">
                              <input
                                type="radio"
                                name={`priority-${course.id}`}
                                checked={mode === "PRIORITY"}
                                onChange={() =>
                                  updateCourse(course.id, { priorityMode: "PRIORITY" })
                                }
                                className="cursor-pointer accent-indigo-500"
                              />
                              <span
                                className={mode === "PRIORITY" ? "font-bold text-indigo-400" : ""}
                              >
                                優先
                              </span>
                            </label>

                            <label className="flex cursor-pointer items-center space-x-1 text-slate-400 hover:text-white">
                              <input
                                type="radio"
                                name={`priority-${course.id}`}
                                checked={mode === "NORMAL"}
                                onChange={() => updateCourse(course.id, { priorityMode: "NORMAL" })}
                                className="cursor-pointer accent-emerald-500"
                              />
                              <span
                                className={mode === "NORMAL" ? "font-bold text-emerald-400" : ""}
                              >
                                通常
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-2">
              <button
                type="button"
                onClick={() => setIsDetailSettingsOpen(false)}
                className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-500"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
