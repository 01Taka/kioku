import React, { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  ClipboardIcon,
  CopyIcon,
  SparklesIcon,
  XIcon,
} from "@/shared/components/icons";
import type { PromptTemplate } from "@/shared/types/schema";

import generateRulesContent from "../../../templates/prompts/rules/generate-rules.md?raw";
import { parseTemplateClipboardText } from "../utils/promptTemplateParser";

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
  const [isRulesCopied, setIsRulesCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const rulesCopyTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      if (rulesCopyTimerRef.current) window.clearTimeout(rulesCopyTimerRef.current);
    };
  }, []);

  // プロンプト本文の入力に合わせて高さを自動拡張し、内部スクロール（個別スライド）を防止
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(260, textareaRef.current.scrollHeight)}px`;
    }
  }, [content]);

  // クリップボードから本文（および構成に応じた名前・概要）を取り込む
  const handleImportFromClipboard = async () => {
    setError(null);
    setImportNotice(null);
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error("ブラウザのクリップボードAPIが利用できません。");
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setError("クリップボードが空です。テキストをコピーしてから再度お試しください。");
        return;
      }

      const parsed = parseTemplateClipboardText(text);

      if (parsed.name) {
        setName(parsed.name);
      }
      if (parsed.description) {
        setDescription(parsed.description);
      }
      setContent(parsed.content);

      if (parsed.isStructured && (parsed.name || parsed.description)) {
        setImportNotice("✨ クリップボードからテンプレート名・概要・本文を自動取り込みしました！");
      } else {
        setImportNotice("📋 クリップボードの内容を本文に取り込みました！");
      }
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setImportNotice(null), 3500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "クリップボードの読み取りに失敗しました。アクセス許可をご確認ください。",
      );
    }
  };

  // generate-rules.md の内容をクリップボードにコピー
  const handleCopyRules = async () => {
    try {
      await navigator.clipboard.writeText(generateRulesContent);
      setIsRulesCopied(true);
      if (rulesCopyTimerRef.current) window.clearTimeout(rulesCopyTimerRef.current);
      rulesCopyTimerRef.current = window.setTimeout(() => setIsRulesCopied(false), 2000);
    } catch (err) {
      console.error("ルールコピー失敗:", err);
      setError("ルールのコピーに失敗しました。");
    }
  };

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
            {/* 一番上: 本文取り込みボタン（説明文は撤廃し右寄せのすっきりしたボタンに） */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleImportFromClipboard}
                className="flex cursor-pointer items-center space-x-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 shadow-sm transition hover:bg-indigo-900/60 hover:text-white"
                title="クリップボードのテキストを一括取り込み"
              >
                <ClipboardIcon size={15} />
                <span>クリップボードから本文取り込み</span>
              </button>
            </div>

            {importNotice && (
              <div className="animate-fadeIn rounded-xl border border-emerald-800/80 bg-emerald-950/60 p-2.5 text-xs text-emerald-300">
                {importNotice}
              </div>
            )}

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
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-base text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none sm:text-sm"
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
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-base text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none sm:text-xs"
              />
            </div>

            {/* プロンプト本文 */}
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  プロンプト本文 <span className="text-rose-400">*</span>
                </label>

                {/* generate-rules.md コピーボタン */}
                <button
                  type="button"
                  onClick={handleCopyRules}
                  className={`flex cursor-pointer items-center space-x-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    isRulesCopied
                      ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                      : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-700 hover:text-white"
                  }`}
                  title="AIプロンプト作成用のルール（generate-rules.md）をコピー"
                >
                  {isRulesCopied ? (
                    <>
                      <CheckIcon size={13} className="text-emerald-400" />
                      <span>ルールをコピーしました</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon size={13} />
                      <span>ルールをコピー</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setError(null);
                }}
                placeholder="プロンプト本文を入力してください。{{教材テキスト}} や {{問題数}}、末尾の ```vars メタデータなどが使用できます。"
                className="mt-1.5 w-full resize-none overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-base leading-relaxed text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none sm:text-xs"
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
