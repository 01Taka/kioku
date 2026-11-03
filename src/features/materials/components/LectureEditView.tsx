import { useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import { type Card, FlashcardContentSchema } from "../../types/schema";
import { AiBatchImportModal } from "../AiBatchImportModal";
import {
  ArrowLeftIcon,
  EditIcon,
  MoreVerticalIcon,
  PauseIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UndoIcon,
} from "../icons";
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
  const { cards, addCard, updateCard, deleteCard, setCardPhase, toggleCardSuspension } =
    useAppStore();

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
    const result = FlashcardContentSchema.safeParse({
      question: singleFront,
      answer: singleBack,
    });
    if (!result.success) return;
    addCard(courseId, lectureId, result.data.question, result.data.answer);
    setSingleFront("");
    setSingleBack("");
    setIsAddingSingle(false);
  };

  return (
    <div className="space-y-5">
      {/* 戻るボタン & 講義名 */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="講義リストへ戻る"
        >
          <ArrowLeftIcon size={16} />
        </button>

        <h2 className="truncate text-sm font-bold text-white">
          講義の編集: {lectureName} ({lectureCards.length}枚)
        </h2>
      </div>

      {/* 上部: カードの一括取り込みボタン */}
      <div>
        <button
          type="button"
          onClick={() => setIsAiModalOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500"
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
          className="flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          <PlusIcon size={15} />
          <span>{isAddingSingle ? "入力フォームを閉じる" : "1枚ずつ追加"}</span>
        </button>

        {isAddingSingle && (
          <form
            onSubmit={handleAddSingleCard}
            className="animate-fadeIn mt-3 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  表面（問題）
                </label>
                <textarea
                  rows={3}
                  value={singleFront}
                  onChange={(e) => setSingleFront(e.target.value)}
                  placeholder="問題文を入力"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-2 text-base text-white outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  裏面（解答）
                </label>
                <textarea
                  rows={3}
                  value={singleBack}
                  onChange={(e) => setSingleBack(e.target.value)}
                  placeholder="解答を入力"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-2 text-base text-white outline-none focus:border-indigo-500"
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
                className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                追加する
              </button>
            </div>
          </form>
        )}
      </div>

      {/* その下に: 問題リスト */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-slate-300">
          登録カード一覧 ({lectureCards.length}枚)
        </span>

        {lectureCards.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
            <p className="text-xs text-slate-400">カードがまだ登録されていません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lectureCards.map((card, idx) => {
              const phase = card.lecturePool.phase;
              return (
                <div
                  key={card.id}
                  className={`relative flex items-start justify-between gap-3 rounded-xl border bg-slate-900/80 p-3.5 transition ${
                    card.isSuspended
                      ? "border-rose-900/40 opacity-60"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-slate-500">#{idx + 1}</span>

                      {/* フェーズバッジ */}
                      {phase === "UNATTEMPTED" && (
                        <span className="py-0.2 rounded-full border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300">
                          未実施
                        </span>
                      )}
                      {phase === "UNGRADUATED" && (
                        <span className="py-0.2 rounded-full border border-amber-800/60 bg-amber-950/60 px-2 text-[10px] text-amber-300">
                          未卒業 ({card.lecturePool.consecutiveCorrect}連勝)
                        </span>
                      )}
                      {phase === "GRADUATION_RECOMMENDED" && (
                        <span className="py-0.2 rounded-full border border-cyan-800/60 bg-cyan-950/60 px-2 text-[10px] font-bold text-cyan-300">
                          🎓 卒業推奨 ({card.lecturePool.consecutiveCorrect}連勝)
                        </span>
                      )}
                      {phase === "GRADUATED" && (
                        <span className="py-0.2 rounded-full border border-emerald-800/60 bg-emerald-950/60 px-2 text-[10px] text-emerald-300">
                          卒業済
                        </span>
                      )}

                      {card.isSuspended && (
                        <span className="py-0.2 rounded-full border border-rose-800/60 bg-rose-950/60 px-2 text-[10px] text-rose-300">
                          休止中
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium whitespace-pre-wrap text-slate-100">
                      {card.front}
                    </p>
                    <p className="text-xs whitespace-pre-wrap text-slate-400">{card.back}</p>
                  </div>

                  {/* 問題リストの右側に三点リーダー配置 */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuCardId((prev) => (prev === card.id ? null : card.id))
                      }
                      className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
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
                        <div className="animate-fadeIn absolute top-8 right-0 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900 py-1 text-xs text-slate-200 shadow-2xl">
                          {/* カードを編集 */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              setEditingCard(card);
                            }}
                            className="flex w-full cursor-pointer items-center space-x-2 px-3 py-2 text-left hover:bg-slate-800"
                          >
                            <EditIcon size={13} className="text-indigo-400" />
                            <span>カードを編集</span>
                          </button>

                          {/* カードを卒業（既に卒業済みならdisabled） */}
                          <button
                            type="button"
                            disabled={phase === "GRADUATED"}
                            onClick={() => {
                              setOpenMenuCardId(null);
                              setCardPhase(card.id, "GRADUATED");
                            }}
                            className={`flex w-full items-center space-x-2 px-3 py-2 text-left ${
                              phase === "GRADUATED"
                                ? "cursor-not-allowed text-slate-500 opacity-40"
                                : "cursor-pointer text-emerald-400 hover:bg-slate-800"
                            }`}
                            title={
                              phase === "GRADUATED" ? "既に卒業済みです" : "共通プールへ卒業させる"
                            }
                          >
                            <span className="text-[13px]">🎓</span>
                            <span>{phase === "GRADUATED" ? "卒業済み" : "カードを卒業"}</span>
                          </button>

                          {/* カードを休止 / 再開 */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              toggleCardSuspension(card.id);
                            }}
                            className="flex w-full cursor-pointer items-center space-x-2 px-3 py-2 text-left hover:bg-slate-800"
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
                            className="flex w-full cursor-pointer items-center space-x-2 px-3 py-2 text-left hover:bg-slate-800"
                          >
                            <UndoIcon size={13} className="text-cyan-400" />
                            <span>状態をリセット</span>
                          </button>

                          <div className="my-1 border-t border-slate-800" />

                          {/* カードを削除 */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCardId(null);
                              if (window.confirm("このカードを削除しますか？")) {
                                deleteCard(card.id);
                              }
                            }}
                            className="flex w-full cursor-pointer items-center space-x-2 px-3 py-2 text-left text-rose-300 hover:bg-rose-950/60"
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
