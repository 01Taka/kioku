import { CheckIcon, PlayIcon, UndoIcon, XIcon } from "../icons";
import type { PracticeCardItem } from "./LecturePlayer";

export interface PracticeResultViewProps {
  /** 解いた問題・講義名 */
  title: string;
  /** 全問題数 */
  totalCount: number;
  /** 正解数 */
  correctCount: number;
  /** 不正解カード一覧 */
  incorrectCards: PracticeCardItem[];
  /** 正解カード一覧（教材チェック時は卒業対象以外の正解カード） */
  correctCards: PracticeCardItem[];
  /** 卒業対象カード一覧（教材チェック時のみ存在） */
  graduationCards?: PracticeCardItem[];
  /** 卒業対象として選択されているカードIDセット */
  selectedGraduationIds?: Set<string>;
  /** 卒業対象の選択トグル関数 */
  onToggleGraduationId?: (cardId: string) => void;
  /** メインアクションボタン（「次の10問」「2周目開始」「別講義チェック開始」「完了」など） */
  mainAction?: {
    label: string;
    onClick: () => void;
    isComplete?: boolean;
  };
  /** 「n問を復習」押下時のコールバック */
  onReviewMistakes?: () => void;
  /** 画面を閉じる */
  onClose: () => void;
}

export function PracticeResultView({
  title,
  totalCount,
  correctCount,
  incorrectCards,
  correctCards,
  graduationCards,
  selectedGraduationIds,
  onToggleGraduationId,
  mainAction,
  onReviewMistakes,
  onClose,
}: PracticeResultViewProps) {
  const hasGraduation = Boolean(graduationCards && graduationCards.length > 0);
  const selectedGraduationCount = selectedGraduationIds ? selectedGraduationIds.size : 0;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md select-none">
      {/* ① 上部ヘッダー（固定）: 解いた問題のみ表示 */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <h2 className="max-w-md truncate text-sm font-bold text-white sm:text-base">{title}</h2>

        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="閉じる"
        >
          <XIcon size={18} />
        </button>
      </header>

      {/* スクロール領域 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* ② メイン画面上部: 大きく n / m */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-center">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              結果
            </span>
            <div className="mt-1 font-mono text-5xl font-black tracking-tight text-white sm:text-6xl">
              <span className="text-emerald-400">{correctCount}</span>
              <span className="mx-2 text-slate-600">/</span>
              <span>{totalCount}</span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-400">正解率 {accuracy}%</p>

            {/* ③ その下にメインボタンを配置 */}
            {mainAction && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={mainAction.onClick}
                  className={`flex w-full max-w-sm cursor-pointer items-center justify-center space-x-2 rounded-xl py-3.5 text-xs font-bold text-white shadow-lg transition sm:text-sm ${
                    mainAction.isComplete
                      ? "bg-slate-800 shadow-slate-900/50 hover:bg-slate-700"
                      : "bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500"
                  }`}
                >
                  {!mainAction.isComplete && <PlayIcon size={15} />}
                  <span>{mainAction.label}</span>
                </button>
              </div>
            )}
          </div>

          {/* ④ セクション1: わからなかった（n） */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200">
                わからなかった（{incorrectCards.length}）
              </h3>

              {incorrectCards.length > 0 && onReviewMistakes && (
                <button
                  type="button"
                  onClick={onReviewMistakes}
                  className="flex cursor-pointer items-center space-x-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-500"
                >
                  <UndoIcon size={12} />
                  <span>{incorrectCards.length}問を復習</span>
                </button>
              )}
            </div>

            {incorrectCards.length === 0 ? (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
                間違えた問題はありません 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {incorrectCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className="rounded-xl border border-rose-950/60 bg-rose-950/20 p-3.5 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="font-mono text-slate-500">Q{idx + 1}.</span>
                        <span className="py-0.2 rounded-full border border-rose-800/80 bg-rose-950/80 px-2 text-[10px] font-bold text-rose-300">
                          ❌ 不正解
                        </span>
                        {card.badge && <span className="text-slate-400">({card.badge})</span>}
                      </div>

                      <p className="text-xs font-semibold whitespace-pre-wrap text-slate-100">
                        {card.front}
                      </p>

                      <div className="mt-1.5 rounded-lg border border-slate-800/80 bg-slate-900/70 p-2">
                        <span className="mb-0.5 block text-[10px] font-bold text-slate-400">
                          正解・解説
                        </span>
                        <p className="text-xs whitespace-pre-wrap text-emerald-300">{card.back}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ⑤ セクション2: 卒業（x）★教材のチェックに限り、卒業した問題がある場合 */}
          {hasGraduation && graduationCards && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-400">
                  卒業（{selectedGraduationCount}）
                </h3>

                {onToggleGraduationId && (
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = selectedGraduationCount === graduationCards.length;
                      graduationCards.forEach((c) => {
                        const isCurrentlySelected = selectedGraduationIds?.has(c.id);
                        if (allSelected && isCurrentlySelected) {
                          onToggleGraduationId(c.id);
                        } else if (!allSelected && !isCurrentlySelected) {
                          onToggleGraduationId(c.id);
                        }
                      });
                    }}
                    className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {selectedGraduationCount === graduationCards.length
                      ? "全選択解除"
                      : "すべて選択"}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {graduationCards.map((card, idx) => {
                  const isSelected = selectedGraduationIds?.has(card.id) ?? false;
                  return (
                    <div
                      key={card.id}
                      onClick={() => onToggleGraduationId?.(card.id)}
                      className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition ${
                        isSelected
                          ? "border-emerald-500/80 bg-emerald-950/30 hover:border-emerald-400"
                          : "border-slate-800 bg-slate-900/60 opacity-60 hover:opacity-90"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="pt-0.5">
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-600 bg-slate-800 text-transparent"
                            }`}
                          >
                            <CheckIcon size={12} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-[11px]">
                            <span className="font-mono text-slate-500">#{idx + 1}</span>
                            <span className="py-0.2 rounded-full border border-emerald-800/80 bg-emerald-950/80 px-2 text-[10px] font-bold text-emerald-300">
                              🎓 卒業対象
                            </span>
                            {card.badge && <span className="text-slate-400">({card.badge})</span>}
                          </div>

                          <p className="text-xs font-semibold whitespace-pre-wrap text-slate-100">
                            {card.front}
                          </p>
                          <p className="text-xs whitespace-pre-wrap text-slate-400">{card.back}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ⑥ セクション3: わかった（m） */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-200">わかった（{correctCards.length}）</h3>

            {correctCards.length === 0 ? (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
                正解した問題はありません
              </div>
            ) : (
              <div className="space-y-2">
                {correctCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="font-mono text-slate-500">Q{idx + 1}.</span>
                        <span className="py-0.2 rounded-full border border-emerald-800/80 bg-emerald-950/80 px-2 text-[10px] font-bold text-emerald-300">
                          ⭕ 正解
                        </span>
                        {card.badge && <span className="text-slate-400">({card.badge})</span>}
                      </div>

                      <p className="text-xs font-semibold whitespace-pre-wrap text-slate-100">
                        {card.front}
                      </p>
                      <p className="text-xs whitespace-pre-wrap text-slate-400">{card.back}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
