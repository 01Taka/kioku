import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { Card } from "../../types/schema";
import {
  SparklesIcon,
  PlusIcon,
  MoreVerticalIcon,
  EditIcon,
  PauseIcon,
  UndoIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "../icons";
import { AiBatchImportModal } from "../AiBatchImportModal";
import { CardEditModal } from "./CardEditModal";

interface LectureEditViewProps {
  courseId: string;
  courseName: string;
  lectureId: string;
  lectureName: string;
  onBack: () => void;
}

export function LectureEditView({
  courseId,
  lectureId,
  lectureName,
  onBack,
}: LectureEditViewProps) {
  const {
    cards,
    addCard,
    updateCard,
    deleteCard,
    setCardPhase,
    toggleCardSuspension,
  } = useAppStore();

  const lectureCards = cards.filter((c) => c.lectureId === lectureId);

  // AI一括取り込みモーダル
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // 1枚ずつ追加アコーディオン
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [singleFront, setSingleFront] = useState("");
  const [singleBack, setSingleBack] = useState("");

  // カード編集モーダル状態
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  // 3点リーダー開閉管理 (cardId)
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);

  const handleAddSingleCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleFront.trim() || !singleBack.trim()) return;
    addCard(courseId, lectureId, singleFront.trim(), singleBack.trim());
    setSingleFront("");
    setSingleBack("");
    setIsAddingSingle(false);
  };

  return (
    <div className="space-y-5">
      {/* 戻るボタン & 講義名 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
        >
          <ArrowLeftIcon size={14} />
          <span>講義リストへ戻る</span>
        </button>

        <h2 className="text-sm font-bold text-white">
          講義の編集: {lectureName} ({lectureCards.length}枚)
        </h2>
      </div>

      {/* 上部: カードの一括取り込みボタン */}
      <div>
        <button
          type="button"
          onClick={() => setIsAiModalOpen(true)}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center justify-center space-x-2 transition cursor-pointer"
        >
          <SparklesIcon size={15} />
          <span>AI一括取り込み</span>
        </button>
      </div>

      {/* その下に: 1枚ずつ追加のボタン */}
      <div>
        <button
          type="button"
          onClick={() => setIsAddingSingle((prev) => !prev)}
          className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center space-x-1.5 transition cursor-pointer"
        >
          <PlusIcon size={15} />
          <span>{isAddingSingle ? "入力フォームを閉じる" : "1枚ずつ追加"}</span>
        </button>

        {isAddingSingle && (
          <form
            onSubmit={handleAddSingleCard}
            className="mt-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 animate-fadeIn"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  表面（問題）
                </label>
                <textarea
                  rows={3}
                  value={singleFront}
                  onChange={(e) => setSingleFront(e.target.value)}
                  placeholder="問題文を入力"
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 resize-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  裏面（解答）
                </label>
                <textarea
                  rows={3}
                  value={singleBack}
                  onChange={(e) => setSingleBack(e.target.value)}
                  placeholder="解答を入力"
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddingSingle(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!singleFront.trim() || !singleBack.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow cursor-pointer"
              >
                追加する
              </button>
            </div>
          </form>
        )}
      </div>

      {/* その下に: 問題リスト */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-300 block">
          登録カード一覧 ({lectureCards.length}枚)
        </span>

        {lectureCards.length === 0 ? (
          <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 text-center">
            <p className="text-xs text-slate-400">カードがまだ登録されていません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lectureCards.map((card, idx) => {
              const phase = card.lecturePool.phase;
              return (
                <div
                  key={card.id}
                  className={`p-3.5 bg-slate-900/80 border rounded-xl flex items-start justify-between gap-3 relative transition ${
                    card.isSuspended
                      ? "border-rose-900/40 opacity-60"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>

                      {/* フェーズバッジ */}
                      {phase === "UNATTEMPTED" && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          未実施
                        </span>
                      )}
                      {phase === "UNGRADUATED" && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          未卒業 ({card.lecturePool.consecutiveCorrect}連勝)
                        </span>
                      )}
                      {phase === "GRADUATION_RECOMMENDED" && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-bold">
                          🎓 卒業推奨 ({card.lecturePool.consecutiveCorrect}連勝)
                        </span>
                      )}
                      {phase === "GRADUATED" && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                          卒業済
                        </span>
                      )}

                      {card.isSuspended && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/60">
                          休止中
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-slate-100 whitespace-pre-wrap">
                      {card.front}
                    </p>
                    <p className="text-xs text-slate-400 whitespace-pre-wrap">
                      {card.back}
                    </p>
                  </div>

                  {/* 問題リストの右側に三点リーダー配置 */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuCardId((prev) => (prev === card.id ? null : card.id))
                      }
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      title="メニューを開く"
                    >
                      <MoreVerticalIcon size={16} />
                    </button>

                    {/* 三点リーダードロップダウンメニュー */}
                    {openMenuCardId === card.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuCardId(null)}
                        />
                        <div className="absolute right-0 top-8 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-200 animate-fadeIn">
                          {/* カードを編集 */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              setEditingCard(card);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                          >
                            <EditIcon size={13} className="text-indigo-400" />
                            <span>カードを編集</span>
                          </button>

                          {/* カードを休止 / 再開 */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              toggleCardSuspension(card.id);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                          >
                            <PauseIcon size={13} className="text-amber-400" />
                            <span>{card.isSuspended ? "カードを再開" : "カードを休止"}</span>
                          </button>

                          {/* 状態をリセット */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              if (
                                window.confirm(
                                  "このカードの学習履歴を完全初期状態（未実施）にリセットしますか？",
                                )
                              ) {
                                setCardPhase(card.id, "UNATTEMPTED");
                              }
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                          >
                            <UndoIcon size={13} className="text-cyan-400" />
                            <span>状態をリセット</span>
                          </button>

                          <div className="border-t border-slate-800 my-1" />

                          {/* カードを削除 */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              if (window.confirm("このカードを削除しますか？")) {
                                deleteCard(card.id);
                              }
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-rose-950/60 text-rose-300 flex items-center space-x-2 cursor-pointer"
                          >
                            <TrashIcon size={13} className="text-rose-400" />
                            <span>カードを削除</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI一括取り込みモーダル */}
      {isAiModalOpen && (
        <AiBatchImportModal
          courseId={courseId}
          lectureId={lectureId}
          lectureName={lectureName}
          initialText=""
          onClose={() => setIsAiModalOpen(false)}
          onSuccess={() => setIsAiModalOpen(false)}
        />
      )}

      {/* カード編集モーダル */}
      {editingCard && (
        <CardEditModal
          initialFront={editingCard.front}
          initialBack={editingCard.back}
          onSave={(front, back) => {
            updateCard(editingCard.id, { front, back });
            setEditingCard(null);
          }}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
