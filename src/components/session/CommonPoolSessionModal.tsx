import { useCallback, useEffect, useRef, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import { REVIEW_CATEGORY_THEME } from "../../types/schema";
import { formatFutureDueNotice } from "../../utils/dateUtils";
import type { CommonPoolQueueItem } from "../../utils/queueBuilder";
import { UndoIcon, XIcon } from "../icons";
import { PracticeResultView } from "../practice/PracticeResultView";

export interface CommonPoolSessionModalProps {
  onClose: () => void;
  onOpenRecoveryRoom?: () => void;
}

type SlideAnimationState = "idle" | "slide-out-up" | "prepare-bottom" | "slide-in";

export function CommonPoolSessionModal({
  onClose,
  onOpenRecoveryRoom: _onOpenRecoveryRoom,
}: CommonPoolSessionModalProps) {
  const { getCommonPoolQueue, answerCommonPoolCard, batchDemoteToLecturePool } = useAppStore();

  // セッション開始時点の10問バッチスナップショット
  const [batchItems, setBatchItems] = useState<CommonPoolQueueItem[]>([]);
  const [earlyCount, setEarlyCount] = useState(0);
  const [farthestEarlyDueIso, setFarthestEarlyDueIso] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isBreakScreen, setIsBreakScreen] = useState(false);
  const [slideState, setSlideState] = useState<SlideAnimationState>("idle");
  const [batchAnswers, setBatchAnswers] = useState<Record<string, "GOOD" | "AGAIN">>({});
  const [_sessionStats, setSessionStats] = useState({
    goodCount: 0,
    againCount: 0,
    completedBatches: 0,
  });

  const transitionTimeoutRef = useRef<number | null>(null);

  const loadNextBatch = useCallback(() => {
    const queueResult = getCommonPoolQueue();
    setBatchItems(queueResult.sessionBatch);
    setEarlyCount(queueResult.earlyReviewCountInBatch);
    setFarthestEarlyDueIso(queueResult.farthestEarlyDueIso);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsBreakScreen(false);
    setBatchAnswers({});
    setSlideState("idle");
  }, [getCommonPoolQueue]);

  // 初回マウント時に10問バッチをロード
  useEffect(() => {
    loadNextBatch();
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [loadNextBatch]);

  const totalInBatch = batchItems.length;
  const currentItem = batchItems[currentIndex];

  const handleFlip = useCallback(() => {
    if (slideState !== "idle") return;
    setIsFlipped((prev) => !prev);
  }, [slideState]);

  const handleRate = useCallback(
    (rating: "AGAIN" | "GOOD") => {
      if (!currentItem || slideState !== "idle") return;

      // FSRS 計算・当日回答記録・オレンジフラグ更新
      answerCommonPoolCard(currentItem.card.id, rating);
      setBatchAnswers((prev) => ({ ...prev, [currentItem.card.id]: rating }));

      setSessionStats((prev) => ({
        ...prev,
        goodCount: rating === "GOOD" ? prev.goodCount + 1 : prev.goodCount,
        againCount: rating === "AGAIN" ? prev.againCount + 1 : prev.againCount,
        completedBatches:
          currentIndex + 1 >= totalInBatch ? prev.completedBatches + 1 : prev.completedBatches,
      }));

      // 10問（または端数バッチ）終了ならブレイク画面へ
      if (currentIndex + 1 >= totalInBatch) {
        setIsBreakScreen(true);
        return;
      }

      // スライドアウト ➔ 非表示中に表面へリセット ➔ 下からスライドイン
      setSlideState("slide-out-up");
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);

      transitionTimeoutRef.current = window.setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        setSlideState("prepare-bottom");

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSlideState("slide-in");
            transitionTimeoutRef.current = window.setTimeout(() => {
              setSlideState("idle");
            }, 200);
          });
        });
      }, 160);
    },
    [currentItem, slideState, answerCommonPoolCard, currentIndex, totalInBatch],
  );

  // セッション中の即時降格アクション（この問題を今すぐ所属講義の未暗記プールへ戻す）
  const handleInstantDemote = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentItem || slideState !== "idle") return;

      batchDemoteToLecturePool([currentItem.card.id]);

      setSessionStats((prev) => ({
        ...prev,
        againCount: prev.againCount + 1,
        completedBatches:
          currentIndex + 1 >= totalInBatch ? prev.completedBatches + 1 : prev.completedBatches,
      }));

      if (currentIndex + 1 >= totalInBatch) {
        setIsBreakScreen(true);
        return;
      }

      setSlideState("slide-out-up");
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);

      transitionTimeoutRef.current = window.setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        setSlideState("prepare-bottom");

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSlideState("slide-in");
            transitionTimeoutRef.current = window.setTimeout(() => {
              setSlideState("idle");
            }, 200);
          });
        });
      }, 160);
    },
    [currentItem, slideState, batchDemoteToLecturePool, currentIndex, totalInBatch],
  );

  // キーボード操作対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isBreakScreen || totalInBatch === 0) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      } else if (e.key === "ArrowRight" || e.key === "2") {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        } else {
          handleRate("GOOD");
        }
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        } else {
          handleRate("AGAIN");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBreakScreen, totalInBatch, isFlipped, handleFlip, handleRate, onClose]);

  const getSlideStyle = () => {
    switch (slideState) {
      case "slide-out-up":
        return {
          transform: "translateY(-48px)",
          opacity: 0,
          transition: "transform 0.16s ease-in, opacity 0.16s ease-in",
        };
      case "prepare-bottom":
        return {
          transform: "translateY(48px)",
          opacity: 0,
          transition: "none",
        };
      case "slide-in":
        return {
          transform: "translateY(0)",
          opacity: 1,
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out",
        };
      case "idle":
      default:
        return {
          transform: "translateY(0)",
          opacity: 1,
          transition: "none",
        };
    }
  };

  // 出題対象カードが0枚の場合
  if (totalInBatch === 0 && !isBreakScreen) {
    return (
      <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-800/60 bg-emerald-950/60 text-2xl">
            ✨
          </div>
          <h3 className="text-base font-bold text-white">
            本日の共通プール復習はすべて完了しています！
          </h3>
          <p className="text-xs leading-relaxed text-slate-400">
            現在出題可能なカードはありません。新しいカードを講義専用プールで特訓して卒業させるか、明日（午前04:00以降）の復習をお楽しみに！
          </p>
          <button
            onClick={onClose}
            className="w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            メイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // Task 3-3: 10問ごとのブレイク画面（休憩・振り返り・継続選択）
  if (isBreakScreen) {
    const nextQueuePreview = getCommonPoolQueue();
    const nextAvailableCount = nextQueuePreview.sessionBatch.length;

    const incorrectItems = batchItems.filter((i) => batchAnswers[i.card.id] === "AGAIN");
    const correctItems = batchItems.filter((i) => batchAnswers[i.card.id] === "GOOD");

    const incorrectCards = incorrectItems.map((item) => ({
      id: item.card.id,
      front: item.card.front,
      back: item.card.back,
      badge:
        item.reviewCategory === "RETRY"
          ? "🔁 リトライ"
          : item.reviewCategory === "DUE"
            ? "⭕ 本日期日"
            : "⏩ 先取り",
    }));

    const correctCards = correctItems.map((item) => ({
      id: item.card.id,
      front: item.card.front,
      back: item.card.back,
      badge:
        item.reviewCategory === "RETRY"
          ? "🔁 リトライ"
          : item.reviewCategory === "DUE"
            ? "⭕ 本日期日"
            : "⏩ 先取り",
    }));

    const handleReviewMistakes = () => {
      if (incorrectItems.length === 0) return;
      setBatchItems(incorrectItems);
      setCurrentIndex(0);
      setIsFlipped(false);
      setBatchAnswers({});
      setIsBreakScreen(false);
      setSlideState("idle");
    };

    return (
      <PracticeResultView
        title="本日の復習 (共通プール)"
        totalCount={batchItems.length}
        correctCount={correctCards.length}
        incorrectCards={incorrectCards}
        correctCards={correctCards}
        mainAction={
          nextAvailableCount > 0
            ? {
                label: "次の10問",
                onClick: loadNextBatch,
              }
            : {
                label: "完了",
                isComplete: true,
                onClick: onClose,
              }
        }
        onReviewMistakes={incorrectCards.length > 0 ? handleReviewMistakes : undefined}
        onClose={onClose}
      />
    );
  }

  const categoryTheme = REVIEW_CATEGORY_THEME[currentItem.reviewCategory];
  const futureNotice =
    earlyCount > 0 && farthestEarlyDueIso ? formatFutureDueNotice(farthestEarlyDueIso) : null;

  const badgeColorClass =
    currentItem.reviewCategory === "RETRY"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
      : currentItem.reviewCategory === "DUE"
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
        : "bg-purple-500/15 text-purple-300 border-purple-500/40";

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md select-none">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            🎯 共通プール復習 (FSRS)
          </span>

          {/* 3色カラーバッジ */}
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeColorClass}`}
          >
            {categoryTheme.icon} {categoryTheme.label}
            {currentItem.reviewCategory === "DUE" && currentItem.isOverdue ? "（期限切れ）" : ""}
          </span>

          {/* 優先度バッジ */}
          {currentItem.effectivePriority === "FORCE" && (
            <span className="rounded border border-rose-700/60 bg-rose-950/80 px-2 py-0.5 text-[11px] font-bold text-rose-300">
              🔥 強制出題
            </span>
          )}
          {currentItem.effectivePriority === "PRIORITY" && (
            <span className="rounded border border-indigo-700/60 bg-indigo-950/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
              ★ 優先
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <span className="font-mono text-xs text-slate-400">
            {currentIndex + 1} / {totalInBatch}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="セッションを中断して戻る (Esc)"
          >
            <XIcon size={18} />
          </button>
        </div>
      </header>

      {/* プログレスバー */}
      <div className="h-1 w-full bg-slate-800">
        <div
          className="h-1 bg-emerald-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalInBatch) * 100}%` }}
        />
      </div>

      {/* パープル（先取り）カード含有時の事前案内バナー */}
      {futureNotice && (
        <div className="border-b border-purple-800/40 bg-purple-950/40 px-4 py-1.5 text-center text-[11px] text-purple-200">
          ⚡ 本セッションには、最長で【{futureNotice.dateLabel}（あと
          {futureNotice.daysAhead}日後）】に復習予定の先取りカードが {earlyCount} 枚含まれます
        </div>
      )}

      {/* メインカード領域 */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-4 sm:p-6">
        {/* 所属パンくず & 推定想起確率 */}
        <div className="mb-3 flex w-full items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-medium text-indigo-300">
            📚 {currentItem.courseName} &gt; {currentItem.lectureName}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-slate-400">
            記憶維持率 R: {Math.round(currentItem.retrievability * 100)}%
          </span>
        </div>

        {/* スライドイン・アウト用ラッパー */}
        <div
          className="h-80 max-h-120 min-h-80 w-full will-change-transform sm:h-88"
          style={getSlideStyle()}
        >
          <div className="h-full w-full" style={{ perspective: "1000px" }}>
            <div
              onClick={handleFlip}
              className="relative h-full w-full cursor-pointer"
              style={{
                transformStyle: "preserve-3d",
                transition: slideState === "idle" ? "transform 0.35s ease-in-out" : "none",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* 表面（問題） */}
              <div
                className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl transition-colors hover:border-slate-700"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(0deg) translateZ(1px)",
                }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    表面（問題）
                  </span>
                  <span className="font-mono text-[11px] text-emerald-400">
                    Q.{currentIndex + 1}
                  </span>
                </div>

                <div className="my-auto flex max-h-56 items-center justify-center overflow-y-auto py-4">
                  <p
                    className={`leading-relaxed font-bold whitespace-pre-wrap text-white select-text ${
                      currentItem.card.front.length > 70 ||
                      currentItem.card.front.split("\n").length >= 3
                        ? "w-full px-2 text-left text-base sm:text-lg"
                        : "text-center text-xl sm:text-2xl"
                    }`}
                  >
                    {currentItem.card.front}
                  </p>
                </div>

                <div className="text-center text-[11px] text-slate-500">タップして解答を表示</div>
              </div>

              {/* 裏面（解答） */}
              <div
                className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-emerald-500/50 bg-slate-900 bg-linear-to-b from-slate-900 to-emerald-950 p-7 shadow-2xl transition-colors hover:border-emerald-500/70"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg) translateZ(1px)",
                }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-semibold tracking-wider text-emerald-300 uppercase">
                    裏面（解答）
                  </span>

                  <div className="flex items-center space-x-2">
                    {/* 即時講義プール降格ボタン */}
                    <button
                      type="button"
                      onClick={handleInstantDemote}
                      className="flex cursor-pointer items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-amber-600/60 hover:bg-amber-900/80 hover:text-amber-200"
                      title="このカードのFSRS履歴をリセットし、今すぐ所属講義の未暗記プールへ戻して次の問題へ進む"
                    >
                      <UndoIcon size={10} />
                      <span>講義プールへ戻す</span>
                    </button>
                    <span className="font-mono text-[11px] text-emerald-400">
                      A.{currentIndex + 1}
                    </span>
                  </div>
                </div>

                <div className="my-auto flex max-h-56 items-center justify-center overflow-y-auto py-4">
                  <p
                    className={`leading-relaxed font-medium whitespace-pre-wrap text-slate-100 select-text ${
                      currentItem.card.back.length > 70 ||
                      currentItem.card.back.split("\n").length >= 3
                        ? "w-full px-2 text-left text-sm sm:text-base"
                        : "text-center text-lg sm:text-xl"
                    }`}
                  >
                    {currentItem.card.back}
                  </p>
                </div>

                <div className="text-center text-[11px] text-emerald-400/80">
                  タップして問題面に戻す
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2ボタン操作（表のときは「解答を表示」、裏のときは「Again / Good」） */}
        <div className="mt-6 h-13 w-full">
          {!isFlipped ? (
            <button
              type="button"
              onClick={handleFlip}
              disabled={slideState !== "idle"}
              className="flex h-full w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
            >
              <span>解答を表示</span>
            </button>
          ) : (
            <div className="grid h-full w-full grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => handleRate("AGAIN")}
                disabled={slideState !== "idle"}
                className="flex h-full w-full cursor-pointer items-center justify-center space-x-2 rounded-xl border border-rose-800/80 bg-rose-950/60 text-sm font-bold text-rose-300 shadow-lg shadow-rose-950/40 transition hover:bg-rose-900/80 disabled:opacity-60"
                title="不正解: 翌日の最優先リベンジ枠へ (← / 1)"
              >
                <span>❌ もう一度 (Again)</span>
              </button>

              <button
                type="button"
                onClick={() => handleRate("GOOD")}
                disabled={slideState !== "idle"}
                className="flex h-full w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-60"
                title="正解: FSRSで次回復習日を延長 (→ / 2)"
              >
                <span>⭕ 正解 (Good)</span>
              </button>
            </div>
          )}
        </div>

        {/* キー操作ガイド */}
        <div className="mt-5 hidden text-center text-[11px] text-slate-500 sm:block">
          {!isFlipped ? (
            <span>
              キー操作:{" "}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Space</kbd> /{" "}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">←</kbd> /{" "}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">→</kbd> 解答を表示
            </span>
          ) : (
            <span>
              キー操作:{" "}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Space</kbd>{" "}
              問題に戻す /{" "}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">←</kbd> もう一度
              (Again) / <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">→</kbd>{" "}
              正解 (Good)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
