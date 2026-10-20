import { useState, useMemo } from "react";
import { parseFlashcardsFromAI } from "../utils/aiCardParser";
import { useAppStore } from "../store/useAppStore";
import { SparklesIcon, XIcon, CheckIcon } from "./icons";

// AlertTriangleIcon がなければ作成
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
  const [customBundleId, setCustomBundleId] = useState(() => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rand = Math.random().toString(36).substring(2, 6);
    return `ai_${dateStr}_${rand}`;
  });

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

  const handleInsertSample = () => {
    setRawText(`[
  {
    "question": "オームの法則の公式は？",
    "answer": "V = R · I (電圧 = 抵抗 × 電流)"
  },
  {
    "question": "キルヒホッフ第1法則（電流則 KCL）の内容は？",
    "answer": "任意の節点に流入する電流の和は流出する電流の和に等しい（ΣI = 0）"
  },
  {
    "question": "インダクタンス L の単位とその記号は？",
    "answer": "ヘンリー [H]"
  }
]`);
  };

  const handleInsertBrokenSample = () => {
    setRawText(`// AIがハルシネーションで括弧やカンマを崩した例
{
  "question": "コンデンサの静電容量 C の定義式は？",
  "answer": "Q = C · V (電荷 = 静電容量 × 電圧)"
}
{
  "question": "交流回路におけるリアクタンスとは？",
  "answer": "インダクタやコンデンサが交流電流の流れを妨げる抵抗成分（単位: Ω）"
}} // 括弧が余計
`);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <SparklesIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>AI生成フラッシュカードの一括取り込み</span>
              </h2>
              <p className="text-xs text-slate-400">
                講義プール: <strong className="text-slate-200">{lectureName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* モーダル本文 */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* 説明 & サンプル挿入 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-slate-300">
              <code>FlashcardContent[]</code>（<code>question</code> と <code>answer</code>）のJSONを貼り付けてください。
              <div className="text-[11px] text-slate-400 mt-0.5">
                ※ AIが中括弧 <code>{"{}"}</code> やカンマを誤っても、<code>question</code> と <code>answer</code> が交互に並んでいれば自動補正して読み込みます。
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleInsertSample}
                className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              >
                標準サンプル
              </button>
              <button
                type="button"
                onClick={handleInsertBrokenSample}
                className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 transition"
                title="ハルシネーションで括弧が崩れたサンプルの動作を試す"
              >
                破損JSONサンプル
              </button>
            </div>
          </div>

          {/* テキスト入力エリア */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <label className="font-semibold text-slate-300">
                AIの出力テキスト
              </label>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText("")}
                  className="text-slate-500 hover:text-rose-400 text-[11px]"
                >
                  クリア
                </button>
              )}
            </div>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`[\n  {\n    "question": "ここに問題文",\n    "answer": "ここに解答文"\n  }\n]`}
              className="w-full font-mono text-xs px-3.5 py-2.5 bg-slate-950 text-slate-100 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* バンドルID設定 */}
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
              className="w-full sm:w-52 px-2.5 py-1 text-xs font-mono bg-slate-950 text-indigo-300 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* パース結果インジケータ */}
          {parseResult && (
            <div className="space-y-3">
              {parseResult.success ? (
                <div className="space-y-2">
                  {/* 重複警告バナー */}
                  {isDuplicate && (
                    <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-xs text-amber-200 flex items-start space-x-2.5 animate-fadeIn">
                      <WarningIcon size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-amber-300">
                          ⚠️ 直前に追加した一括カードと全く同じ内容です
                        </div>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          二重追加を防止するため、このまま追加することはできません。内容を編集するか、別の出力を指定してください。
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-emerald-300 font-semibold">
                        <CheckIcon size={16} />
                        <span>{parseResult.cards.length} 件のカードを正常に認識しました</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200 border border-emerald-700/60">
                        {parseResult.source === "JSON"
                          ? "標準JSON形式"
                          : "ハルシネーション耐性スキャナー（自動復元）"}
                      </span>
                    </div>

                    {/* プレビュー一覧 */}
                    <div className="max-h-52 overflow-y-auto space-y-2 pt-1 pr-1">
                      {parseResult.cards.map((card, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs grid grid-cols-1 md:grid-cols-2 gap-2"
                        >
                          <div>
                            <span className="text-[10px] font-semibold text-indigo-400 block mb-0.5">
                              Q{idx + 1}:
                            </span>
                            <p className="text-slate-100 whitespace-pre-wrap">{card.question}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-emerald-400 block mb-0.5">
                              A{idx + 1}:
                            </span>
                            <p className="text-slate-200 whitespace-pre-wrap">{card.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2.5">
                  <WarningIcon size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-rose-200 mb-0.5">カードを読み込めませんでした</div>
                    <p className="text-[11px] leading-relaxed text-rose-300/90">
                      {parseResult.errorMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs text-slate-400 hover:text-white transition"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parseResult?.success || parseResult.cards.length === 0}
            className={`px-5 py-2 text-white text-xs font-semibold rounded-xl shadow-lg flex items-center space-x-2 transition cursor-pointer ${
              isDuplicate
                ? "bg-amber-700/80 hover:bg-amber-600 text-amber-100 shadow-amber-700/30"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
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
