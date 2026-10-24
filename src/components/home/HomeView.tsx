import { useCallback, useMemo, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import { PlayIcon, UndoIcon } from "../icons";
import type { HomeSubTab } from "../navigation/AppNavigation";
import type { PracticeCardItem } from "../practice/LecturePlayer";
import { LecturePlayer } from "../practice/LecturePlayer";
import { HomeMainStartModal } from "./HomeMainStartModal";
import { HomeMistakesStartModal } from "./HomeMistakesStartModal";

interface HomeViewProps {
  activeSubTab: HomeSubTab;
  onSelectSubTab: (subTab: HomeSubTab) => void;
  onStartCommonSession: () => void;
}

export function HomeView({ activeSubTab, onSelectSubTab, onStartCommonSession }: HomeViewProps) {
  const { cards, courses, lectures, sessionState, getCommonPoolQueue, batchDemoteToLecturePool } =
    useAppStore();

  // モーダル開閉状態
  const [isMainStartModalOpen, setIsMainStartModalOpen] = useState(false);
  const [isMistakesStartModalOpen, setIsMistakesStartModalOpen] = useState(false);

  // ミス特訓プレイヤー状態
  const [practiceCards, setPracticeCards] = useState<PracticeCardItem[] | null>(null);
  // 現在ミスした状態のままで終わっているカードIDセット
  const [unresolvedMistakeIds, setUnresolvedMistakeIds] = useState<Set<string>>(new Set());

  // 忘れかけ: チェックボックス選択状態
  const [selectedForgottenIds, setSelectedForgottenIds] = useState<Set<string>>(new Set());

  // 1. 今日のミス問題リスト
  const mistakeCards = useMemo(() => {
    const mistakeSet = new Set(sessionState.todayMistakeCardIds);
    return cards.filter((c) => mistakeSet.has(c.id) && c.lecturePool.phase === "GRADUATED");
  }, [cards, sessionState.todayMistakeCardIds]);

  // 2. 忘れかけ（R < 0.35）問題リスト
  const recoveryItems = useMemo(() => {
    return getCommonPoolQueue().recoveryCards;
  }, [getCommonPoolQueue]);

  // 科目・講義マップ（所属パンくず用）
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses]);
  const lectureMap = useMemo(() => new Map(lectures.map((l) => [l.id, l.name])), [lectures]);

  // 今日のミス特訓開始ハンドラ
  const handleStartMistakesPractice = useCallback(
    (count: number | "ALL") => {
      const targetCards = count === "ALL" ? mistakeCards : mistakeCards.slice(0, count);
      if (targetCards.length === 0) return;

      // 初回開始時は、今回の対象カードを未解決ミスとして追跡開始
      setUnresolvedMistakeIds(new Set(targetCards.map((c) => c.id)));

      setPracticeCards(
        targetCards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          badge: c.commonPool?.consecutiveFailCount
            ? `⚠️ ${c.commonPool.consecutiveFailCount}連続ミス`
            : "今日のミス",
        })),
      );
    },
    [mistakeCards],
  );

  // 回答発生時に unresolvedMistakeIds を更新
  const handleAnswerMistakeCard = useCallback((cardId: string, result: "correct" | "incorrect") => {
    setUnresolvedMistakeIds((prev) => {
      const next = new Set(prev);
      if (result === "correct") {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  // 今日のミス結果画面のメインアクション算出
  const getMainActionForMistakes = useCallback(() => {
    if (!practiceCards) return undefined;

    // ミスした状態で終わっているカードがある場合
    if (unresolvedMistakeIds.size > 0) {
      const remainingCards = cards.filter((c) => unresolvedMistakeIds.has(c.id));
      const count = Math.min(10, remainingCards.length);
      const batchCards = remainingCards.slice(0, 10);

      return {
        label: count === 10 ? "次の10問" : `次の${count}問`,
        onClick: () => {
          setPracticeCards(
            batchCards.map((c) => ({
              id: c.id,
              front: c.front,
              back: c.back,
              badge: "未解決のミス",
            })),
          );
        },
      };
    }

    // ミスした状態で終わっているカードがない場合 -> 2周目開始（10問）
    const batchCards = mistakeCards.slice(0, 10);
    return {
      label: "2周目開始（10問）",
      onClick: () => {
        setUnresolvedMistakeIds(new Set(batchCards.map((c) => c.id)));
        setPracticeCards(
          batchCards.map((c) => ({
            id: c.id,
            front: c.front,
            back: c.back,
            badge: "2周目",
          })),
        );
      },
    };
  }, [practiceCards, unresolvedMistakeIds, cards, mistakeCards]);

  // 忘れかけ: 除外（講義プールへの降格）ハンドラ
  const handleDemoteForgotten = (all: boolean) => {
    const idsToDemote = all
      ? recoveryItems.map((r) => r.card.id)
      : Array.from(selectedForgottenIds);

    if (idsToDemote.length === 0) return;

    const count = batchDemoteToLecturePool(idsToDemote);
    setSelectedForgottenIds(new Set());
    alert(`🏥 ${count} 枚のカードを所属講義プール（未卒業・連続正解0）に戻しました。`);
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-950 select-none">
      {/* スマホ版: 上部タブナビゲーション（画面幅全体を等間隔で配置） */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900/80 pt-2.5 md:hidden">
        <button
          type="button"
          onClick={() => onSelectSubTab("MAIN")}
          className={`flex cursor-pointer items-center justify-center border-b-2 pb-2.5 text-xs font-semibold transition ${
            activeSubTab === "MAIN"
              ? "border-indigo-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>メイン</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSubTab("MISTAKES")}
          className={`flex cursor-pointer items-center justify-center space-x-1 border-b-2 pb-2.5 text-xs font-semibold transition ${
            activeSubTab === "MISTAKES"
              ? "border-amber-500 text-amber-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>今日のミス</span>
          {mistakeCards.length > 0 && (
            <span className="py-0.2 rounded-full bg-amber-500/20 px-1.5 font-mono text-[10px] text-amber-300">
              {mistakeCards.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectSubTab("FORGOTTEN")}
          className={`flex cursor-pointer items-center justify-center space-x-1 border-b-2 pb-2.5 text-xs font-semibold transition ${
            activeSubTab === "FORGOTTEN"
              ? "border-rose-500 text-rose-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>忘れかけ</span>
          {recoveryItems.length > 0 && (
            <span className="py-0.2 rounded-full bg-rose-500/20 px-1.5 font-mono text-[10px] text-rose-300">
              {recoveryItems.length}
            </span>
          )}
        </button>
      </div>

      {/* サブタブ別コンテンツ表示 */}
      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ======================================================== */}
        {/* 1. ホーム / メイン */}
        {/* ======================================================== */}
        {activeSubTab === "MAIN" && (
          <div>
            {/* 画面上部: 「はじめる」ボタンのみ */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setIsMainStartModalOpen(true)}
                className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 sm:w-auto"
              >
                <PlayIcon size={16} />
                <span>はじめる</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. ホーム / 今日のミス */}
        {/* ======================================================== */}
        {activeSubTab === "MISTAKES" && (
          <div className="space-y-4">
            {/* 画面上部: 「はじめる」ボタン */}
            <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setIsMistakesStartModalOpen(true)}
                disabled={mistakeCards.length === 0}
                className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-600/30 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <PlayIcon size={16} />
                <span>はじめる ({mistakeCards.length}問)</span>
              </button>

              <span className="font-mono text-xs text-slate-400">
                本日間違えた問題: {mistakeCards.length} 件
              </span>
            </div>

            {/* 問題リスト */}
            {mistakeCards.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
                <p className="text-xs text-slate-400">本日間違えた問題はありません 🎉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mistakeCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 transition hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate font-medium text-indigo-300">
                        📚 {courseMap.get(card.courseId) || "科目"} &gt;{" "}
                        {lectureMap.get(card.lectureId) || "講義"}
                      </span>
                      {card.commonPool?.consecutiveFailCount ? (
                        <span className="shrink-0 rounded-full border border-rose-800/60 bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                          ⚠️ {card.commonPool.consecutiveFailCount}連続ミス
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs font-medium whitespace-pre-wrap text-slate-100">
                      <span className="mr-1.5 font-mono text-slate-500">Q{idx + 1}.</span>
                      {card.front}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. ホーム / 忘れかけ */}
        {/* ======================================================== */}
        {activeSubTab === "FORGOTTEN" && (
          <div className="space-y-4">
            {/* 画面上部: アクションボタン */}
            <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {selectedForgottenIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => handleDemoteForgotten(false)}
                  className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-500 sm:w-auto"
                >
                  <UndoIcon size={16} />
                  <span>選択した問題を除外 ({selectedForgottenIds.size}件)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDemoteForgotten(true)}
                  disabled={recoveryItems.length === 0}
                  className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-rose-950 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  <UndoIcon size={16} />
                  <span>すべて除外 ({recoveryItems.length}件)</span>
                </button>
              )}

              {recoveryItems.length > 0 && (
                <div className="flex w-full justify-end sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedForgottenIds.size === recoveryItems.length) {
                        setSelectedForgottenIds(new Set());
                      } else {
                        setSelectedForgottenIds(new Set(recoveryItems.map((r) => r.card.id)));
                      }
                    }}
                    className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {selectedForgottenIds.size === recoveryItems.length ? "選択解除" : "全選択"}
                  </button>
                </div>
              )}
            </div>

            {/* 忘れかけ問題リスト */}
            {recoveryItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
                <p className="text-xs text-slate-400">
                  現在、記憶維持率が35%未満に低下した問題はありません ✨
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recoveryItems.map(({ card, courseName, lectureName, retrievability }) => {
                  const isChecked = selectedForgottenIds.has(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        const next = new Set(selectedForgottenIds);
                        if (isChecked) {
                          next.delete(card.id);
                        } else {
                          next.add(card.id);
                        }
                        setSelectedForgottenIds(next);
                      }}
                      className={`flex cursor-pointer items-start space-x-3 rounded-xl border p-3.5 transition ${
                        isChecked
                          ? "border-indigo-500/60 bg-indigo-950/40"
                          : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // 親divのクリックで処理
                        className="mt-1 cursor-pointer rounded accent-indigo-500"
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="min-w-0 truncate font-medium text-indigo-300">
                            📚 {courseName} &gt; {lectureName}
                          </span>
                          <span className="shrink-0 font-mono font-bold text-rose-400">
                            維持率 R: {Math.round(retrievability * 100)}%
                          </span>
                        </div>

                        <p className="text-xs font-medium whitespace-pre-wrap text-slate-100">
                          {card.front}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ホーム / メイン / はじめる モーダル */}
      {isMainStartModalOpen && (
        <HomeMainStartModal
          onClose={() => setIsMainStartModalOpen(false)}
          onStartSession={onStartCommonSession}
        />
      )}

      {/* ホーム / 今日のミス / はじめる モーダル */}
      {isMistakesStartModalOpen && (
        <HomeMistakesStartModal
          onClose={() => setIsMistakesStartModalOpen(false)}
          onStart={handleStartMistakesPractice}
          totalMistakes={mistakeCards.length}
        />
      )}

      {/* 今日のミス特訓プレイヤー */}
      {practiceCards && (
        <LecturePlayer
          lectureTitle="今日のミス問題集中特訓"
          mode="FREE_PRACTICE"
          cards={practiceCards}
          mainAction={getMainActionForMistakes()}
          onAnswer={handleAnswerMistakeCard}
          onClose={() => setPracticeCards(null)}
        />
      )}
    </div>
  );
}
