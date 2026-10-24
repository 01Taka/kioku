import React, { useState } from "react";
import { XIcon, EditIcon } from "../icons";

interface CardEditModalProps {
  initialFront: string;
  initialBack: string;
  onSave: (front: string, back: string) => void;
  onClose: () => void;
}

export function CardEditModal({
  initialFront,
  initialBack,
  onSave,
  onClose,
}: CardEditModalProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    onSave(front.trim(), back.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-60 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <EditIcon size={15} className="text-indigo-400" />
            <span>カードを編集</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 上に問題の入力フォーム */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              問題（表面）
            </label>
            <textarea
              rows={4}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="問題を入力してください"
              className="w-full px-3 py-2 bg-slate-950 text-white border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 resize-none"
              autoFocus
            />
          </div>

          {/* 中部に答えの入力フォーム */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              答え（裏面）
            </label>
            <textarea
              rows={4}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="解答・解説を入力してください"
              className="w-full px-3 py-2 bg-slate-950 text-white border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* 下に編集を保存ボタン */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!front.trim() || !back.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl shadow cursor-pointer"
            >
              編集を保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
