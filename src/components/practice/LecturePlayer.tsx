import { useCallback, useEffect, useRef,useState } from "react";

import type { LectureCheckCategory } from "../../types/schema";
import { ArrowUpRightIcon,ShuffleIcon, XIcon } from "../icons";

export interface PracticeCardItem {
  id: string;
  front: string;
  back: string;
  /** カード左上に表示する任意フェーズバッジ等 */
  badge?: string;
  /** チェックモードにおける出題優先度区分（3 > 2 > 1 の色分けに使用） */
  checkCategory?: LectureCheckCategory;
}

export interface LecturePlayerProps {
  lectureTitle: string;
  cards: PracticeCardItem[];
  /** 演習モード（TRAINING = チェック、FREE_PRACTICE = 全問） */
  mode?: "TRAINING" | "FREE_PRACTICE";
  /** ヘッダー左上のカスタムバッジ文字列 */
  headerBadgeText?: string;
  /** 現在の講義内の「卒業推奨」カード枚数（チェック完了画面での一括移動用） */
  recommendedCount?: number;
  /** 「卒業推奨」カードを共通プールへ一括移動するコールバック */
  onGraduateRecommended?: () => number;
  /** 回答発生時の通知コールバック */
  onAnswer?: (cardId: string, result: "correct" | "incorrect") => void;
  /** 全問終了時の通知コールバック */
  onFinish?: (results: Record<string, "correct" | "incorrect">) => void;
  /** 閉じる */
  onClose: () => void;
}

type SlideAnimationState =
  "idle" | "slide-out-up" | "prepare-bottom" | "slide-in" | "slide-out-down" | "prepare-top";

