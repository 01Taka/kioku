import { useMemo, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import type { PromptTemplate } from "../../types/schema";
import {
  assemblePrompt,
  extractTemplateVariables,
  parseTemplateSegments,
} from "../../utils/promptTemplateParser";
import {
  CheckIcon,
  ClipboardIcon,
  CopyIcon,
  EditIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  TrashIcon,
} from "../icons";
import { PromptTemplateEditModal } from "./PromptTemplateEditModal";

export function PromptManagerView() {
  const {
    promptTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    duplicatePromptTemplate,
    resetPresetPromptTemplates,
  } = useAppStore();

  // 選択中のテンプレートID (未選択なら最初のテンプレート)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return promptTemplates[0]?.id ?? "";
  });

  // 検索クエリ
  const [searchQuery, setSearchQuery] = useState("");

  // 変数入力値のステート: { [varName]: value }
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // セグメント有効フラグ: Set<segmentId>
  const [activeSegmentIds, setActiveSegmentIds] = useState<Set<string>>(new Set());

  // モーダル状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  // コピー成功フィードバック
  const [copied, setCopied] = useState(false);

  // 選択中テンプレート
  const currentTemplate = useMemo(() => {
    return promptTemplates.find((t) => t.id === selectedTemplateId) ?? promptTemplates[0] ?? null;
  }, [promptTemplates, selectedTemplateId]);

  // フィルタリングされたテンプレート一覧
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return promptTemplates;
    const q = searchQuery.toLowerCase();
    return promptTemplates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [promptTemplates, searchQuery]);

  // 選択中のテンプレートのセグメント解析
  const segments = useMemo(() => {
    if (!currentTemplate) return [];
    return parseTemplateSegments(currentTemplate.content, currentTemplate.enabledLines);
  }, [currentTemplate]);

  // 選択中テンプレートから抽出された変数一覧
  const templateVariables = useMemo(() => {
    if (!currentTemplate) return [];
    return extractTemplateVariables(currentTemplate.content);
  }, [currentTemplate]);

  // テンプレート切り替え時にセグメントの初期ON/OFF状態を同期
  // （ユーザーが画面上でトグルした状態を管理）
  const [lastSyncedTemplateId, setLastSyncedTemplateId] = useState<string | null>(null);
  if (currentTemplate && currentTemplate.id !== lastSyncedTemplateId) {
    setLastSyncedTemplateId(currentTemplate.id);
    const initialActive = new Set<string>();
    for (const seg of segments) {
      if (seg.defaultEnabled) {
        initialActive.add(seg.id);
      }
    }
    setActiveSegmentIds(initialActive);
  }

  // 最終プロンプトのリアルタイム組み立て
  const finalPrompt = useMemo(() => {
    if (!currentTemplate) return "";
    return assemblePrompt(segments, activeSegmentIds, variableValues);
  }, [currentTemplate, segments, activeSegmentIds, variableValues]);

  // セグメントのトグル
  const handleToggleSegment = (segmentId: string) => {
    setActiveSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  // 全選択 / 全解除
  const handleSelectAllSegments = () => {
    setActiveSegmentIds(new Set(segments.map((s) => s.id)));
  };

  const handleDeselectAllSegments = () => {
    setActiveSegmentIds(new Set());
  };

  // クリップボードへコピー
  const handleCopyPrompt = async () => {
    if (!finalPrompt.trim()) return;
    try {
      await navigator.clipboard.writeText(finalPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("クリップボードへのコピーに失敗しました:", err);
    }
  };

  // テンプレート削除
  const handleDeleteTemplate = (id: string, name: string) => {
    if (confirm(`テンプレート「${name}」を削除してもよろしいですか？`)) {
      deletePromptTemplate(id);
      if (selectedTemplateId === id) {
        const remaining = promptTemplates.filter((t) => t.id !== id);
        if (remaining[0]) {
          setSelectedTemplateId(remaining[0].id);
        }
      }
    }
  };

  // テンプレート複製
  const handleDuplicateTemplate = (id: string) => {
    const duplicated = duplicatePromptTemplate(id);
    setSelectedTemplateId(duplicated.id);
  };

  // プリセット初期化
  const handleResetPresets = () => {
    if (
      confirm(
        "標準搭載のプリセットテンプレートを初期状態に戻しますか？\n（独自に作成・複製したユーザーテンプレートは保持されます）",
      )
    ) {
      resetPresetPromptTemplates();
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* 画面トップバー */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-2.5">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2 text-indigo-400">
            <SparklesIcon size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white sm:text-lg">プロンプトマネージャー</h1>
            <p className="text-xs text-slate-400">
              AIへの問題生成プロンプトの調整・行単位カスタマイズ・ワンクリックコピー
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingTemplate(null);
            setIsEditModalOpen(true);
          }}
          className="flex cursor-pointer items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500"
        >
          <PlusIcon size={16} />
          <span>新規作成</span>
        </button>
      </div>

      {/* 2カラムレイアウトコンテナ */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* 左カラム: テンプレート一覧 */}
        <aside className="flex w-full flex-shrink-0 flex-col border-b border-slate-800 bg-slate-900/50 md:w-80 md:border-r md:border-b-0">
          {/* 検索バー */}
          <div className="p-3 border-b border-slate-800/80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="テンプレートを検索..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* テンプレート一覧リスト */}
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                該当するテンプレートがありません
              </div>
            ) : (
              filteredTemplates.map((tpl) => {
                const isSelected = currentTemplate?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`group flex w-full cursor-pointer flex-col rounded-xl p-3 text-left transition ${
                      isSelected
                        ? "border border-indigo-500/40 bg-indigo-600/20 text-white shadow-sm"
                        : "border border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs truncate">{tpl.name}</span>
                      {tpl.isPreset ? (
                        <span className="rounded bg-indigo-950/80 border border-indigo-500/30 px-1.5 py-0.2 text-[9px] font-medium text-indigo-300 flex-shrink-0">
                          標準
                        </span>
                      ) : (
                        <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[9px] font-medium text-slate-400 flex-shrink-0">
                          独自
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-400 leading-snug">
                        {tpl.description}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* 左カラムフッター: プリセット初期化 */}
          <div className="border-t border-slate-800/80 p-2.5">
            <button
              type="button"
              onClick={handleResetPresets}
              className="flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-lg py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              title="標準搭載のプリセットテンプレートを再読み込み"
            >
              <RefreshCwIcon size={13} />
              <span>プリセットを初期状態に復元</span>
            </button>
          </div>
        </aside>

        {/* 右カラム: プロンプト生成・カスタマイズペイン */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-slate-950 p-4 sm:p-6">
          {currentTemplate ? (
            <div className="mx-auto flex w-full max-w-4xl flex-col space-y-5">
              {/* テンプレートタイトル・操作ヘッダー */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-white sm:text-lg">
                      {currentTemplate.name}
                    </h2>
                    {currentTemplate.isPreset ? (
                      <span className="rounded-full border border-indigo-500/40 bg-indigo-950/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                        プリセット
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        ユーザー作成
                      </span>
                    )}
                  </div>
                  {currentTemplate.description && (
                    <p className="mt-1 text-xs text-slate-400">{currentTemplate.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(currentTemplate);
                      setIsEditModalOpen(true);
                    }}
                    className="flex cursor-pointer items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    title="テンプレート定義を編集"
                  >
                    <EditIcon size={14} />
                    <span>編集</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicateTemplate(currentTemplate.id)}
                    className="flex cursor-pointer items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    title="このテンプレートを複製してカスタマイズ"
                  >
                    <CopyIcon size={14} />
                    <span>複製</span>
                  </button>

                  {!currentTemplate.isPreset && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteTemplate(currentTemplate.id, currentTemplate.name)
                      }
                      className="flex cursor-pointer items-center space-x-1.5 rounded-lg border border-rose-900/50 bg-rose-950/40 px-2.5 py-1.5 text-xs text-rose-300 transition hover:bg-rose-900/60 hover:text-rose-100"
                      title="このテンプレートを削除"
                    >
                      <TrashIcon size={14} />
                      <span>削除</span>
                    </button>
                  )}
                </div>
              </div>

              {/* セクション 1: 変数入力フォーム */}
              {templateVariables.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                  <h3 className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                    <span>1. 変数の入力（プレースホルダーへの代入）</span>
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    入力した内容は、リアルタイムでプロンプト本文に差し込まれます。
                  </p>

                  <div className="mt-3.5 space-y-3">
                    {templateVariables.map((vName) => {
                      const isMultiLine =
                        vName.includes("テキスト") ||
                        vName.includes("リスト") ||
                        vName.includes("問題") ||
                        vName.includes("一覧");

                      return (
                        <div key={vName}>
                          <label className="block font-mono text-xs font-semibold text-indigo-300">
                            {`{{${vName}}}`}
                          </label>
                          {isMultiLine ? (
                            <textarea
                              rows={3}
                              value={variableValues[vName] ?? ""}
                              onChange={(e) =>
                                setVariableValues((prev) => ({ ...prev, [vName]: e.target.value }))
                              }
                              placeholder={`${vName}を入力または貼り付け...`}
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <input
                              type="text"
                              value={variableValues[vName] ?? ""}
                              onChange={(e) =>
                                setVariableValues((prev) => ({ ...prev, [vName]: e.target.value }))
                              }
                              placeholder={`${vName}を入力...`}
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* セクション 2: 命令行・ブロックのトグル調整 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                      <span>2. 命令の行単位・ブロック選択</span>
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                      今回の生成に含めたい行・ブロックのチェックを入れてください。
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

                <div className="mt-3.5 space-y-2">
                  {segments.map((seg) => {
                    const isChecked = activeSegmentIds.has(seg.id);
                    return (
                      <div
                        key={seg.id}
                        onClick={() => handleToggleSegment(seg.id)}
                        className={`flex cursor-pointer items-start space-x-3 rounded-xl border p-2.5 transition ${
                          isChecked
                            ? "border-slate-700 bg-slate-950/80 text-slate-200"
                            : "border-slate-800/60 bg-slate-950/30 text-slate-500 line-through opacity-60 hover:opacity-80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // 親divのクリックでハンドリング
                          className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                        />
                        <div className="flex-1 overflow-hidden">
                          {seg.type !== "LINE" && (
                            <span className="mb-1 inline-block rounded bg-indigo-950 border border-indigo-500/30 px-1.5 py-0.2 font-mono text-[10px] text-indigo-300">
                              {seg.title || "連動ブロック"}
                            </span>
                          )}
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {seg.displayText}
                          </pre>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* セクション 3: 完成プロンプト リアルタイムプレビュー & ワンクリックコピー */}
              <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-4 shadow-xl sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      3. 完成プロンプト
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                      {finalPrompt.length} 文字
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    disabled={!finalPrompt.trim()}
                    className={`flex cursor-pointer items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      copied
                        ? "bg-emerald-600 shadow-emerald-600/30"
                        : "bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500"
                    }`}
                  >
                    {copied ? (
                      <>
                        <CheckIcon size={16} />
                        <span>コピーしました！</span>
                      </>
                    ) : (
                      <>
                        <ClipboardIcon size={16} />
                        <span>完成プロンプトをコピー</span>
                      </>
                    )}
                  </button>
                </div>

                {/* プレビューテキスト表示 */}
                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-slate-200">
                  {finalPrompt.trim() ? (
                    <pre className="whitespace-pre-wrap">{finalPrompt}</pre>
                  ) : (
                    <span className="text-slate-600">
                      有効な命令行が選択されていないか、プロンプトが空です。
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    💡 コピーしたテキストを ChatGPT や Claude, Gemini 等の AI に送信してください。
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              テンプレートが選択されていません
            </div>
          )}
        </main>
      </div>

      {/* 編集・新規作成モーダル */}
      {isEditModalOpen && (
        <PromptTemplateEditModal
          template={editingTemplate}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTemplate(null);
          }}
          onSave={({ name, description, content }) => {
            if (editingTemplate) {
              updatePromptTemplate(editingTemplate.id, {
                name,
                description,
                content,
              });
            } else {
              const newTpl = addPromptTemplate({
                name,
                description,
                content,
              });
              setSelectedTemplateId(newTpl.id);
            }
          }}
        />
      )}
    </div>
  );
}
