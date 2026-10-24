import { useState, useEffect, useCallback, useRef } from "react";
import type { LectureCheckCategory } from "../../types/schema";
import { XIcon, ShuffleIcon, ArrowUpRightIcon } from "../icons";

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
  | "idle"
  | "slide-out-up"
  | "prepare-bottom"
  | "slide-in"
  | "slide-out-down"
  | "prepare-top";

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
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            📭
          </div>
          <h3 className="text-base font-bold text-white">カードがありません</h3>
          <p className="text-xs text-slate-400">
            この講義には出題対象のカードが登録されていません。カードを追加してから再度お試しください。
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl font-medium transition cursor-pointer"
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
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <span className="text-4xl">🎉</span>
            <h2 className="text-lg font-bold text-white">
              {mode === "TRAINING" ? "チェックが完了しました" : "全問演習が完了しました"}
            </h2>
            <p className="text-xs text-slate-400">{lectureTitle}</p>
            {mode === "TRAINING" && (
              <p className="text-[11px] text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 rounded-lg py-1.5 px-3">
                1回正解カードは「未卒業（8h待機）」へ、2回以上連続正解カードは「卒業推奨」へ更新されました
              </p>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">出題カード数</span>
              <span className="font-mono font-bold text-white">{totalCards} 枚</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">正解</span>
              <span className="font-mono font-bold text-emerald-400">{correctCount} 問</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">間違い</span>
              <span className="font-mono font-bold text-rose-400">{incorrectCount} 問</span>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold">正答率</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">{correctRate} %</span>
            </div>
          </div>

          {graduatedNoticeCount !== null && (
            <div className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-xl py-2.5 px-3 text-center">
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
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <ArrowUpRightIcon size={14} />
                <span>
                  🎓 卒業推奨カードを共通プールへ一括移動 ({recommendedCount}枚)
                </span>
              </button>
            )}

          <div className="flex items-center space-x-2">
            {mode === "FREE_PRACTICE" && (
              <>
                <button
                  onClick={handleRestart}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  最初からもう一度
                </button>
                <button
                  onClick={handleShuffle}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold rounded-xl border border-indigo-500/30 transition cursor-pointer flex items-center justify-center space-x-1.5"
                  title="カードをシャッフルして再開"
                >
                  <ShuffleIcon size={14} />
                  <span>シャッフル</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              終了する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col z-50 select-none animate-fadeIn">
      {/* 演習ヘッダー */}
      <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              mode === "TRAINING"
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
            }`}
          >
            {headerBadgeText ??
              (mode === "TRAINING" ? "✅ チェックモード (優先度: 3 > 2 > 1)" : "🔁 全問モード")}
          </span>
          <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
            {lectureTitle}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          {/* シャッフルして最初から始めるボタン */}
          <button
            type="button"
            onClick={handleShuffle}
            disabled={totalCards <= 1}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white rounded-lg border border-slate-700/60 text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
            title="カードの並び順をシャッフルして最初から始める"
          >
            <ShuffleIcon size={13} className="text-indigo-400" />
            <span>シャッフル</span>
          </button>

          <span className="text-xs font-mono text-slate-400">
            {currentIndex + 1} / {totalCards}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="演習を中断して戻る (Esc)"
          >
            <XIcon size={18} />
          </button>
        </div>
      </header>

      {/* プログレスバー */}
      <div className="w-full bg-slate-800 h-1">
        <div
          className="bg-indigo-500 h-1 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
        />
      </div>

      {/* メインカード表示領域 */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-2xl w-full mx-auto">
        {/* ボタン系はその場に留まる：カード左上の「戻る」ボタン ＆ ガイド */}
        <div className="w-full flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0 || slideState !== "idle"}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-800 transition cursor-pointer flex items-center space-x-1 shadow-sm"
            title="前のカードに戻る (↑ / Backspace)"
          >
            <span>← 前に戻る</span>
          </button>

          <span className="text-[11px] text-slate-500">
            カードをクリックしてめくる（Space）
          </span>
        </div>

        {/* スライドイン・アウト用ラッパー（カードのみが上下にスライド移動する） */}
        <div
          className="w-full min-h-80 max-h-120 h-80 sm:h-88 will-change-transform"
          style={getSlideStyle()}
        >
          {/* ① 3D フリップアニメーション用コンテナ */}
          <div
            className="w-full h-full"
            style={{ perspective: "1000px" }}
          >
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
              {/* 表面 (問題面) — チェック区分 3 / 2 / 1 でカード色を分ける */}
              <div
                className={`absolute inset-0 rounded-2xl p-7 flex flex-col justify-between shadow-2xl transition-colors border ${
                  currentCard.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED"
                    ? "bg-linear-to-b from-slate-900 to-emerald-950/35 border-emerald-500/60 hover:border-emerald-400/80"
                    : currentCard.checkCategory === "PRIORITY_2_UNATTEMPTED"
                      ? "bg-linear-to-b from-slate-900 to-indigo-950/35 border-indigo-500/60 hover:border-indigo-400/80"
                      : currentCard.checkCategory === "PRIORITY_1_ZERO_STREAK"
                        ? "bg-linear-to-b from-slate-900 to-amber-950/35 border-amber-500/60 hover:border-amber-400/80"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                      表面（問題）
                    </span>
                    {currentCard.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED" && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-600/60">
                        ③ 定着確認 (連続正解・8h経過)
                      </span>
                    )}
                    {currentCard.checkCategory === "PRIORITY_2_UNATTEMPTED" && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-600/60">
                        ② 未実施 (新規挑戦)
                      </span>
                    )}
                    {currentCard.checkCategory === "PRIORITY_1_ZERO_STREAK" && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-600/60">
                        ① 弱点リベンジ (連続正解0)
                      </span>
                    )}
                    {currentCard.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {currentCard.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-indigo-400 font-mono">Q.{currentIndex + 1}</span>
                </div>

                <div className="my-auto py-4 overflow-y-auto max-h-56 flex items-center justify-center">
                  <p
                    className={`font-bold text-white whitespace-pre-wrap leading-relaxed select-text ${
                      currentCard.front.length > 70 ||
                      currentCard.front.split("\n").length >= 3
                        ? "text-base sm:text-lg text-left w-full px-2"
                        : "text-xl sm:text-2xl text-center"
                    }`}
                  >
                    {currentCard.front}
                  </p>
                </div>

                <div className="text-center text-[11px] text-slate-500">
                  タップして解答を表示
                </div>
              </div>

              {/* 裏面 (解答面) — チェック区分 3 / 2 / 1 でカード色を分ける */}
              <div
                className={`absolute inset-0 rounded-2xl p-7 flex flex-col justify-between shadow-2xl transition-colors border ${
                  currentCard.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED"
                    ? "bg-linear-to-b from-slate-900 to-emerald-950/45 border-emerald-400/70"
                    : currentCard.checkCategory === "PRIORITY_1_ZERO_STREAK"
                      ? "bg-linear-to-b from-slate-900 to-amber-950/45 border-amber-400/70"
                      : "bg-linear-to-b from-slate-900 to-indigo-950/40 border-indigo-500/60"
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-indigo-300">
                    裏面（解答）
                  </span>
                  <span className="text-[11px] text-indigo-400 font-mono">A.{currentIndex + 1}</span>
                </div>

                <div className="my-auto py-4 overflow-y-auto max-h-56 flex items-center justify-center">
                  <p
                    className={`font-medium text-slate-100 whitespace-pre-wrap leading-relaxed select-text ${
                      currentCard.back.length > 70 ||
                      currentCard.back.split("\n").length >= 3
                        ? "text-sm sm:text-base text-left w-full px-2"
                        : "text-lg sm:text-xl text-center"
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
        <div className="mt-6 w-full h-13">
          {!isFlipped ? (
            <button
              type="button"
              onClick={handleFlip}
              disabled={slideState !== "idle"}
              className="w-full h-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
              title="解答を表示して裏にする (Space / ← / →)"
            >
              <span>解答を表示</span>
            </button>
          ) : (
            <div className="w-full h-full grid grid-cols-2 gap-3 sm:gap-4">
              {/* ③ 間違いを選択して次のカード */}
              <button
                type="button"
                onClick={handleIncorrect}
                disabled={slideState !== "idle"}
                className="w-full h-full bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-60 text-rose-300 border border-rose-800/80 text-sm font-bold rounded-xl shadow-lg shadow-rose-950/40 transition cursor-pointer flex items-center justify-center space-x-2"
                title="間違い (← / 1)"
              >
                <span>❌ 間違い</span>
              </button>

              {/* ② 正解を選択して次のカード */}
              <button
                type="button"
                onClick={handleCorrect}
                disabled={slideState !== "idle"}
                className="w-full h-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
                title="正解 (→ / 2)"
              >
                <span>⭕ 正解</span>
              </button>
            </div>
          )}
        </div>

        {/* キーボードショートカットガイド */}
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
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">←</kbd> 間違い /{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">→</kbd> 正解
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
