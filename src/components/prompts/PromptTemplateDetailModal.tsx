import type { PromptTemplate } from "../../types/schema";
import { extractTemplateVariableDefinitions } from "../../utils/promptTemplateParser";
import { EditIcon, InfoIcon, XIcon } from "../icons";

interface PromptTemplateDetailModalProps {
  template: PromptTemplate;
  onClose: () => void;
  onEdit: () => void;
}

export function PromptTemplateDetailModal({
  template,
  onClose,
  onEdit,
}: PromptTemplateDetailModalProps) {
  const variableDefs = extractTemplateVariableDefinitions(template.content);

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 p-4 sm:p-5">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-400">
              <InfoIcon size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">{template.name}</h2>
              </div>
              <p className="text-xs text-slate-400">テンプレートの詳細・構成</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* 本文エリア */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          {/* 概要 */}
          <div>
            <h3 className="font-semibold text-slate-300">概要</h3>
            <p className="mt-1 rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-300 leading-relaxed">
              {template.description || "（説明はありません）"}
            </p>
          </div>

          {/* 含まれる変数 */}
          {variableDefs.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-300">
                含まれる変数（{variableDefs.length}個）
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {variableDefs.map((v) => (
                  <span
                    key={v.key}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-indigo-300"
                  >
                    <span>{`{{${v.name}}}`}</span>
                    {v.isRequired && (
                      <span className="rounded border border-rose-500/40 bg-rose-950/80 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                        必須
                      </span>
                    )}
                    {v.fallback && (
                      <span className="rounded bg-slate-800/90 px-1 py-0.2 text-[9px] text-slate-400">
                        既定: {v.fallback}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* プロンプト本文の構成 */}
          <div>
            <h3 className="font-semibold text-slate-300">プロンプト本文（構成）</h3>
            <div className="mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-slate-200">
              <pre className="whitespace-pre-wrap">{template.content}</pre>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 p-4 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-400 transition hover:text-white"
          >
            閉じる
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="flex cursor-pointer items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500"
          >
            <EditIcon size={14} />
            <span>このテンプレートを編集</span>
          </button>
        </div>
      </div>
    </div>
  );
}
