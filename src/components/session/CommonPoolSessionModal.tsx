import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { REVIEW_CATEGORY_THEME } from "../../types/schema";
import type { CommonPoolQueueItem } from "../../utils/queueBuilder";
import { formatFutureDueNotice } from "../../utils/dateUtils";
import { TodayMistakesSection } from "./TodayMistakesView";
import { XIcon, PlayIcon } from "../icons";

export interface CommonPoolSessionModalProps {
  onClose: () => void;
}

type SlideAnimationState =
  | "idle"
  | "slide-out-up"
  | "prepare-bottom"
  | "slide-in";

export function CommonPoolSessionModal({ onClose }: CommonPoolSessionModalProps) {
  const { getCommonPoolQueue, answerCommonPoolCard } = useAppStore();

  // セッション開始時点の10問バッチスナップショット
  const [batchItems, setBatchItems] = useState<CommonPoolQueueItem[]>([]);
  const [earlyCount, setEarlyCount] = useState(0);
  const [farthestEarlyDueIso, setFarthestEarlyDueIso] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isBreakScreen, setIsBreakScreen] = useState(false);
  const [slideState, setSlideState] = useState<SlideAnimationState>("idle");
  const [sessionStats, setSessionStats] = useState({
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

      setSessionStats((prev) => ({
        ...prev,
        goodCount: rating === "GOOD" ? prev.goodCount + 1 : prev.goodCount,
        againCount: rating === "AGAIN" ? prev.againCount + 1 : prev.againCount,
        completedBatches:
          currentIndex + 1 >= totalInBatch
            ? prev.completedBatches + 1
            : prev.completedBatches,
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
          transition:
            "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out",
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
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center mx-auto text-2xl">
            ✨
          </div>
          <h3 className="text-base font-bold text-white">
            本日の共通プール復習はすべて完了しています！
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            現在出題可能なカードはありません。新しいカードを講義専用プールで特訓して卒業させるか、明日（午前04:00以降）の復習をお楽しみに！
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-semibold transition cursor-pointer"
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
    const totalAnswered = sessionStats.goodCount + sessionStats.againCount;
    const goodRate =
      totalAnswered > 0 ? Math.round((sessionStats.goodCount / totalAnswered) * 100) : 0;

    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-auto">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">☕</span>
                <h2 className="text-lg font-bold text-white">
                  10問マイクロセッション完了！（ブレイク画面）
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                いつでもここで気持ちよく学習を終了できます。余力があれば次のセットへ進みましょう。
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <XIcon size={18} />
            </button>
          </div>

          {/* セッション統計サマリー */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 block">今回の累計回答</span>
              <strong className="text-lg font-mono text-white">{totalAnswered} 問</strong>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-emerald-400 block">⭕ Good (正解)</span>
              <strong className="text-lg font-mono text-emerald-300">
                {sessionStats.goodCount} 問 ({goodRate}%)
              </strong>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-amber-400 block">
                🔁 Again (翌日リベンジ)
              </span>
              <strong className="text-lg font-mono text-amber-300">
                {sessionStats.againCount} 問
              </strong>
            </div>
          </div>

          {/* 今日間違えた問題ハブ（埋め込み） */}
          <div className="border-t border-slate-800 pt-4">
            <TodayMistakesSection compact />
          </div>

          {/* アクション選択（もう10問続ける / ここで終了する） */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-800">
            {nextAvailableCount > 0 && (
              <button
                type="button"
                onClick={loadNextBatch}
                className="w-full sm:flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <PlayIcon size={13} />
                <span>
                  もう {nextAvailableCount} 問続ける
                  {nextQueuePreview.totalRemainingCount > 0
                    ? `（本日対象残り ${nextQueuePreview.totalRemainingCount} 枚）`
                    : "（先取り補充枠）"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              ここで終了する
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categoryTheme = REVIEW_CATEGORY_THEME[currentItem.reviewCategory];
  const futureNotice =
    earlyCount > 0 && farthestEarlyDueIso
      ? formatFutureDueNotice(farthestEarlyDueIso)
      : null;

  const badgeColorClass =
    currentItem.reviewCategory === "RETRY"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
      : currentItem.reviewCategory === "DUE"
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
        : "bg-purple-500/15 text-purple-300 border-purple-500/40";

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col z-50 select-none animate-fadeIn">
      {/* ヘッダー */}
      <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold">
            🎯 共通プール復習 (FSRS)
          </span>

          {/* 3色カラーバッジ */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${badgeColorClass}`}
          >
            {categoryTheme.icon} {categoryTheme.label}
            {currentItem.reviewCategory === "DUE" && currentItem.isOverdue
              ? "（期限切れ）"
              : ""}
          </span>

          {/* 優先度バッジ */}
          {currentItem.effectivePriority === "FORCE" && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/60 font-bold">
              🔥 強制出題
            </span>
          )}
          {currentItem.effectivePriority === "PRIORITY" && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-semibold">
              ★ 優先
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-mono text-slate-400">
            {currentIndex + 1} / {totalInBatch}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="セッションを中断して戻る (Esc)"
          >
            <XIcon size={18} />
          </button>
        </div>
      </header>

      {/* プログレスバー */}
      <div className="w-full bg-slate-800 h-1">
        <div
          className="bg-emerald-500 h-1 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalInBatch) * 100}%` }}
        />
      </div>

      {/* パープル（先取り）カード含有時の事前案内バナー */}
      {futureNotice && (
        <div className="bg-purple-950/40 border-b border-purple-800/40 px-4 py-1.5 text-center text-[11px] text-purple-200">
          ⚡ 本セッションには、最長で【{futureNotice.dateLabel}（あと
          {futureNotice.daysAhead}日後）】に復習予定の先取りカードが {earlyCount}{" "}
          枚含まれます
        </div>
      )}

      {/* メインカード領域 */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-2xl w-full mx-auto">
        {/* 所属パンくず & 推定想起確率 */}
        <div className="w-full flex items-center justify-between mb-3 text-xs">
          <span className="text-indigo-300 font-medium truncate max-w-md">
            📚 {currentItem.courseName} &gt; {currentItem.lectureName}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            記憶維持率 R: {Math.round(currentItem.retrievability * 100)}%
          </span>
        </div>

        {/* スライドイン・アウト用ラッパー */}
        <div
          className="w-full min-h-80 max-h-115 h-72 sm:h-80 will-change-transform"
          style={getSlideStyle()}
        >
          <div className="w-full h-full" style={{ perspective: "1000px" }}>
            <div
              onClick={handleFlip}
              className="relative w-full h-full cursor-pointer"
              style={{
                transformStyle: "preserve-3d",
                transition:
                  slideState === "idle" ? "transform 0.35s ease-in-out" : "none",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* 表面（問題） */}
              <div
                className="absolute inset-0 bg-slate-900 border border-slate-800 rounded-2xl p-7 flex flex-col justify-between shadow-2xl hover:border-slate-700 transition-colors"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                    表面（問題）
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    Q.{currentIndex + 1}
                  </span>
                </div>

                <div className="my-auto py-4 overflow-y-auto max-h-50 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-white whitespace-pre-wrap leading-relaxed select-text">
                    {currentItem.card.front}
                  </p>
                </div>

                <div className="text-center text-[11px] text-slate-500">
                  タップして解答を表示
                </div>
              </div>

              {/* 裏面（解答） */}
              <div
                className="absolute inset-0 bg-linear-to-b from-slate-900 to-emerald-950/30 border border-emerald-500/50 rounded-2xl p-7 flex flex-col justify-between shadow-2xl hover:border-emerald-500/70 transition-colors"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-emerald-300">
                    裏面（解答）
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    A.{currentIndex + 1}
                  </span>
                </div>

                <div className="my-auto py-4 overflow-y-auto max-h-50 text-center">
                  <p className="text-lg sm:text-xl font-medium text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
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
        <div className="mt-6 w-full h-13">
          {!isFlipped ? (
            <button
              type="button"
              onClick={handleFlip}
              disabled={slideState !== "idle"}
              className="w-full h-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>解答を表示</span>
            </button>
          ) : (
            <div className="w-full h-full grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => handleRate("AGAIN")}
                disabled={slideState !== "idle"}
                className="w-full h-full bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-60 text-rose-300 border border-rose-800/80 text-sm font-bold rounded-xl shadow-lg shadow-rose-950/40 transition cursor-pointer flex items-center justify-center space-x-2"
                title="不正解: 翌日の最優先リベンジ枠へ (← / 1)"
              >
                <span>❌ もう一度 (Again)</span>
              </button>

              <button
                type="button"
                onClick={() => handleRate("GOOD")}
                disabled={slideState !== "idle"}
                className="w-full h-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
                title="正解: FSRSで次回復習日を延長 (→ / 2)"
              >
                <span>⭕ 正解 (Good)</span>
              </button>
            </div>
          )}
        </div>

        {/* キー操作ガイド */}
        <div className="mt-5 text-center text-[11px] text-slate-500 hidden sm:block">
          {!isFlipped ? (
            <span>
              キー操作: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">Space</kbd> /{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">←</kbd> /{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">→</kbd> 解答を表示
            </span>
          ) : (
            <span>
              キー操作: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">Space</kbd> 問題に戻す /{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">←</kbd> もう一度 (Again) /{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">→</kbd> 正解 (Good)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
