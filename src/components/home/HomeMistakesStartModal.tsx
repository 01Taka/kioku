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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-6 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>📝 ミス問題特訓をはじめますか？</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* 上部は空ける */}
        <div className="py-1">
          <p className="text-xs text-slate-400 leading-relaxed">
            本日間違えた全 <strong>{totalMistakes}</strong> 問の中から、指定した問題数を取り出して集中リベンジ演習を行います。
          </p>
        </div>

        {/* 中部: 出題数のドロップダウン（10 | 20 | 30 | すべて） */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            出題する問題数
          </label>
          <select
            value={selectedCount}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCount(val === "ALL" ? "ALL" : Number(val));
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-amber-500"
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
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/30 flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            <PlayIcon size={14} />
            <span>特訓スタート</span>
          </button>
        </div>
      </div>
    </div>
  );
}
