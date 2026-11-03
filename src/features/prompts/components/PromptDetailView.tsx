import { useEffect, useMemo, useRef, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import type { PromptTemplate } from "../../types/schema";
import {
  assemblePrompt,
  parseTemplateSegments,
  type PromptVariableDefinition,
} from "../../utils/promptTemplateParser";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EditIcon,
} from "../icons";

interface PromptDetailViewProps {
  template: PromptTemplate;
  variableDefs: PromptVariableDefinition[];
  variableValues: Record<string, string>;
  onBack: () => void;
  onEdit: () => void;
  onCopySuccess: () => void;
}

export function PromptDetailView({
  template,
  variableDefs,
  variableValues,
  onBack,
  onEdit,
  onCopySuccess,
}: PromptDetailViewProps) {
  const { updatePromptTemplate } = useAppStore();

  // コピー成功 / 警告ステート
  const [copied, setCopied] = useState(false);
  const [copyWarning, setCopyWarning] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    };
  }, []);

  // セグメント解析（ストアの enabledLines を単一情報源として反映）
  const segments = useMemo(() => {
    return parseTemplateSegments(template.content, template.enabledLines);
  }, [template.content, template.enabledLines]);

  // 有効なセグメントID集合を segments から導出（二重ステート管理を排除）
  const activeSegmentIds = useMemo(() => {
    const set = new Set<string>();
    for (const seg of segments) {
      if (seg.isToggleable && seg.defaultEnabled) {
        set.add(seg.id);
      }
    }
    return set;
  }, [segments]);

  // トグル可能なセグメントの状態マップを構築してストアへ即時オートセーブ
  const saveToggleStates = (updater: (segId: string, current: boolean) => boolean) => {
    const nextEnabledLines: Record<string, boolean> = {};
    for (const seg of segments) {
      if (seg.isToggleable) {
        nextEnabledLines[seg.id] = updater(seg.id, seg.defaultEnabled);
      }
    }
    updatePromptTemplate(template.id, { enabledLines: nextEnabledLines });
  };

  const handleToggleSegment = (segId: string) => {
    saveToggleStates((id, current) => (id === segId ? !current : current));
  };

  const handleSelectAllSegments = () => {
    saveToggleStates(() => true);
  };

  const handleDeselectAllSegments = () => {
    saveToggleStates(() => false);
  };

  // 完成プロンプトの組み立て
  const finalPrompt = useMemo(() => {
    return assemblePrompt(segments, activeSegmentIds, variableValues);
  }, [segments, activeSegmentIds, variableValues]);

  // コピー処理
  const handleCopy = async () => {
    if (!finalPrompt.trim()) return;

    const missingRequired = variableDefs.filter(
      (v) => v.isRequired && (!variableValues[v.key] || !variableValues[v.key].trim()),
    );
    if (missingRequired.length > 0) {
      const names = missingRequired.map((v) => `{{${v.name}}}`).join("、");
      setCopyWarning(`必須項目（${names}）が未入力です`);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = window.setTimeout(() => setCopyWarning(null), 3000);
      return;
    }

    try {
      await navigator.clipboard.writeText(finalPrompt);
      setCopyWarning(null);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
      onCopySuccess();
    } catch (err) {
      console.error("コピー失敗:", err);
      setCopyWarning("コピーに失敗しました");
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = window.setTimeout(() => setCopyWarning(null), 2000);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* 上部ヘッダー: 「←」戻るボタンとテンプレートタイトル */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center space-x-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-700 bg-slate-800/90 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title="一覧に戻る"
            aria-label="一覧に戻る"
          >
            <ArrowLeftIcon size={18} />
          </button>

          <h1 className="truncate text-sm font-bold text-white sm:text-base">
            {template.name}
          </h1>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="flex flex-shrink-0 cursor-pointer items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
          title="テンプレート定義を編集"
        >
          <EditIcon size={13} />
          <span>編集</span>
        </button>
      </div>

      {/* メインスクロール領域 */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
        <div className="mx-auto flex w-full max-w-4xl flex-col space-y-4">
          {/* 説明文（ある場合） */}
          {template.description && (
            <p className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-3.5 py-2 text-xs leading-relaxed text-slate-400">
              {template.description}
            </p>
          )}

          {/* セクション: 命令の行単位・ブロック選択 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div>
                <h2 className="text-xs font-bold tracking-wider text-indigo-400 uppercase">
                  命令の行単位・ブロック選択
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  選択した行・ブロックは自動的に保存されます。
                </p>
              </div>

              <div className="flex items-center space-x-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAllSegments}
                  className="cursor-pointer text-slate-400 transition hover:text-indigo-300"
                >
                  全選択
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllSegments}
                  className="cursor-pointer text-slate-400 transition hover:text-rose-400"
                >
                  全解除
                </button>
              </div>
            </div>

            {/* セグメント一覧 */}
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/90 p-2 font-mono text-xs">
              {segments.map((seg) => {
                if (!seg.isToggleable) {
                  return (
                    <div key={seg.id} className="px-2 py-1 select-text">
                      <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
                        {seg.displayText}
                      </pre>
                    </div>
                  );
                }

                const isChecked = activeSegmentIds.has(seg.id);
                return (
                  <div
                    key={seg.id}
                    onClick={() => handleToggleSegment(seg.id)}
                    className={`group flex cursor-pointer items-start space-x-2.5 rounded px-2 py-1 transition hover:bg-slate-800/60 ${
                      isChecked
                        ? "text-slate-200"
                        : "text-slate-500 line-through opacity-40 hover:opacity-70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // 親divのonClickでハンドリング
                      className="mt-1 h-3.5 w-3.5 flex-shrink-0 cursor-pointer rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <div className="min-w-0 flex-1">
                      {seg.type === "CUSTOM_BLOCK" && (
                        <div className="mb-1">
                          <span className="inline-block rounded border border-indigo-500/30 bg-indigo-950/80 px-1.5 py-px font-sans text-[10px] text-indigo-300 not-italic no-underline">
                            {seg.title || "連動ブロック"}
                          </span>
                        </div>
                      )}
                      <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                        {seg.displayText}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* セクション: 完成プロンプト リアルタイムプレビュー & コピー */}
          <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-3.5 shadow-xl sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold tracking-wider text-indigo-300 uppercase">
                  完成プロンプト
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                  {finalPrompt.length} 文字
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {copyWarning && (
                  <span className="flex items-center space-x-1 text-xs text-rose-300">
                    <AlertCircleIcon size={13} className="flex-shrink-0 text-rose-400" />
                    <span>{copyWarning}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!finalPrompt.trim()}
                  className={`flex cursor-pointer items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                    copied
                      ? "bg-emerald-600 shadow-emerald-600/40"
                      : "bg-indigo-600 shadow-indigo-600/40 hover:bg-indigo-500"
                  }`}
                >
                  {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                  <span>{copied ? "コピーしました" : "プロンプトをコピー"}</span>
                </button>
              </div>
            </div>

            <div className="mt-2.5 max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
              {finalPrompt.trim() ? (
                <pre className="whitespace-pre-wrap">{finalPrompt}</pre>
              ) : (
                <span className="text-slate-600">
                  有効な命令行が選択されていないか、プロンプトが空です。
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
