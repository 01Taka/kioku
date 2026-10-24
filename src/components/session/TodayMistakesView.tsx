import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import { CheckIcon, UndoIcon, XIcon } from "../icons";

export interface TodayMistakesSectionProps {
  /** コンパクト表示（セッションブレイク画面への埋め込み時） */
  compact?: boolean;
}

export function TodayMistakesSection({ compact = false }: TodayMistakesSectionProps) {
  const { cards, courses, lectures, sessionState, syncDailyCutoff, batchDemoteToLecturePool } =
    useAppStore();

  useEffect(() => {
    syncDailyCutoff();
  }, [syncDailyCutoff]);

  const mistakeCards = useMemo(() => {
    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const lectureMap = new Map(lectures.map((l) => [l.id, l]));
    const mistakeIdSet = new Set(sessionState.todayMistakeCardIds);

    return cards
      .filter((c) => mistakeIdSet.has(c.id) && c.lecturePool.phase === "GRADUATED")
      .map((card) => ({
        card,
        courseName: courseMap.get(card.courseId)?.name ?? "不明な科目",
        lectureName: lectureMap.get(card.lectureId)?.name ?? "不明な講義",
        consecutiveFailCount: card.commonPool?.consecutiveFailCount ?? 1,
      }))
      .sort((a, b) => b.consecutiveFailCount - a.consecutiveFailCount);
  }, [cards, courses, lectures, sessionState.todayMistakeCardIds]);

  // 連続2回以上（consecutiveFailCount >= 2）のカードには初期状態でチェックを自動付与
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [demotedNoticeCount, setDemotedNoticeCount] = useState<number | null>(null);

  useEffect(() => {
    const autoChecked = new Set<string>();
    for (const item of mistakeCards) {
      if (item.consecutiveFailCount >= 2) {
        autoChecked.add(item.card.id);
      }
    }
    setSelectedIds(autoChecked);
  }, [mistakeCards]);

  const toggleSelect = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === mistakeCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mistakeCards.map((m) => m.card.id)));
    }
  };

  const handleBatchDemote = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const count = batchDemoteToLecturePool(ids);
    setDemotedNoticeCount(count);
    setSelectedIds(new Set());
  };

  if (mistakeCards.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
        {demotedNoticeCount !== null && (
          <div className="mb-2 rounded-lg border border-emerald-800/60 bg-emerald-950/60 px-3 py-1.5 text-xs text-emerald-300">
            ✅ {demotedNoticeCount} 枚のカードを所属講義の専用プール（未暗記）へ戻しました
          </div>
        )}
        <p className="text-xs text-slate-400">
          本日（午前04:00以降）に共通プールで間違えた問題はありません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {demotedNoticeCount !== null && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-800/60 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-300">
          <span>
            ✅ {demotedNoticeCount} 枚のカードを所属講義の専用プール（未暗記）へ戻しました
          </span>
          <button
            type="button"
            onClick={() => setDemotedNoticeCount(null)}
            className="text-emerald-400 hover:text-white"
          >
            <XIcon size={13} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-amber-300">
            📝 今日間違えた問題 ({mistakeCards.length}枚)
          </span>
          <span className="text-[11px] text-slate-400">
            ※2連続以上のミスは自動でチェックされています
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={selectAll}
            className="cursor-pointer rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-700"
          >
            {selectedIds.size === mistakeCards.length ? "すべて解除" : "すべて選択"}
          </button>
          <button
            type="button"
            onClick={handleBatchDemote}
            disabled={selectedIds.size === 0}
            className="flex cursor-pointer items-center space-x-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UndoIcon size={13} />
            <span>選択したカードを講義プールに戻す ({selectedIds.size}枚)</span>
          </button>
        </div>
      </div>

      <div className={`space-y-2 overflow-y-auto pr-1 ${compact ? "max-h-56" : "max-h-96"}`}>
        {mistakeCards.map(({ card, courseName, lectureName, consecutiveFailCount }) => {
          const isChecked = selectedIds.has(card.id);
          return (
            <label
              key={card.id}
              onClick={() => toggleSelect(card.id)}
              className={`block cursor-pointer rounded-xl border p-3 transition select-none ${
                isChecked
                  ? "border-amber-600/60 bg-amber-950/30"
                  : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="pt-0.5">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                      isChecked
                        ? "border-amber-400 bg-amber-500 text-slate-950"
                        : "border-slate-700 bg-slate-950"
                    }`}
                  >
                    {isChecked && <CheckIcon size={11} />}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    {/* 所属パンくず */}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-indigo-300">
                      {courseName} &gt; {lectureName}
                    </span>

                    {/* 連続ミス回数バッジ */}
                    <div className="flex shrink-0 items-center space-x-1.5">
                      {consecutiveFailCount >= 3 ? (
                        <span className="rounded-full border border-rose-700/70 bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                          🔥 {consecutiveFailCount}連続ミス (降格推奨)
                        </span>
                      ) : consecutiveFailCount === 2 ? (
                        <span className="rounded-full border border-amber-700/70 bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          ⚠️ 2連続ミス (降格推奨)
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          🔁 1回ミス (明日リベンジ出題)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2">
                      <span className="block text-[10px] text-slate-500">問題</span>
                      <p className="line-clamp-2 text-slate-100">{card.front}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2">
                      <span className="block text-[10px] text-slate-500">解答</span>
                      <p className="line-clamp-2 text-slate-300">{card.back}</p>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export interface TodayMistakesModalProps {
  onClose: () => void;
}

export function TodayMistakesModal({ onClose }: TodayMistakesModalProps) {
  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">
              📝 今日間違えた問題（振り返り・一括降格ハブ）
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              ミスした問題は翌日の共通プールで最優先（🔁オレンジ枠）出題されます。記憶が抜けている問題は講義プールへ戻して再特訓できます。
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        <TodayMistakesSection />

        <div className="flex justify-end border-t border-slate-800 pt-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
