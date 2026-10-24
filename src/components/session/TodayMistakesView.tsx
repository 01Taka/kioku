import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";
import { XIcon, UndoIcon, CheckIcon } from "../icons";

export interface TodayMistakesSectionProps {
  /** コンパクト表示（セッションブレイク画面への埋め込み時） */
  compact?: boolean;
}

export function TodayMistakesSection({ compact = false }: TodayMistakesSectionProps) {
  const {
    cards,
    courses,
    lectures,
    sessionState,
    syncDailyCutoff,
    batchDemoteToLecturePool,
  } = useAppStore();

  useEffect(() => {
    syncDailyCutoff();
  }, [syncDailyCutoff]);

  const mistakeCards = useMemo(() => {
    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const lectureMap = new Map(lectures.map((l) => [l.id, l]));
    const mistakeIdSet = new Set(sessionState.todayMistakeCardIds);

    return cards
      .filter((c) => mistakeIdSet.has(c.id) && c.lecturePool.phase === "ACTIVE")
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
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center space-y-2">
        {demotedNoticeCount !== null && (
          <div className="mb-2 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-lg py-1.5 px-3">
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
        <div className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-lg py-2 px-3 flex items-center justify-between">
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
            className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
          >
            {selectedIds.size === mistakeCards.length ? "すべて解除" : "すべて選択"}
          </button>
          <button
            type="button"
            onClick={handleBatchDemote}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
          >
            <UndoIcon size={13} />
            <span>選択したカードを講義プールに戻す ({selectedIds.size}枚)</span>
          </button>
        </div>
      </div>

      <div
        className={`space-y-2 overflow-y-auto pr-1 ${
          compact ? "max-h-56" : "max-h-96"
        }`}
      >
        {mistakeCards.map(({ card, courseName, lectureName, consecutiveFailCount }) => {
          const isChecked = selectedIds.has(card.id);
          return (
            <label
              key={card.id}
              onClick={() => toggleSelect(card.id)}
              className={`block p-3 rounded-xl border transition cursor-pointer select-none ${
                isChecked
                  ? "bg-amber-950/30 border-amber-600/60"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                      isChecked
                        ? "bg-amber-500 border-amber-400 text-slate-950"
                        : "bg-slate-950 border-slate-700"
                    }`}
                  >
                    {isChecked && <CheckIcon size={11} />}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    {/* 所属パンくず */}
                    <span className="text-[11px] text-indigo-300 font-medium truncate">
                      {courseName} &gt; {lectureName}
                    </span>

                    {/* 連続ミス回数バッジ */}
                    <div className="flex items-center space-x-1.5">
                      {consecutiveFailCount >= 3 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-700/70">
                          🔥 {consecutiveFailCount}連続ミス (降格推奨)
                        </span>
                      ) : consecutiveFailCount === 2 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/70">
                          ⚠️ 2連続ミス (降格推奨)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                          🔁 1回ミス (明日リベンジ出題)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">問題</span>
                      <p className="text-slate-100 line-clamp-2">{card.front}</p>
                    </div>
                    <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">解答</span>
                      <p className="text-slate-300 line-clamp-2">{card.back}</p>
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">
              📝 今日間違えた問題（振り返り・一括降格ハブ）
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ミスした問題は翌日の共通プールで最優先（🔁オレンジ枠）出題されます。記憶が抜けている問題は講義プールへ戻して再特訓できます。
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <XIcon size={18} />
          </button>
        </div>

        <TodayMistakesSection />

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
