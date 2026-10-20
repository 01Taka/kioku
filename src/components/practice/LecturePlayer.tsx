import { useState, useEffect, useCallback } from "react";
import { ChevronRightIcon, XIcon } from "../icons";

export interface PracticeCardItem {
  id: string;
  front: string;
  back: string;
}

export interface LecturePlayerProps {
  lectureTitle: string;
  cards: PracticeCardItem[];
  /** 回答発生時の通知コールバック（情報伝達用、挙動変更は起こさない） */
  onAnswer?: (cardId: string, result: "correct" | "incorrect") => void;
  /** 全問終了時の通知コールバック */
  onFinish?: (results: Record<string, "correct" | "incorrect">) => void;
  /** 閉じる */
  onClose: () => void;
}

export function LecturePlayer({
  lectureTitle,
  cards,
  onAnswer,
  onFinish,
  onClose,
}: LecturePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, "correct" | "incorrect">>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const totalCards = cards.length;
  const currentCard = cards[currentIndex];

  // ① カードをめくる
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // 次のカードへ進む内部処理
  const proceedToNext = useCallback(
    (cardId: string, result: "correct" | "incorrect") => {
      // 回答情報の伝達
      onAnswer?.(cardId, result);

      const nextAnswers = { ...answers, [cardId]: result };
      setAnswers(nextAnswers);

      if (currentIndex + 1 < totalCards) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        setIsCompleted(true);
        onFinish?.(nextAnswers);
      }
    },
    [answers, currentIndex, totalCards, onAnswer, onFinish],
  );

  // ② 正解を選択して次のカード
  const handleCorrect = useCallback(() => {
    if (!currentCard) return;
    proceedToNext(currentCard.id, "correct");
  }, [currentCard, proceedToNext]);

  // ③ 間違いを選択して次のカード
  const handleIncorrect = useCallback(() => {
    if (!currentCard) return;
    proceedToNext(currentCard.id, "incorrect");
  }, [currentCard, proceedToNext]);

  // ④ 前のカードに戻る
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  // 最初からやり直す
  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setAnswers({});
    setIsCompleted(false);
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
        handleCorrect();
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        handleIncorrect();
      } else if (e.key === "ArrowUp" || e.key === "Backspace") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleCorrect, handleIncorrect, handlePrev, isCompleted, onClose]);

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
            <h2 className="text-lg font-bold text-white">演習が完了しました</h2>
            <p className="text-xs text-slate-400">{lectureTitle}</p>
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

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRestart}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              最初からもう一度
            </button>
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
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
            講義カード出題
          </span>
          <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
            {lectureTitle}
          </h2>
        </div>

        <div className="flex items-center space-x-4">
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
        {/* ④ カード左上の「戻る」ボタン ＆ ガイド */}
        <div className="w-full flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-800 transition cursor-pointer flex items-center space-x-1 shadow-sm"
            title="前のカードに戻る (↑ / Backspace)"
          >
            <span>← 前に戻る</span>
          </button>

          <span className="text-[11px] text-slate-500">
            カードをクリックしてめくる（Space）
          </span>
        </div>

        {/* ① カードをめくる 3D フリップアニメーション */}
        <div
          className="w-full min-h-[320px] max-h-[460px] h-72 sm:h-80"
          style={{ perspective: "1000px" }}
        >
          <div
            onClick={handleFlip}
            className="relative w-full h-full cursor-pointer"
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.35s ease-in-out",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* 表面 (問題面) */}
            <div
              className="absolute inset-0 bg-slate-900 border border-slate-800 rounded-2xl p-7 flex flex-col justify-between shadow-2xl hover:border-slate-700 transition-colors"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                  表面（問題）
                </span>
                <span className="text-[11px] text-indigo-400 font-mono">Q.{currentIndex + 1}</span>
              </div>

              <div className="my-auto py-4 overflow-y-auto max-h-[200px] text-center">
                <p className="text-xl sm:text-2xl font-bold text-white whitespace-pre-wrap leading-relaxed select-text">
                  {currentCard.front}
                </p>
              </div>

              <div className="text-center text-[11px] text-slate-500">
                タップして解答を表示
              </div>
            </div>

            {/* 裏面 (解答面) */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-slate-900 to-indigo-950/30 border border-indigo-500/50 rounded-2xl p-7 flex flex-col justify-between shadow-2xl hover:border-indigo-500/70 transition-colors"
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

              <div className="my-auto py-4 overflow-y-auto max-h-[200px] text-center">
                <p className="text-lg sm:text-xl font-medium text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
                  {currentCard.back}
                </p>
              </div>

              <div className="text-center text-[11px] text-indigo-400/80">
                タップして問題面に戻す
              </div>
            </div>
          </div>
        </div>

        {/* ③ カード下部に「間違い」と「正解」をフルワイドで横並びに配置 */}
        <div className="mt-6 w-full grid grid-cols-2 gap-3 sm:gap-4">
          {/* ③ 間違いを選択して次のカード */}
          <button
            type="button"
            onClick={handleIncorrect}
            className="w-full py-3.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 text-sm font-bold rounded-xl shadow-lg shadow-rose-950/40 transition cursor-pointer flex items-center justify-center space-x-2"
            title="間違い (← / 1)"
          >
            <span>❌ 間違い</span>
          </button>

          {/* ② 正解を選択して次のカード */}
          <button
            type="button"
            onClick={handleCorrect}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center space-x-2"
            title="正解 (→ / 2)"
          >
            <span>⭕ 正解</span>
            <ChevronRightIcon size={16} />
          </button>
        </div>

        {/* キーボードショートカットガイド */}
        <div className="mt-5 text-center text-[11px] text-slate-500 hidden sm:block">
          キー操作: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">Space</kbd> めくる /{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">←</kbd> 間違い /{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">→</kbd> 正解 /{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">↑</kbd> 前に戻る
        </div>
      </div>
    </div>
  );
}
