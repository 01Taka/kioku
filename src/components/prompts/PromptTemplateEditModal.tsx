import React, { useState } from "react";

import type { PromptTemplate } from "../../types/schema";
import { CheckIcon, SparklesIcon, XIcon } from "../icons";

interface PromptTemplateEditModalProps {
  template?: PromptTemplate | null; // null/undefined の場合は新規作成
  onClose: () => void;
  onSave: (data: { name: string; description: string; content: string }) => void;
}

export function PromptTemplateEditModal({
  template,
  onClose,
  onSave,
}: PromptTemplateEditModalProps) {
  const isEditing = !!template;
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("テンプレート名を入力してください。");
      return;
    }
    if (!content.trim()) {
      setError("プロンプト本文を入力してください。");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      content: content.trim(),
    });
    onClose();
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 p-4 sm:p-5">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-400">
              <SparklesIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? "プロンプトテンプレートの編集" : "新規プロンプトテンプレートの作成"}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `「${template.name}」をカスタマイズします`
                  : "独自のプロンプトテンプレートを追加します"}
              </p>
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

        {/* フォーム本文 */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {error && (
              <div className="rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* テンプレート名 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                テンプレート名 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="例: 重要用語の一問一答生成"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* 説明 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">説明（概要）</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 教材のキーワード群から定義問題を自動生成します"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* テンプレート記法ガイド */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5 text-xs text-slate-300">
              <span className="font-semibold text-indigo-300">💡 テンプレートの書き方・連動ルール:</span>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300/90 list-disc list-inside">
                <li>
                  <code className="rounded bg-slate-800 px-1 py-0.5 text-indigo-200 font-mono">{"{{変数名}}"}</code>
                  : 生成画面で入力フォームが自動作成され、入力値に置換されます。
                </li>
                <li>
                  <span className="font-medium text-slate-200">行ごとのトグル</span>:
                  空行以外の各行は、生成画面で個別に含める/除外を切り替えられます。
                </li>
                <li>
                  <code className="rounded bg-slate-800 px-1 py-0.5 text-indigo-200 font-mono">[BLOCK:タイトル]...[/BLOCK]</code>
                  : 複数行をひとまとめの連動ブロックとして扱います。
                </li>
                <li>
                  <code className="rounded bg-slate-800 px-1 py-0.5 text-indigo-200 font-mono">```...```</code>
                  : コードブロックは自動的に1つのまとまりとして連動します。
                </li>
              </ul>
            </div>

            {/* プロンプト本文 */}
            <div className="flex flex-1 flex-col">
              <label className="block text-xs font-semibold text-slate-300">
                プロンプト本文 <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setError(null);
                }}
                rows={12}
                placeholder="プロンプト本文を入力してください。{{教材テキスト}} や [BLOCK:指示] ... [/BLOCK] が使用できます。"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* フッター */}
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 p-4 sm:p-5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex cursor-pointer items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
            >
              <CheckIcon size={16} />
              <span>{isEditing ? "変更を保存" : "テンプレートを作成"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