export function LecturePlayer({
  lectureTitle,
  cards,
  mode = "FREE_PRACTICE",
  headerBadgeText,
  recommendedCount = 0,
  onGraduateRecommended,
  onAnswer,
  onFinish,
  onClose,
}: LecturePlayerProps) {
  const [activeCards, setActiveCards] = useState<PracticeCardItem[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, "correct" | "incorrect">>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [slideState, setSlideState] = useState<SlideAnimationState>("idle");
  const [graduatedNoticeCount, setGraduatedNoticeCount] = useState<number | null>(null);

  const transitionTimeoutRef = useRef<number | null>(null);

  // cards prop が変わった場合は同期
  useEffect(() => {
    setActiveCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setAnswers({});
    setIsCompleted(false);
  }, [cards]);

  const totalCards = activeCards.length;
  const currentCard = activeCards[currentIndex];

  // カードをシャッフルして最初から開始する
  const handleShuffle = useCallback(() => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);

    const shuffled = [...activeCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setActiveCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setAnswers({});
    setIsCompleted(false);
    setSlideState("idle");
  }, [activeCards]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // ① カードをめくる
  const handleFlip = useCallback(() => {
    if (slideState !== "idle") return;
    setIsFlipped((prev) => !prev);
  }, [slideState]);

  // 次のカードへ進む内部処理（上にスライドアウト ➔ 下からスライドイン）
  const proceedToNext = useCallback(
    (cardId: string, result: "correct" | "incorrect") => {
      if (slideState !== "idle") return;

      // 回答情報の伝達
      onAnswer?.(cardId, result);

      const nextAnswers = { ...answers, [cardId]: result };
      setAnswers(nextAnswers);

      if (currentIndex + 1 >= totalCards) {
        setIsCompleted(true);
        onFinish?.(nextAnswers);
        return;
      }

      // 1. 元のカードが上にスライドアウト
      setSlideState("slide-out-up");

      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);

      transitionTimeoutRef.current = window.setTimeout(() => {
        // 2. カードが完全に非表示になったタイミングで、インスタントに表面（0deg）へ戻す
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        setSlideState("prepare-bottom");

        // 3. 次の描画フレームで、既に表面になった状態で下からスライドイン開始
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSlideState("slide-in");

            // 4. スライドイン完了後に idle へ復帰
            transitionTimeoutRef.current = window.setTimeout(() => {
              setSlideState("idle");
            }, 200);
          });
        });
      }, 160);
    },
    [slideState, answers, currentIndex, totalCards, onAnswer, onFinish],
  );

  // ② 正解を選択して次のカード
  const handleCorrect = useCallback(() => {
    if (!currentCard || slideState !== "idle") return;
    proceedToNext(currentCard.id, "correct");
  }, [currentCard, slideState, proceedToNext]);

  // ③ 間違いを選択して次のカード
  const handleIncorrect = useCallback(() => {
    if (!currentCard || slideState !== "idle") return;
    proceedToNext(currentCard.id, "incorrect");
  }, [currentCard, slideState, proceedToNext]);

  // ④ 前のカードに戻る（下へスライドアウト ➔ 上からスライドイン）
  const handlePrev = useCallback(() => {
    if (currentIndex <= 0 || slideState !== "idle") return;

    setSlideState("slide-out-down");

    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);

    transitionTimeoutRef.current = window.setTimeout(() => {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setSlideState("prepare-top");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideState("slide-in");

          transitionTimeoutRef.current = window.setTimeout(() => {
            setSlideState("idle");
          }, 200);
        });
      });
    }, 160);
  }, [currentIndex, slideState]);

  // 最初からやり直す
  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setAnswers({});
    setIsCompleted(false);
    setSlideState("idle");
  };

  // キーボード操作対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      } else if (e.key === "ArrowRight" || e.key === "2") {
        e.preventDefault();
        // 表のときは、右矢印でもカードをめくる
        if (!isFlipped) {
          handleFlip();
        } else {
          handleCorrect();
        }
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        // 表のときは、左矢印でもカードをめくる
        if (!isFlipped) {
          handleFlip();
        } else {
          handleIncorrect();
        }
      } else if (e.key === "ArrowUp" || e.key === "Backspace") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleCorrect, handleIncorrect, handlePrev, isFlipped, isCompleted, onClose]);

  // スライドイン・アウトのアニメーションスタイル
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
      case "slide-out-down":
        return {
          transform: "translateY(48px)",
          opacity: 0,
          transition: "transform 0.16s ease-in, opacity 0.16s ease-in",
        };
      case "prepare-top":
        return {
          transform: "translateY(-48px)",
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

  // カードが0枚の場合
  if (totalCards === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
            📭
          </div>
          <h3 className="text-base font-bold text-white">カードがありません</h3>
          <p className="text-xs text-slate-400">
            この講義には出題対象のカードが登録されていません。カードを追加してから再度お試しください。
          </p>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          >
            講義画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // 演習完了リザルト画面
  if (isCompleted) {
    const correctCount = Object.values(answers).filter((a) => a === "correct").length;
    const incorrectCount = totalCards - correctCount;
    const correctRate = Math.round((correctCount / totalCards) * 100);

    return (
      <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <div className="space-y-2 text-center">
            <span className="text-4xl">🎉</span>
            <h2 className="text-lg font-bold text-white">
              {mode === "TRAINING" ? "チェックが完了しました" : "全問演習が完了しました"}
            </h2>
            <p className="text-xs text-slate-400">{lectureTitle}</p>
            {mode === "TRAINING" && (
              <p className="rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-1.5 text-[11px] text-indigo-300">
                1回正解カードは「未卒業（8h待機）」へ、2回以上連続正解カードは「卒業推奨」へ更新されました
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">出題カード数</span>
              <span className="font-mono font-bold text-white">{totalCards} 枚</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">正解</span>
              <span className="font-mono font-bold text-emerald-400">{correctCount} 問</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">間違い</span>
              <span className="font-mono font-bold text-rose-400">{incorrectCount} 問</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
              <span className="font-semibold text-slate-300">正答率</span>
              <span className="font-mono text-sm font-bold text-indigo-400">{correctRate} %</span>
            </div>
          </div>

          {graduatedNoticeCount !== null && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/60 px-3 py-2.5 text-center text-xs text-emerald-300">
              🎓 {graduatedNoticeCount} 枚の「卒業推奨」カードを共通プール（卒業済）へ移動しました！
            </div>
          )}

          {mode === "TRAINING" &&
            onGraduateRecommended &&
            recommendedCount > 0 &&
            graduatedNoticeCount === null && (
              <button
                type="button"
                onClick={() => {
                  const count = onGraduateRecommended();
                  setGraduatedNoticeCount(count);
                }}
                className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-600/30 transition hover:bg-cyan-500"
              >
                <ArrowUpRightIcon size={14} />
                <span>🎓 卒業推奨カードを共通プールへ一括移動 ({recommendedCount}枚)</span>
              </button>
            )}

          <div className="flex items-center space-x-2">
            {mode === "FREE_PRACTICE" && (
              <>
                <button
                  onClick={handleRestart}
                  className="flex-1 cursor-pointer rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  最初からもう一度
                </button>
                <button
                  onClick={handleShuffle}
                  className="flex cursor-pointer items-center justify-center space-x-1.5 rounded-xl border border-indigo-500/30 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-indigo-300 transition hover:bg-slate-700 hover:text-white"
                  title="カードをシャッフルして再開"
                >
                  <ShuffleIcon size={14} />
                  <span>シャッフル</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
            >
              終了する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md select-none">
      {/* 演習ヘッダー */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center space-x-3">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              mode === "TRAINING"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
            }`}
          >
            {headerBadgeText ??
              (mode === "TRAINING" ? "✅ チェックモード (優先度: 3 > 2 > 1)" : "🔁 全問モード")}
          </span>
          <h2 className="max-w-xs truncate text-sm font-bold text-white sm:max-w-md">
            {lectureTitle}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          {/* シャッフルして最初から始めるボタン */}
          <button
            type="button"
            onClick={handleShuffle}
            disabled={totalCards <= 1}
            className="flex cursor-pointer items-center space-x-1.5 rounded-lg border border-slate-700/60 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="カードの並び順をシャッフルして最初から始める"
          >
            <ShuffleIcon size={13} className="text-indigo-400" />
            <span>シャッフル</span>
          </button>

          <span className="font-mono text-xs text-slate-400">
            {currentIndex + 1} / {totalCards}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="演習を中断して戻る (Esc)"
          >
            <XIcon size={18} />
          </button>
        </div>
      </header>

      {/* プログレスバー */}
      <div className="h-1 w-full bg-slate-800">
        <div
          className="h-1 bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
        />
      </div>

      {/* メインカード表示領域 */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-4 sm:p-6">
        {/* ボタン系はその場に留まる：カード左上の「戻る」ボタン ＆ ガイド */}
        <div className="mb-3 flex w-full items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0 || slideState !== "idle"}
            className="flex cursor-pointer items-center space-x-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="前のカードに戻る (↑ / Backspace)"
          >
            <span>← 前に戻る</span>
          </button>

          <span className="text-[11px] text-slate-500">カードをクリックしてめくる（Space）</span>
        </div>

        {/* スライドイン・アウト用ラッパー（カードのみが上下にスライド移動する） */}
        <div
          className="h-80 max-h-120 min-h-80 w-full will-change-transform sm:h-88"
          style={getSlideStyle()}
        >
          {/* ① 3D フリップアニメーション用コンテナ */}
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
              {/* 表面 (問題面) — チェック区分 3 / 2 / 1 でカード色を分ける */}
              <div
                className={`absolute inset-0 flex flex-col justify-between rounded-2xl border p-7 shadow-2xl transition-colors ${
                  currentCard.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED"
                    ? "border-emerald-500/60 bg-linear-to-b from-slate-900 to-emerald-950/35 hover:border-emerald-400/80"
                    : currentCard.checkCategory === "PRIORITY_2_UNATTEMPTED"
                      ? "border-indigo-500/60 bg-linear-to-b from-slate-900 to-indigo-950/35 hover:border-indigo-400/80"
                      : currentCard.checkCategory === "PRIORITY_1_ZERO_STREAK"
                        ? "border-amber-500/60 bg-linear-to-b from-slate-900 to-amber-950/35 hover:border-amber-400/80"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      表面（問題）
                    </span>
                    {currentCard.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED" && (
                      <span className="rounded-full border border-emerald-600/60 bg-emerald-950/90 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        ③ 定着確認 (連続正解・8h経過)
                      </span>
                    )}
                    {currentCard.checkCategory === "PRIORITY_2_UNATTEMPTED" && (
                      <span className="rounded-full border border-indigo-600/60 bg-indigo-950/90 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300">
                        ② 未実施 (新規挑戦)
                      </span>
                    )}
                    {currentCard.checkCategory === "PRIORITY_1_ZERO_STREAK" && (
                      <span className="rounded-full border border-amber-600/60 bg-amber-950/90 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                        ① 弱点リベンジ (連続正解0)
                      </span>
                    )}
                    {currentCard.badge && (
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {currentCard.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-indigo-400">
                    Q.{currentIndex + 1}
                  </span>
                </div>

                <div className="my-auto flex max-h-56 items-center justify-center overflow-y-auto py-4">
                  <p
                    className={`leading-relaxed font-bold whitespace-pre-wrap text-white select-text ${
                      currentCard.front.length > 70 || currentCard.front.split("\n").length >= 3
                        ? "w-full px-2 text-left text-base sm:text-lg"
                        : "text-center text-xl sm:text-2xl"
                    }`}
                  >
                    {currentCard.front}
                  </p>
                </div>

                <div className="text-center text-[11px] text-slate-500">タップして解答を表示</div>
              </div>

              {/* 裏面 (解答面) — チェック区分 3 / 2 / 1 でカード色を分ける */}
              <div
                className={`absolute inset-0 flex flex-col justify-between rounded-2xl border p-7 shadow-2xl transition-colors ${
                  currentCard.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED"
                    ? "border-emerald-400/70 bg-linear-to-b from-slate-900 to-emerald-950/45"
                    : currentCard.checkCategory === "PRIORITY_1_ZERO_STREAK"
                      ? "border-amber-400/70 bg-linear-to-b from-slate-900 to-amber-950/45"
                      : "border-indigo-500/60 bg-linear-to-b from-slate-900 to-indigo-950/40"
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-semibold tracking-wider text-indigo-300 uppercase">
                    裏面（解答）
                  </span>
                  <span className="font-mono text-[11px] text-indigo-400">
                    A.{currentIndex + 1}
                  </span>
                </div>

                <div className="my-auto flex max-h-56 items-center justify-center overflow-y-auto py-4">
                  <p
                    className={`leading-relaxed font-medium whitespace-pre-wrap text-slate-100 select-text ${
                      currentCard.back.length > 70 || currentCard.back.split("\n").length >= 3
                        ? "w-full px-2 text-left text-sm sm:text-base"
                        : "text-center text-lg sm:text-xl"
                    }`}
                  >
                    {currentCard.back}
                  </p>
                </div>

                <div className="text-center text-[11px] text-indigo-400/80">
                  タップして問題面に戻す
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ボタン系（表のときは「解答を表示」1つのボタン、裏のときは「間違い」「正解」の2つのボタン） */}
        <div className="mt-6 h-13 w-full">
          {!isFlipped ? (
            <button
              type="button"
              onClick={handleFlip}
              disabled={slideState !== "idle"}
              className="flex h-full w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
              title="解答を表示して裏にする (Space / ← / →)"
            >
              <span>解答を表示</span>
            </button>
          ) : (
            <div className="grid h-full w-full grid-cols-2 gap-3 sm:gap-4">
              {/* ③ 間違いを選択して次のカード */}
              <button
                type="button"
                onClick={handleIncorrect}
                disabled={slideState !== "idle"}
                className="flex h-full w-full cursor-pointer items-center justify-center space-x-2 rounded-xl border border-rose-800/80 bg-rose-950/60 text-sm font-bold text-rose-300 shadow-lg shadow-rose-950/40 transition hover:bg-rose-900/80 disabled:opacity-60"
                title="間違い (← / 1)"
              >
                <span>❌ 間違い</span>
              </button>

              {/* ② 正解を選択して次のカード */}
              <button
                type="button"
                onClick={handleCorrect}
                disabled={slideState !== "idle"}
                className="flex h-full w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-60"
                title="正解 (→ / 2)"
              >
                <span>⭕ 正解</span>
              </button>
            </div>
          )}
        </div>

        {/* キーボードショートカットガイド */}
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
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">←</kbd> 間違い /{" "}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">→</kbd> 正解
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
