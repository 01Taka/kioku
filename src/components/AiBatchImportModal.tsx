import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../store/useAppStore";
import { parseFlashcardsFromAI } from "../utils/aiCardParser";
import { CheckIcon, ClipboardIcon, SparklesIcon, XIcon } from "./icons";

function WarningIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

interface AiBatchImportModalProps {
  courseId: string;
  lectureId: string;
  lectureName: string;
  initialText?: string;
  onClose: () => void;
  onSuccess: (bundleId: string, count: number) => void;
}

export function AiBatchImportModal({
  courseId,
  lectureId,
  lectureName,
  initialText = "",
  onClose,
  onSuccess,
}: AiBatchImportModalProps) {
  const { addCardsBatch, isDuplicateOfLastBatch } = useAppStore();

  const [rawText, setRawText] = useState(initialText);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);

  const [customBundleId, setCustomBundleId] = useState(() => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rand = Math.random().toString(36).substring(2, 6);
    return `ai_${dateStr}_${rand}`;
  });

  // クリップボードからの読み取り処理
  const readFromClipboard = async () => {
    setClipboardError(null);
    setIsReadingClipboard(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setClipboardError("クリップボードが空です。AIの出力テキストをコピーしてから再度お試しください。");
      } else {
        setRawText(text.trim());
      }
    } catch {
      setClipboardError(
        "クリップボードの読み取りに失敗しました。ブラウザのクリップボードへのアクセス許可をご確認ください。",
      );
    } finally {
      setIsReadingClipboard(false);
    }
  };

  // 初回表示時、initialTextが空ならクリップボードからの自動読み込みを試みる
  useEffect(() => {
    if (!initialText && navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((text) => {
          if (text && text.trim()) {
            setRawText(text.trim());
          }
        })
        .catch(() => {
          // 初回自動取得拒否時はエラー表示せず、手動ボタンを押してもらう
        });
    }
  }, [initialText]);

  // リアルタイムパース
  const parseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseFlashcardsFromAI(rawText);
  }, [rawText]);

  // 直前追加分との完全重複チェック
  const isDuplicate = useMemo(() => {
    if (!parseResult || !parseResult.success || parseResult.cards.length === 0) {
      return false;
    }
    return isDuplicateOfLastBatch(lectureId, parseResult.cards);
  }, [parseResult, isDuplicateOfLastBatch, lectureId]);

  const handleImport = () => {
    if (!parseResult || !parseResult.success || parseResult.cards.length === 0) return;

    if (isDuplicate) {
      alert(
        `⚠️ 警告: 直前に追加した一括カード（全 ${parseResult.cards.length} 件）と全く同じ内容です。\n二重登録を防止するため、追加をキャンセルしました。`,
      );
      return;
    }

    const bundleId = customBundleId.trim() || undefined;
    const result = addCardsBatch(courseId, lectureId, parseResult.cards, bundleId);

    onSuccess(result.bundleId, result.addedCards.length);
    onClose();
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 p-4 sm:p-5">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-400">
              <SparklesIcon size={20} />
            </div>
            <div>
              <h2 className="flex items-center space-x-2 text-base font-bold text-white">
                <span>AI生成フラッシュカードの一括取り込み</span>
              </h2>
              <p className="text-xs text-slate-400">
                講義プール: <strong className="text-slate-200">{lectureName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* モーダル本文 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* クリップボード読み取りボタン領域 */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-500/40 bg-slate-950/60 p-6 text-center">
            <button
              type="button"
              onClick={readFromClipboard}
              disabled={isReadingClipboard}
              className="flex cursor-pointer items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <ClipboardIcon size={18} />
              <span>
                {rawText
                  ? "📋 クリップボードから再取り込み"
                  : "📋 クリップボードの内容を自動で取り込む"}
              </span>
            </button>
            <p className="mt-2.5 text-xs text-slate-400">
              AIに出力させたカードリスト（JSON）をコピーした状態で上のボタンを押してください。
            </p>

            {rawText && (
              <div className="mt-3 flex items-center space-x-3 text-xs">
                <span className="text-slate-400">
                  取り込みデータ: <strong className="text-indigo-300">{rawText.length}</strong> 文字
                </span>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setRawText("");
                    setClipboardError(null);
                  }}
                  className="cursor-pointer text-slate-500 transition hover:text-rose-400"
                >
                  クリア
                </button>
              </div>
            )}
          </div>

          {/* クリップボード読み取りエラー */}
          {clipboardError && (
            <div className="animate-fadeIn flex items-start space-x-2.5 rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300">
              <WarningIcon size={16} className="mt-0.5 flex-shrink-0 text-rose-400" />
              <div>
                <div className="font-semibold text-rose-200">読み取りエラー</div>
                <p className="mt-0.5 text-[11px] text-rose-300/90">{clipboardError}</p>
              </div>
            </div>
          )}

          {/* パース結果インジケータ */}
          {parseResult && (
            <div className="space-y-3">
              {parseResult.success ? (
                <div className="space-y-2">
                  {/* 重複警告バナー */}
                  {isDuplicate && (
                    <div className="animate-fadeIn flex items-start space-x-2.5 rounded-xl border border-amber-800/80 bg-amber-950/60 p-3 text-xs text-amber-200">
                      <WarningIcon size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
                      <div>
                        <div className="font-semibold text-amber-300">
                          ⚠️ 直前に追加した一括カードと全く同じ内容です
                        </div>
                        <p className="mt-0.5 text-[11px] text-amber-300/80">
                          二重追加を防止するため、このまま追加することはできません。別の出力をコピーして再度お試しください。
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-semibold text-emerald-300">
                        <CheckIcon size={16} />
                        <span>{parseResult.cards.length} 件のカードを認識しました</span>
                      </div>
                      <span className="rounded-full border border-emerald-700/60 bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-200">
                        {parseResult.source === "JSON"
                          ? "標準JSON形式"
                          : "ハルシネーション耐性スキャナー（自動復元）"}
                      </span>
                    </div>

                    {/* プレビュー一覧 */}
                    <div className="max-h-56 space-y-2 overflow-y-auto pt-1 pr-1">
                      {parseResult.cards.map((card, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-xs md:grid-cols-2"
                        >
                          <div>
                            <span className="mb-0.5 block text-[10px] font-semibold text-indigo-400">
                              Q{idx + 1}:
                            </span>
                            <p className="whitespace-pre-wrap text-slate-100">{card.question}</p>
                          </div>
                          <div>
                            <span className="mb-0.5 block text-[10px] font-semibold text-emerald-400">
                              A{idx + 1}:
                            </span>
                            <p className="whitespace-pre-wrap text-slate-200">{card.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-2.5 rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-300">
                  <WarningIcon size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="mb-0.5 font-semibold text-rose-200">
                      カードを認識できませんでした
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-300/90">
                      {parseResult.errorMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* バンドルID設定 */}
          <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs sm:flex-row sm:items-center">
            <div>
              <span className="font-semibold text-slate-300">一括管理ID (bundleId):</span>
              <p className="text-[11px] text-slate-400">
                このバッチで追加される全カードに付与されます。後から一括取り消し・削除が可能です。
              </p>
            </div>
            <input
              type="text"
              value={customBundleId}
              onChange={(e) => setCustomBundleId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-base text-indigo-300 focus:border-indigo-500 focus:outline-none sm:w-52"
            />
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 p-4 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-3.5 py-2 text-xs text-slate-400 transition hover:text-white"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parseResult?.success || parseResult.cards.length === 0}
            className={`flex cursor-pointer items-center space-x-2 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-lg transition ${
              isDuplicate
                ? "bg-amber-700/80 text-amber-100 shadow-amber-700/30 hover:bg-amber-600"
                : "bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
            title={isDuplicate ? "直前に追加した内容と同一のため追加できません" : undefined}
          >
            <SparklesIcon size={15} />
            <span>
              {isDuplicate
                ? "同一内容のため追加不可"
                : parseResult?.success && parseResult.cards.length > 0
                  ? `${parseResult.cards.length} 件を一括追加`
                  : "一括追加"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
