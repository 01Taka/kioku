import React, { useState } from "react";

import { FlashcardContentSchema } from "../../types/schema";
import { EditIcon, XIcon } from "../icons";

interface CardEditModalProps {
  initialFront: string;
  initialBack: string;
  onSave: (front: string, back: string) => void;
  onClose: () => void;
}

export function CardEditModal({ initialFront, initialBack, onSave, onClose }: CardEditModalProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = FlashcardContentSchema.safeParse({ question: front, answer: back });
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "入力内容が不正です。");
      return;
    }
    setValidationError(null);
    onSave(result.data.question, result.data.answer);
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="flex items-center space-x-2 text-sm font-bold text-white">
            <EditIcon size={15} className="text-indigo-400" />
            <span>カードを編集</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XIcon size={16} />
          </button>
        </div>

        {validationError && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-400">
            ⚠️ {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 上に問題の入力フォーム */}
          <div>
            <label className="mb-1 block font-semibold text-slate-300">問題（表面）</label>
            <textarea
              rows={4}
              value={front}
              onChange={(e) => {
                setFront(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="問題を入力してください"
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-base text-white focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* 中部に答えの入力フォーム */}
          <div>
            <label className="mb-1 block font-semibold text-slate-300">答え（裏面）</label>
            <textarea
              rows={4}
              value={back}
              onChange={(e) => {
                setBack(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="解答・解説を入力してください"
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-base text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* 下に編集を保存ボタン */}
          <div className="flex justify-end space-x-2 border-t border-slate-800 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-3 py-1.5 text-slate-400 hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!front.trim() || !back.trim()}
              className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-50"
            >
              編集を保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
