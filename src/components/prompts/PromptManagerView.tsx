import { useEffect, useState } from "react";

import { useAppStore } from "../../store/useAppStore";
import type { PromptTemplate } from "../../types/schema";
import {
  assemblePrompt,
  extractTemplateVariableDefinitions,
  parseTemplateSegments,
} from "../../utils/promptTemplateParser";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  EditIcon,
  InfoIcon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
  XIcon,
} from "../icons";
import { PromptDetailView } from "./PromptDetailView";
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

  // 画面モード: "list" (一覧・アコーディオン) | { type: "detail", templateId: string } (詳細・新ページ)
  const [activeView, setActiveView] = useState<
    { type: "list" } | { type: "detail"; templateId: string }
  >({ type: "list" });

  // アコーディオン展開中のテンプレートID（排他方式: 1つだけ展開）
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // 三点リーダーメニューが開いているテンプレートID
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null);

  // 外側クリック時に三点リーダーメニューを閉じる
  useEffect(() => {
    if (!menuTemplateId) return;
    const handleOutsideClick = () => setMenuTemplateId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [menuTemplateId]);

  // コピー成功フラグ（テンプレートIDごと）
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // コピー警告メッセージ（テンプレートIDごと）
  const [copyWarningMap, setCopyWarningMap] = useState<Record<string, string>>({});

  // 編集モーダル状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  // 変数入力値のステート: { [varKey]: value }
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const LAST_VARS_STORAGE_KEY = "kioku-last-prompt-variables";

  // ローカルストレージに記憶されている直近の変数群を取得
  const getStoredVariables = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(LAST_VARS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  };

  // 変数入力の更新（ローカルストレージにも自動記憶）
  const handleVariableChange = (varKey: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [varKey]: value }));
    if (value.trim()) {
      try {
        const stored = getStoredVariables();
        stored[varKey] = value;
        localStorage.setItem(LAST_VARS_STORAGE_KEY, JSON.stringify(stored));
      } catch (err) {
        console.error("変数保存エラー:", err);
      }
    }
  };

  // 個別変数のクリア
  const handleClearVariable = (varKey: string) => {
    setVariableValues((prev) => {
      const next = { ...prev };
      delete next[varKey];
      return next;
    });
  };

  // 前回入力した変数を一括代入
  const handleRestoreVariablesForTemplate = (tpl: PromptTemplate) => {
    const defs = extractTemplateVariableDefinitions(tpl.content);
    const stored = getStoredVariables();
    setVariableValues((prev) => {
      const next = { ...prev };
      for (const def of defs) {
        if (stored[def.key]) {
          next[def.key] = stored[def.key];
        }
      }
      return next;
    });
  };

  // テンプレート内のすべての変数をクリア
  const handleClearAllVariablesForTemplate = (tpl: PromptTemplate) => {
    const defs = extractTemplateVariableDefinitions(tpl.content);
    setVariableValues((prev) => {
      const next = { ...prev };
      for (const def of defs) {
        delete next[def.key];
      }
      return next;
    });
  };

  // テンプレート複製
  const handleDuplicateTemplate = (id: string) => {
    const duplicated = duplicatePromptTemplate(id);
    setExpandedTemplateId(duplicated.id);
  };

  // テンプレート削除
  const handleDeleteTemplate = (id: string, name: string) => {
    if (confirm(`テンプレート「${name}」を削除してもよろしいですか？`)) {
      deletePromptTemplate(id);
      if (expandedTemplateId === id) {
        setExpandedTemplateId(null);
      }
    }
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

  // プロンプトを組み立ててクリップボードにコピー
  const handleCopyPrompt = async (tpl: PromptTemplate) => {
    const defs = extractTemplateVariableDefinitions(tpl.content);

    // 必須変数の未入力チェック（フォールバックがなく、セクション見出しでもない変数）
    const missingRequired = defs.filter(
      (v) => v.isRequired && (!variableValues[v.key] || !variableValues[v.key].trim()),
    );

    if (missingRequired.length > 0) {
      // 未入力の必須変数がある場合、アコーディオンを自動展開して警告を表示
      setExpandedTemplateId(tpl.id);
      const names = missingRequired.map((v) => `{{${v.name}}}`).join("、");
      setCopyWarningMap((prev) => ({
        ...prev,
        [tpl.id]: `必須項目（${names}）を入力してください`,
      }));
      setTimeout(() => {
        setCopyWarningMap((prev) => {
          const next = { ...prev };
          delete next[tpl.id];
          return next;
        });
      }, 3000);
      return;
    }

    const segments = parseTemplateSegments(tpl.content, tpl.enabledLines);
    const activeIds = new Set(segments.filter((s) => s.defaultEnabled).map((s) => s.id));
    const text = assemblePrompt(segments, activeIds, variableValues);

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(tpl.id);
      setTimeout(() => setCopiedId(null), 1200);

      // コピー完了時に自動ですべてクリア
      setVariableValues((prev) => {
        const next = { ...prev };
        for (const def of defs) {
          delete next[def.key];
        }
        return next;
      });
    } catch (err) {
      console.error("コピー失敗:", err);
      setCopyWarningMap((prev) => ({
        ...prev,
        [tpl.id]: "コピーに失敗しました",
      }));
      setTimeout(() => {
        setCopyWarningMap((prev) => {
          const next = { ...prev };
          delete next[tpl.id];
          return next;
        });
      }, 2000);
    }
  };

  // 詳細画面（新ページ）表示中なら PromptDetailView を全画面レンダリング
  if (activeView.type === "detail") {
    const detailTpl = promptTemplates.find((t) => t.id === activeView.templateId);
    if (detailTpl) {
      return (
        <PromptDetailView
          template={detailTpl}
          variableValues={variableValues}
          onBack={() => setActiveView({ type: "list" })}
          onEdit={() => {
            setEditingTemplate(detailTpl);
            setIsEditModalOpen(true);
          }}
        />
      );
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* メイン最上部ヘッダー */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-2 sm:px-5 sm:py-2.5">
        <h1 className="text-sm font-bold text-white sm:text-base">プロンプト</h1>

        <button
          type="button"
          onClick={() => {
            setEditingTemplate(null);
            setIsEditModalOpen(true);
          }}
          className="flex cursor-pointer items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
          title="新しいプロンプトテンプレートを作成"
        >
          <PlusIcon size={14} />
          <span>新規作成</span>
        </button>
      </div>

      {/* テンプレート一覧（アコーディオンリスト） */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col space-y-1.5">
          {promptTemplates.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              テンプレートがありません。「新規作成」から作成してください。
            </div>
          ) : (
            promptTemplates.map((tpl) => {
              const isExpanded = expandedTemplateId === tpl.id;
              const defs = extractTemplateVariableDefinitions(tpl.content);
              const isCopied = copiedId === tpl.id;
              const copyWarning = copyWarningMap[tpl.id];

              // 直近記憶の変数がこのテンプレートに適用可能か
              const stored = getStoredVariables();
              const hasRestorable = defs.some(
                (d) => stored[d.key] && stored[d.key] !== (variableValues[d.key] ?? ""),
              );

              // すべての変数が入力済みか
              const isAllFilled =
                defs.length > 0 &&
                defs.every((d) => (variableValues[d.key] ?? "").trim().length > 0);

              return (
                <div
                  key={tpl.id}
                  className={`rounded-xl border transition-colors ${
                    menuTemplateId === tpl.id ? "relative z-30" : "relative z-0"
                  } ${
                    isExpanded
                      ? "border-indigo-500/50 bg-slate-900/90 shadow-lg"
                      : "border-slate-800/90 bg-slate-900/50 hover:border-slate-700/80 hover:bg-slate-900/70"
                  }`}
                >
                  {/* アコーディオンヘッダー行: クリックで開閉（ボタン等以外） */}
                  <div
                    onClick={() => {
                      setExpandedTemplateId(isExpanded ? null : tpl.id);
                      setMenuTemplateId(null);
                    }}
                    className={`flex cursor-pointer items-center justify-between px-3 py-2 select-none sm:px-3.5 ${
                      isExpanded ? "rounded-t-xl" : "rounded-xl"
                    }`}
                  >
                    {/* 左側: 開閉アイコン + タイトル */}
                    <div className="flex items-center space-x-2 min-w-0 pr-2">
                      <span className="text-slate-400">
                        {isExpanded ? (
                          <ChevronDownIcon size={16} />
                        ) : (
                          <ChevronRightIcon size={16} />
                        )}
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-100 sm:text-sm">
                        {tpl.name}
                      </span>
                    </div>

                    {/* 右側: コピーボタン + 三点リーダー */}
                    <div
                      className="flex flex-shrink-0 items-center space-x-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* コピーボタン（省スペースな正方形アイコンボタン・タップ判定32px確保） */}
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(tpl)}
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition active:scale-95 ${
                          isCopied
                            ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                            : "border-slate-700 bg-slate-800/90 text-slate-200 hover:border-indigo-500/50 hover:bg-slate-700 hover:text-white"
                        }`}
                        title={isCopied ? "コピーしました" : "プロンプトをコピー"}
                        aria-label="プロンプトをコピー"
                      >
                        {isCopied ? (
                          <CheckIcon size={16} className="text-emerald-400" />
                        ) : (
                          <CopyIcon size={16} />
                        )}
                      </button>

                      {/* 三点リーダー */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuTemplateId(menuTemplateId === tpl.id ? null : tpl.id)
                          }
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200"
                          title="メニュー"
                          aria-label="メニュー"
                        >
                          <MoreVerticalIcon size={16} />
                        </button>

                        {/* 三点リーダードロップダウン */}
                        {menuTemplateId === tpl.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="animate-fadeIn absolute right-0 top-full mt-1 z-50 w-32 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 text-xs shadow-2xl backdrop-blur-md"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuTemplateId(null);
                                setActiveView({ type: "detail", templateId: tpl.id });
                              }}
                              className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-slate-200 transition hover:bg-slate-800 hover:text-white"
                            >
                              <InfoIcon size={13} />
                              <span>詳細</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuTemplateId(null);
                                setEditingTemplate(tpl);
                                setIsEditModalOpen(true);
                              }}
                              className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-slate-200 transition hover:bg-slate-800 hover:text-white"
                            >
                              <EditIcon size={13} />
                              <span>編集</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuTemplateId(null);
                                handleDuplicateTemplate(tpl.id);
                              }}
                              className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-slate-200 transition hover:bg-slate-800 hover:text-white"
                            >
                              <CopyIcon size={13} />
                              <span>複製</span>
                            </button>

                            {!tpl.isPreset && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuTemplateId(null);
                                  handleDeleteTemplate(tpl.id, tpl.name);
                                }}
                                className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-rose-400 transition hover:bg-rose-950/50 hover:text-rose-300"
                              >
                                <TrashIcon size={13} />
                                <span>削除</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* アコーディオンボディ: 展開時に説明文と変数入力フォームを表示 */}
                  {isExpanded && (
                    <div className="rounded-b-xl border-t border-slate-800/80 bg-slate-950/50 px-3 py-2.5 sm:px-4 sm:py-3">
                      {/* 説明文 */}
                      {tpl.description && (
                        <p className="mb-2.5 text-xs text-slate-400 leading-relaxed">
                          {tpl.description}
                        </p>
                      )}

                      {/* 変数入力フォーム */}
                      {defs.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                              変数の入力
                            </span>

                            {isAllFilled ? (
                              <button
                                type="button"
                                onClick={() => handleClearAllVariablesForTemplate(tpl)}
                                className="flex cursor-pointer items-center space-x-1 rounded border border-rose-900/40 bg-rose-950/40 px-2 py-0.5 text-[10px] text-rose-300 transition hover:bg-rose-900/60 hover:text-rose-100"
                                title="すべての変数の入力をクリア"
                              >
                                <TrashIcon size={10} />
                                <span>すべてクリア</span>
                              </button>
                            ) : hasRestorable ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreVariablesForTemplate(tpl)}
                                className="flex cursor-pointer items-center space-x-1 rounded border border-indigo-500/30 bg-indigo-950/60 px-2 py-0.5 text-[10px] text-indigo-300 transition hover:bg-indigo-900/80 hover:text-white"
                                title="前回の入力値を一括適用"
                              >
                                <RefreshCwIcon size={10} />
                                <span>前回の値を一括入力</span>
                              </button>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            {defs.map((def) => {
                              const val = variableValues[def.key] ?? "";
                              const lineCount = Math.min(
                                4,
                                Math.max(1, val.split("\n").length),
                              );
                              const isMissingRequired = def.isRequired && !val.trim();

                              return (
                                <div key={def.key} className="space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1.5">
                                      <label className="font-mono text-xs font-semibold text-indigo-300">
                                        {`{{${def.name}}}`}
                                      </label>
                                      {def.isRequired && (
                                        <span className="rounded border border-rose-500/40 bg-rose-950/60 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                                          必須
                                        </span>
                                      )}
                                      {def.fallback && (
                                        <span className="rounded bg-slate-800/90 px-1 py-0.2 text-[9px] text-slate-400">
                                          既定: {def.fallback}
                                        </span>
                                      )}
                                    </div>
                                    {val && (
                                      <button
                                        type="button"
                                        onClick={() => handleClearVariable(def.key)}
                                        className="flex cursor-pointer items-center space-x-0.5 rounded px-1 py-0.2 text-[10px] text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                                        title="クリア"
                                      >
                                        <XIcon size={11} />
                                        <span>クリア</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* iOS自動拡大防止のため text-base (16px) を適用 */}
                                  <textarea
                                    rows={lineCount}
                                    value={val}
                                    onChange={(e) =>
                                      handleVariableChange(def.key, e.target.value)
                                    }
                                    placeholder={
                                      def.fallback
                                        ? `未入力時は「${def.fallback}」を使用`
                                        : `${def.name}を入力...`
                                    }
                                    className={`w-full resize-none overflow-y-auto rounded-lg border bg-slate-950 px-2.5 py-1.5 font-mono text-base leading-relaxed text-slate-100 transition-[height] duration-150 focus:outline-none sm:text-xs ${
                                      isMissingRequired
                                        ? "border-rose-800/80 placeholder-rose-700/60 focus:border-rose-500"
                                        : "border-slate-700 placeholder-slate-600 focus:border-indigo-500"
                                    }`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="py-1 text-[11px] text-slate-500">
                          このテンプレートには入力変数がありません。右上のコピーボタンからそのまま利用できます。
                        </p>
                      )}

                      {/* 警告メッセージ表示 */}
                      {copyWarning && (
                        <div className="animate-fadeIn mt-2 flex items-center space-x-1.5 rounded-lg border border-rose-500/40 bg-rose-950/70 px-2.5 py-1 text-xs text-rose-300">
                          <AlertCircleIcon size={13} className="text-rose-400 flex-shrink-0" />
                          <span>{copyWarning}</span>
                        </div>
                      )}

                      {/* フォーム下部のコンパクトコピーボタン */}
                      {defs.length > 0 && (
                        <div className="mt-2.5 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(tpl)}
                            className={`flex cursor-pointer items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow transition active:scale-95 ${
                              isCopied
                                ? "bg-emerald-600 shadow-emerald-600/40"
                                : "bg-indigo-600 shadow-indigo-600/40 hover:bg-indigo-500"
                            }`}
                          >
                            {isCopied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                            <span>{isCopied ? "コピーしました" : "プロンプトをコピー"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* 最下部: プリセット復元リンク */}
          <div className="pt-3 pb-6 text-center">
            <button
              type="button"
              onClick={handleResetPresets}
              className="inline-flex cursor-pointer items-center space-x-1 text-[11px] text-slate-500 transition hover:text-slate-300"
              title="初期プリセットテンプレートを再復元"
            >
              <RefreshCwIcon size={11} />
              <span>プリセットを初期状態に復元</span>
            </button>
          </div>
        </div>
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
              setExpandedTemplateId(newTpl.id);
            }
          }}
        />
      )}
    </div>
  );
}
