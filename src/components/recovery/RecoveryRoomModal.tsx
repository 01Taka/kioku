import { useMemo, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import { CheckIcon, PlayIcon, UndoIcon, XIcon } from "../icons";
import { LecturePlayer, type PracticeCardItem } from "../practice/LecturePlayer";

export interface RecoveryRoomModalProps {
  onClose: () => void;
}

export function RecoveryRoomModal({ onClose }: RecoveryRoomModalProps) {
  const {
    cards,
    courses,
    lectures,
    settings,
    getCommonPoolQueue,
    batchDemoteToLecturePool,
    answerRecoveryTestCard,
  } = useAppStore();

  const recoveryCards = useMemo(() => {
    return getCommonPoolQueue().recoveryCards;
  }, [getCommonPoolQueue, cards, courses, lectures, settings]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [testingCards, setTestingCards] = useState<PracticeCardItem[] | null>(null);

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

  const toggleSelectAll = () => {
    if (selectedIds.size === recoveryCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recoveryCards.map((r) => r.card.id)));
    }
  };

  // アクション1: すべて講義プールに戻す（未暗記として再特訓）
  const handleDemoteAll = () => {
    if (recoveryCards.length === 0) return;
    if (
      !window.confirm(
        `リカバリー室の全 ${recoveryCards.length} 枚のカードを、それぞれの所属講義プール（未暗記）へ戻しますか？\n（FSRS履歴はリセットされます）`,
      )
    ) {
      return;
    }
    const allIds = recoveryCards.map((r) => r.card.id);
    const count = batchDemoteToLecturePool(allIds);
    setSelectedIds(new Set());
    setStatusMessage(`✅ 全 ${count} 枚のカードを所属講義プール（未暗記）へ戻しました。`);
  };

  // アクション2: 選択して講義プールに戻す
  const handleDemoteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const count = batchDemoteToLecturePool(ids);
    setSelectedIds(new Set());
    setStatusMessage(`✅ 選択した ${count} 枚のカードを所属講義プール（未暗記）へ戻しました。`);
  };

  // アクション3: このまま共通プールでテストする（正解なら復帰、不正解なら即講義プールへ降格）
  const handleStartRecoveryTest = () => {
    const targetItems =
      selectedIds.size > 0
        ? recoveryCards.filter((r) => selectedIds.has(r.card.id))
        : recoveryCards;

    if (targetItems.length === 0) return;

    setTestingCards(
      targetItems.map((item) => ({
        id: item.card.id,
        front: item.card.front,
        back: item.card.back,
        badge: `${item.courseName} > ${item.lectureName} (R: ${Math.round(item.retrievability * 100)}%)`,
      })),
    );
  };

  if (testingCards) {
    return (
      <LecturePlayer
        lectureTitle="🏥 リカバリー室 救済テスト（⭕正解で共通プール復帰 / ❌間違いで講義プールへ即降格）"
        mode="TRAINING"
        headerBadgeText="🏥 リカバリー救済テスト"
        cards={testingCards}
        onAnswer={(cardId, result) => {
          answerRecoveryTestCard(cardId, result === "correct" ? "GOOD" : "AGAIN");
        }}
        onFinish={(results) => {
          const recovered = Object.values(results).filter((r) => r === "correct").length;
          const demoted = Object.values(results).filter((r) => r === "incorrect").length;
          setStatusMessage(
            `🏥 救済テスト結果: ${recovered} 枚が共通プールへ復帰、${demoted} 枚が講義プール（未暗記）へ降格しました。`,
          );
        }}
        onClose={() => {
          setTestingCards(null);
          setSelectedIds(new Set());
        }}
      />
    );
  }

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏥</span>
            <h2 className="text-base font-bold text-white">リカバリー室</h2>
            <span className="rounded-full border border-rose-800/60 bg-rose-950/80 px-2 py-0.5 font-mono text-xs text-rose-300">
              {recoveryCards.length} 枚
            </span>
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        {statusMessage && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-800/60 bg-emerald-950/60 px-3.5 py-2.5 text-xs text-emerald-300">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-emerald-400 hover:text-white"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}

        {/* 3大救済アクションツールバー */}
        {recoveryCards.length > 0 && (
          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">救済アクションを選択:</span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="cursor-pointer text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
              >
                {selectedIds.size === recoveryCards.length
                  ? "すべての選択を解除"
                  : `すべて選択 (${recoveryCards.length}枚)`}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              {/* アクション1: すべて講義プールに戻す */}
              <button
                type="button"
                onClick={handleDemoteAll}
                className="flex cursor-pointer items-center justify-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                <UndoIcon size={13} className="text-amber-400" />
                <span>① すべて講義プールに戻す</span>
              </button>

              {/* アクション2: 選択して講義プールに戻す */}
              <button
                type="button"
                onClick={handleDemoteSelected}
                disabled={selectedIds.size === 0}
                className="flex cursor-pointer items-center justify-center space-x-1.5 rounded-lg bg-amber-600/90 p-2.5 font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UndoIcon size={13} />
                <span>② 選択分を講義に戻す ({selectedIds.size}枚)</span>
              </button>

              {/* アクション3: このまま共通プールでテストする */}
              <button
                type="button"
                onClick={handleStartRecoveryTest}
                className="flex cursor-pointer items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 p-2.5 font-semibold text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500"
                title="正解なら共通プール復帰、不正解なら講義プールへ即降格"
              >
                <PlayIcon size={12} />
                <span>
                  ③ 共通プールで救済テスト (
                  {selectedIds.size > 0 ? `${selectedIds.size}枚` : `全${recoveryCards.length}枚`})
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 隔離カード一覧 */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {recoveryCards.length === 0 ? (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 py-12 text-center">
              <div className="text-2xl">🎉</div>
              <p className="text-xs font-semibold text-slate-200">
                リカバリー室に隔離されているカードはありません
              </p>
              <p className="text-[11px] text-slate-400">
                すべての卒業済みカードが良好な記憶維持率（R ≧ 35%）を保っています。
              </p>
            </div>
          ) : (
            recoveryCards.map(({ card, courseName, lectureName, retrievability }) => {
              const isChecked = selectedIds.has(card.id);
              const rPercent = Math.round(retrievability * 100);

              return (
                <label
                  key={card.id}
                  onClick={() => toggleSelect(card.id)}
                  className={`block cursor-pointer rounded-xl border p-3.5 transition select-none ${
                    isChecked
                      ? "border-amber-600/60 bg-amber-950/25"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="pt-0.5">
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                          isChecked
                            ? "border-amber-400 bg-amber-500 text-slate-950"
                            : "border-slate-700 bg-slate-900"
                        }`}
                      >
                        {isChecked && <CheckIcon size={11} />}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-indigo-300">
                          📚 {courseName} &gt; {lectureName}
                        </span>
                        <span className="rounded-full border border-rose-800/60 bg-rose-950/80 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-300">
                          推定想起確率 R: {rPercent}%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/80 p-2">
                          <span className="block text-[10px] text-slate-500">表面 (問題)</span>
                          <p className="line-clamp-2 text-slate-100">{card.front}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/80 p-2">
                          <span className="block text-[10px] text-slate-500">裏面 (解答)</span>
                          <p className="line-clamp-2 text-slate-300">{card.back}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

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
