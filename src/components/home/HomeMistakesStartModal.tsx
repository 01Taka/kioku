import { useState } from "react";

import { PlayIcon, XIcon } from "../icons";

interface HomeMistakesStartModalProps {
  onClose: () => void;
  onStart: (count: number | "ALL") => void;
  totalMistakes: number;
}

export function HomeMistakesStartModal({
  onClose,
  onStart,
  totalMistakes,
}: HomeMistakesStartModalProps) {
  const [selectedCount, setSelectedCount] = useState<number | "ALL">(10);

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="flex items-center space-x-2 text-base font-bold text-white">
            <span>📝 ミス問題特訓をはじめますか？</span>
          </h3>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* 上部は空ける */}
        <div className="py-1">
          <p className="text-xs leading-relaxed text-slate-400">
            本日間違えた全 <strong>{totalMistakes}</strong>{" "}
            問の中から、指定した問題数を取り出して集中リベンジ演習を行います。
          </p>
        </div>

        {/* 中部: 出題数のドロップダウン（10 | 20 | 30 | すべて） */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">出題する問題数</label>
          <select
            value={selectedCount}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCount(val === "ALL" ? "ALL" : Number(val));
            }}
            className="w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
          >
            <option value={10}>10問 （デフォルト）</option>
            <option value={20}>20問</option>
            <option value={30}>30問</option>
            <option value="ALL">すべて ({totalMistakes}問)</option>
          </select>
        </div>

        {/* 下部: スタートボタン */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStart(selectedCount);
            }}
            disabled={totalMistakes === 0}
            className="flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-xl bg-amber-600 py-3 text-xs font-bold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlayIcon size={14} />
            <span>特訓スタート</span>
          </button>
        </div>
      </div>
    </div>
  );
}
