import { useState, useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";
import { LecturePlayer, type PracticeCardItem } from "../practice/LecturePlayer";
import { XIcon, CheckIcon, UndoIcon, PlayIcon } from "../icons";

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
  const [testingCards, setTestingCards] = useState<PracticeCardItem[] | null>(
    null,
  );

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
    setStatusMessage(
      `✅ 全 ${count} 枚のカードを所属講義プール（未暗記）へ戻しました。`,
    );
  };

  // アクション2: 選択して講義プールに戻す
  const handleDemoteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const count = batchDemoteToLecturePool(ids);
    setSelectedIds(new Set());
    setStatusMessage(
      `✅ 選択した ${count} 枚のカードを所属講義プール（未暗記）へ戻しました。`,
    );
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
          answerRecoveryTestCard(
            cardId,
            result === "correct" ? "GOOD" : "AGAIN",
          );
        }}
        onFinish={(results) => {
          const recovered = Object.values(results).filter(
            (r) => r === "correct",
          ).length;
          const demoted = Object.values(results).filter(
            (r) => r === "incorrect",
          ).length;
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🏥</span>
              <h2 className="text-base font-bold text-white">
                リカバリー室（想起確率 R &lt; 35% 救済トリアージ）
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 font-mono">
                {recoveryCards.length} 枚
              </span>
            </div>
            <p className="text-xs text-slate-400">
              長期間放置されて記憶維持率（R）が35%未満に低下したカードです。日常復習を圧迫する場合は、ここでワンタップで所属講義のプールへ戻して再特訓できます。
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <XIcon size={18} />
          </button>
        </div>

        {statusMessage && (
          <div className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-xl py-2.5 px-3.5 flex items-center justify-between">
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
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                救済アクションを選択:
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium cursor-pointer"
              >
                {selectedIds.size === recoveryCards.length
                  ? "すべての選択を解除"
                  : `すべて選択 (${recoveryCards.length}枚)`}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {/* アクション1: すべて講義プールに戻す */}
              <button
                type="button"
                onClick={handleDemoteAll}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <UndoIcon size={13} className="text-amber-400" />
                <span>① すべて講義プールに戻す</span>
              </button>

              {/* アクション2: 選択して講義プールに戻す */}
              <button
                type="button"
                onClick={handleDemoteSelected}
                disabled={selectedIds.size === 0}
                className="p-2.5 bg-amber-600/90 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <UndoIcon size={13} />
                <span>② 選択分を講義に戻す ({selectedIds.size}枚)</span>
              </button>

              {/* アクション3: このまま共通プールでテストする */}
              <button
                type="button"
                onClick={handleStartRecoveryTest}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-md shadow-emerald-950/50 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                title="正解なら共通プール復帰、不正解なら講義プールへ即降格"
              >
                <PlayIcon size={12} />
                <span>
                  ③ 共通プールで救済テスト (
                  {selectedIds.size > 0
                    ? `${selectedIds.size}枚`
                    : `全${recoveryCards.length}枚`}
                  )
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 隔離カード一覧 */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {recoveryCards.length === 0 ? (
            <div className="py-12 text-center bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
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
                  className={`block p-3.5 rounded-xl border transition cursor-pointer select-none ${
                    isChecked
                      ? "bg-amber-950/25 border-amber-600/60"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                          isChecked
                            ? "bg-amber-500 border-amber-400 text-slate-950"
                            : "bg-slate-900 border-slate-700"
                        }`}
                      >
                        {isChecked && <CheckIcon size={11} />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-indigo-300 font-medium truncate">
                          📚 {courseName} &gt; {lectureName}
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60">
                          推定想起確率 R: {rPercent}%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block">
                            表面 (問題)
                          </span>
                          <p className="text-slate-100 line-clamp-2">{card.front}</p>
                        </div>
                        <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block">
                            裏面 (解答)
                          </span>
                          <p className="text-slate-300 line-clamp-2">{card.back}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

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
