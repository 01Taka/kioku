import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { XIcon, SlidersIcon, PlayIcon } from "../icons";
import type { PriorityMode } from "../../types/schema";

interface HomeMainStartModalProps {
  onClose: () => void;
  onStartSession: () => void;
}

export function HomeMainStartModal({
  onClose,
  onStartSession,
}: HomeMainStartModalProps) {
  const {
    getCommonPoolQueue,
    courses,
    updateCourse,
    settings,
    updateSettings,
  } = useAppStore();

  const [isDetailSettingsOpen, setIsDetailSettingsOpen] = useState(false);

  const queueResult = getCommonPoolQueue();
  const batch = queueResult.sessionBatch;

  // 3色内訳
  const retryCount = queueResult.allTargetCards.filter(
    (c) => c.reviewCategory === "RETRY",
  ).length;
  const dueCount = queueResult.allTargetCards.filter(
    (c) => c.reviewCategory === "DUE",
  ).length;
  const earlyCount = queueResult.allTargetCards.filter(
    (c) => c.reviewCategory === "EARLY",
  ).length;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>🎯 今日の復習をはじめる</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* 1. 上部: 今回出題の問題内訳（オレンジ・グリーン・パープル） */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">今回出題の問題内訳:</span>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-amber-300 block">
                🔁 リベンジ枠
              </span>
              <strong className="text-xl font-bold font-mono text-amber-200 mt-1 block">
                {retryCount}
              </strong>
              <span className="text-[10px] text-amber-400/80">昨日ミスした問題</span>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-emerald-300 block">
                🎯 期日・最適枠
              </span>
              <strong className="text-xl font-bold font-mono text-emerald-200 mt-1 block">
                {dueCount}
              </strong>
              <span className="text-[10px] text-emerald-400/80">本日復習すべき問題</span>
            </div>

            <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-purple-300 block">
                ⚡ 先取り枠
              </span>
              <strong className="text-xl font-bold font-mono text-purple-200 mt-1 block">
                {earlyCount}
              </strong>
              <span className="text-[10px] text-purple-400/80">未来の期日カード</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center pt-1 font-mono">
            合計出題待ち: <strong>{queueResult.totalRemainingCount}</strong> 枚 （1回につき 10問マイクロセッション）
          </p>
        </div>

        {/* 2. 中部: 詳細設定ボタン */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsDetailSettingsOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <SlidersIcon size={14} />
            <span>詳細設定（出題順ソート・教材の優先順位）</span>
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
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <PlayIcon size={16} />
            <span>
              {batch.length > 0 ? "スタート (10問マイクロセッション)" : "出題対象のカードがありません"}
            </span>
          </button>
        </div>
      </div>

      {/* 詳細設定サブモーダル */}
      {isDetailSettingsOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <SlidersIcon size={16} className="text-indigo-400" />
                <span>出題詳細設定</span>
              </h3>
              <button
                onClick={() => setIsDetailSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pr-1 text-xs">
              {/* 出題順のソート設定（ドロップダウン） */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block">
                  出題順のソート設定
                </label>
                <select
                  value={settings.sortOrder}
                  onChange={(e) =>
                    updateSettings({
                      sortOrder: e.target.value as "DUE_ASC" | "SHUFFLE",
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer focus:border-indigo-500"
                >
                  <option value="DUE_ASC">
                    📅 due順（復習期日が古い順に確実に出題）
                  </option>
                  <option value="SHUFFLE">
                    🔀 カテゴリ内シャッフル（オレンジ・グリーンをシャッフル）
                  </option>
                </select>
              </div>

              {/* 教材の優先順位（教材名 | 強制 優先 通常 の縦リスト） */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">教材（科目）の優先順位</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {courses.length} 科目
                  </span>
                </div>

                <div className="border border-slate-800 rounded-xl divide-y divide-slate-800 bg-slate-950/40">
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
                          className="p-3 flex items-center justify-between gap-3"
                        >
                          <span className="font-medium text-slate-200 truncate flex-1">
                            {course.name}
                          </span>

                          {/* 横並びのラジオボタン */}
                          <div className="flex items-center space-x-3 flex-shrink-0 text-[11px]">
                            <label className="flex items-center space-x-1 cursor-pointer hover:text-white text-slate-400">
                              <input
                                type="radio"
                                name={`priority-${course.id}`}
                                checked={mode === "FORCE"}
                                onChange={() =>
                                  updateCourse(course.id, { priorityMode: "FORCE" })
                                }
                                className="accent-rose-500 cursor-pointer"
                              />
                              <span className={mode === "FORCE" ? "text-rose-400 font-bold" : ""}>
                                強制
                              </span>
                            </label>

                            <label className="flex items-center space-x-1 cursor-pointer hover:text-white text-slate-400">
                              <input
                                type="radio"
                                name={`priority-${course.id}`}
                                checked={mode === "PRIORITY"}
                                onChange={() =>
                                  updateCourse(course.id, { priorityMode: "PRIORITY" })
                                }
                                className="accent-indigo-500 cursor-pointer"
                              />
                              <span className={mode === "PRIORITY" ? "text-indigo-400 font-bold" : ""}>
                                優先
                              </span>
                            </label>

                            <label className="flex items-center space-x-1 cursor-pointer hover:text-white text-slate-400">
                              <input
                                type="radio"
                                name={`priority-${course.id}`}
                                checked={mode === "NORMAL"}
                                onChange={() =>
                                  updateCourse(course.id, { priorityMode: "NORMAL" })
                                }
                                className="accent-emerald-500 cursor-pointer"
                              />
                              <span className={mode === "NORMAL" ? "text-emerald-400 font-bold" : ""}>
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

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailSettingsOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition cursor-pointer"
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
