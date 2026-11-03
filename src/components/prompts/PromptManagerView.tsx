import { useMemo, useState } from "react";

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
  ClipboardIcon,
  CopyIcon,
  EditIcon,
  HelpCircleIcon,
  InfoIcon,
  MenuIcon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
  XIcon,
} from "../icons";
import { PromptTemplateDetailModal } from "./PromptTemplateDetailModal";
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
  const handleVariableChange = (varName: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [varName]: value }));
    if (value.trim()) {
      try {
        const stored = getStoredVariables();
        stored[varName] = value;
        localStorage.setItem(LAST_VARS_STORAGE_KEY, JSON.stringify(stored));
      } catch (err) {
        console.error("変数保存エラー:", err);
      }
    }
  };

  // 個別変数のクリア
  const handleClearVariable = (varName: string) => {
    setVariableValues((prev) => {
      const next = { ...prev };
      delete next[varName];
      return next;
    });
  };

  // セグメント有効フラグ: Set<segmentId>
  const [activeSegmentIds, setActiveSegmentIds] = useState<Set<string>>(new Set());

  // スマホ用オーバーレイサイドバー状態
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // サイドバー項目ドロップダウン状態
  const [menuTemplateId, setMenuTemplateId] = useState<string | null>(null);

  // モーダル状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  // 詳細確認モーダル状態
  const [detailTemplate, setDetailTemplate] = useState<PromptTemplate | null>(null);

  // コピー成功フィードバック
  const [copied, setCopied] = useState(false);
  // コピー警告メッセージ（必須変数が未入力の場合など）
  const [copyWarning, setCopyWarning] = useState<string | null>(null);

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

  // 選択中テンプレートから抽出された変数定義一覧
  const currentVariableDefinitions = useMemo(() => {
    if (!currentTemplate) return [];
    return extractTemplateVariableDefinitions(currentTemplate.content);
  }, [currentTemplate]);

  // 記憶された変数のうち、現在のテンプレートに適用可能な値が存在するか
  const hasRestorableVariables = useMemo(() => {
    const stored = getStoredVariables();
    return currentVariableDefinitions.some(
      (def) => stored[def.key] && stored[def.key] !== (variableValues[def.key] ?? ""),
    );
  }, [currentVariableDefinitions, variableValues]);

  // 前回入力した変数を一括代入
  const handleRestoreLastVariables = () => {
    const stored = getStoredVariables();
    setVariableValues((prev) => {
      const next = { ...prev };
      for (const def of currentVariableDefinitions) {
        if (stored[def.key]) {
          next[def.key] = stored[def.key];
        }
      }
      return next;
    });
  };

  // テンプレート切り替え時にセグメントの初期ON/OFF状態を同期
  // （ユーザーが画面上でトグルした状態を管理）
  const [lastSyncedTemplateId, setLastSyncedTemplateId] = useState<string | null>(null);
  if (currentTemplate && currentTemplate.id !== lastSyncedTemplateId) {
    setLastSyncedTemplateId(currentTemplate.id);
    const initialActive = new Set<string>();
    for (const seg of segments) {
      if (seg.isToggleable && seg.defaultEnabled) {
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
    setActiveSegmentIds(new Set(segments.filter((s) => s.isToggleable).map((s) => s.id)));
  };

  const handleDeselectAllSegments = () => {
    setActiveSegmentIds(new Set());
  };

  // クリップボードへコピー
  const handleCopyPrompt = async () => {
    if (!finalPrompt.trim()) return;

    // 必須項目の未入力チェック（|フォールバックがなく、セクション見出しでもない変数）
    const missingRequired = currentVariableDefinitions.filter(
      (v) => v.isRequired && (!variableValues[v.key] || !variableValues[v.key].trim()),
    );
    if (missingRequired.length > 0) {
      const names = missingRequired.map((v) => `{{${v.name}}}`).join("、");
      setCopyWarning(`必須項目（${names}）が未入力です`);
      setTimeout(() => setCopyWarning(null), 3000);
      return;
    }

    try {
      await navigator.clipboard.writeText(finalPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
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

  // テンプレートのプロンプトを直接クリップボードにコピー
  const handleCopyTemplatePrompt = async (tpl: PromptTemplate) => {
    // 必須項目の未入力チェック
    const tplDefs = extractTemplateVariableDefinitions(tpl.content);
    const missing = tplDefs.filter(
      (v) => v.isRequired && (!variableValues[v.key] || !variableValues[v.key].trim()),
    );
    if (missing.length > 0) {
      const names = missing.map((v) => `{{${v.name}}}`).join("、");
      setCopyWarning(`必須項目（${names}）が未入力です`);
      setTimeout(() => setCopyWarning(null), 3000);
      return;
    }

    const tplSegments = parseTemplateSegments(tpl.content, tpl.enabledLines);
    const activeIds = new Set(tplSegments.filter((s) => s.defaultEnabled).map((s) => s.id));
    const text = assemblePrompt(tplSegments, activeIds, variableValues);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error("クリップボードへのコピーに失敗しました:", err);
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

  // サイドバーコンテンツの描画（PC・スマホ共通）
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      {/* サイドバー上部: ヘッダー ＆ 新規作成ボタン */}
      <div className="flex items-center justify-between border-b border-slate-800/80 p-3.5">
        <span className="text-xs font-bold text-slate-200">テンプレート一覧</span>
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null);
              setIsEditModalOpen(true);
              if (isMobile) setIsMobileSidebarOpen(false);
            }}
            className="flex cursor-pointer items-center space-x-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <PlusIcon size={14} />
            <span>新規追加</span>
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <XIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 検索バー */}
      <div className="border-b border-slate-800/80 p-2.5">
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
            const isMenuOpen = menuTemplateId === tpl.id;

            return (
              <div
                key={tpl.id}
                className={`group relative flex w-full items-center justify-between rounded-xl transition ${
                  isSelected
                    ? "border border-indigo-500/40 bg-indigo-600/20 text-white shadow-sm"
                    : "border border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                {/* テンプレート選択クリック領域 */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                    if (isMobile) setIsMobileSidebarOpen(false);
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col p-2.5 pr-1 text-left"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="truncate text-xs font-semibold">{tpl.name}</span>
                    {tpl.isPreset ? (
                      <span className="flex-shrink-0 rounded border border-indigo-500/30 bg-indigo-950/80 px-1.5 py-0.2 text-[9px] font-medium text-indigo-300">
                        標準
                      </span>
                    ) : (
                      <span className="flex-shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.2 text-[9px] font-medium text-slate-400">
                        独自
                      </span>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                      {tpl.description}
                    </p>
                  )}
                </button>

                {/* 三点リーダーボタン & ドロップダウンメニュー */}
                <div className="relative pr-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuTemplateId(isMenuOpen ? null : tpl.id);
                    }}
                    className="cursor-pointer rounded-lg p-1 text-slate-400 opacity-80 transition hover:bg-slate-800 hover:text-white group-hover:opacity-100"
                    title="操作メニュー"
                  >
                    <MoreVerticalIcon size={15} />
                  </button>

                  {/* ドロップダウンメニュー */}
                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuTemplateId(null);
                        }}
                      />
                      <div className="animate-fadeIn absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 text-xs text-slate-200 shadow-2xl">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTemplateId(null);
                            handleCopyTemplatePrompt(tpl);
                          }}
                          className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                        >
                          <ClipboardIcon size={13} />
                          <span>プロンプトをコピー</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTemplateId(null);
                            setDetailTemplate(tpl);
                            if (isMobile) setIsMobileSidebarOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                        >
                          <InfoIcon size={13} />
                          <span>詳細</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTemplateId(null);
                            setEditingTemplate(tpl);
                            setIsEditModalOpen(true);
                            if (isMobile) setIsMobileSidebarOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                        >
                          <EditIcon size={13} />
                          <span>編集</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTemplateId(null);
                            handleDuplicateTemplate(tpl.id);
                          }}
                          className="flex w-full cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                        >
                          <CopyIcon size={13} />
                          <span>複製</span>
                        </button>

                        {!tpl.isPreset && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
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
                    </>
                  )}
                </div>
              </div>
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
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* スマホ表示時専用トップバー（ハンバーガーメニューでサイドバーを開閉 ＋ 隣に?アイコンで詳細表示） */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3.5 py-2.5 md:hidden">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex cursor-pointer items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            <MenuIcon size={16} />
            <span className="max-w-[200px] truncate">
              {currentTemplate ? currentTemplate.name : "テンプレート一覧"}
            </span>
          </button>

          {currentTemplate && (
            <button
              type="button"
              onClick={() => setDetailTemplate(currentTemplate)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-700 bg-slate-800/90 text-slate-300 transition hover:border-indigo-500/50 hover:bg-slate-700 hover:text-indigo-300"
              title="テンプレートの詳細・構成を確認"
            >
              <HelpCircleIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* スマホ表示時: オーバーレイサイドバー */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* 背景オーバーレイ */}
          <div
            className="animate-fadeIn fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* ドロワーパネル */}
          <div className="animate-slideInLeft relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-900 shadow-2xl">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* 2カラムレイアウトコンテナ */}
      <div className="flex flex-1 flex-row overflow-hidden">
        {/* PC用: 左固定サイドバー */}
        <aside className="hidden h-full w-80 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 md:flex">
          {renderSidebarContent(false)}
        </aside>

        {/* 右カラム: プロンプト生成・カスタマイズペイン */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-slate-950 p-4 pb-28 sm:p-6 sm:pb-32">
          {currentTemplate ? (
            <div className="mx-auto flex w-full max-w-4xl flex-col space-y-5">
              {/* 操作ボタングループ（右寄せ配置） */}
              <div className="flex items-center justify-end space-x-2">
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

              {/* セクション 1: 変数入力フォーム */}
              {currentVariableDefinitions.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      1. 変数の入力（プレースホルダーへの代入）
                    </h3>

                    {hasRestorableVariables && (
                      <button
                        type="button"
                        onClick={handleRestoreLastVariables}
                        className="flex cursor-pointer items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/60 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-900/80 hover:text-white"
                        title="前回入力した変数値をこのテンプレートに一括適用"
                      >
                        <RefreshCwIcon size={12} />
                        <span>前回の値を一括入力</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-3.5 space-y-3">
                    {currentVariableDefinitions.map((def) => {
                      const val = variableValues[def.key] ?? "";
                      const lineCount = Math.min(4, Math.max(1, val.split("\n").length));
                      const isMissingRequired = def.isRequired && !val.trim();

                      return (
                        <div key={def.key}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <label className="font-mono text-xs font-semibold text-indigo-300">
                                {`{{${def.name}}}`}
                              </label>
                              {def.isRequired && (
                                <span className="rounded border border-rose-500/40 bg-rose-950/60 px-1.5 py-0.2 text-[10px] font-bold text-rose-300">
                                  必須
                                </span>
                              )}
                              {def.fallback && (
                                <span className="rounded bg-slate-800/90 px-1.5 py-0.2 text-[10px] text-slate-400">
                                  既定: {def.fallback}
                                </span>
                              )}
                            </div>
                            {val && (
                              <button
                                type="button"
                                onClick={() => handleClearVariable(def.key)}
                                className="flex cursor-pointer items-center space-x-0.5 rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                                title="この変数の値を空にする"
                              >
                                <XIcon size={12} />
                                <span>クリア</span>
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={lineCount}
                            value={val}
                            onChange={(e) => handleVariableChange(def.key, e.target.value)}
                            placeholder={
                              def.fallback
                                ? `未入力時は「${def.fallback}」を使用`
                                : `${def.name}を入力...`
                            }
                            className={`mt-1 w-full resize-none overflow-y-auto rounded-xl border bg-slate-950 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100 transition-[height] duration-150 focus:outline-none ${
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

                {/* 箇条書きと明示的ブロックのみトグル可能なリスト表示 */}
                <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/90 p-2 font-mono text-xs">
                  {segments.map((seg) => {
                    // 1. チェックボックス対象外（見出しや指示文、変数枠などの固定文）
                    if (!seg.isToggleable) {
                      return (
                        <div key={seg.id} className="px-2 py-1 select-text">
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">
                            {seg.displayText}
                          </pre>
                        </div>
                      );
                    }

                    // 2. チェックボックス対象（箇条書き or 明示的ブロック）
                    const isChecked = activeSegmentIds.has(seg.id);
                    return (
                      <div
                        key={seg.id}
                        onClick={() => handleToggleSegment(seg.id)}
                        className={`group flex cursor-pointer items-start space-x-2.5 rounded px-2 py-1 transition hover:bg-slate-800/60 ${
                          isChecked
                            ? "text-slate-200"
                            : "text-slate-500 opacity-40 line-through hover:opacity-70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // 親divのクリックでハンドリング
                          className="mt-1 h-3.5 w-3.5 flex-shrink-0 cursor-pointer rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                        />
                        <div className="min-w-0 flex-1">
                          {seg.type !== "LINE" && seg.type !== "BULLET" && (
                            <div className="mb-1">
                              <span className="inline-block rounded border border-indigo-500/30 bg-indigo-950/80 px-1.5 py-0.2 font-sans text-[10px] text-indigo-300 not-italic no-underline">
                                {seg.title || "連動ブロック"}
                              </span>
                            </div>
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

              {/* セクション 3: 完成プロンプト リアルタイムプレビュー */}
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

      {/* 画面右下 円形FAB (Floating Action Button): 完成プロンプトをコピー */}
      {currentTemplate && (
        <div className="fixed right-5 bottom-20 z-40 flex flex-col items-end md:right-8 md:bottom-8">
          {/* コピー警告メッセージ（必須項目未入力時） */}
          {copyWarning && (
            <div className="animate-fadeIn mb-2.5 flex items-center space-x-1.5 rounded-xl border border-rose-500/50 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-rose-300 shadow-2xl backdrop-blur-sm whitespace-nowrap">
              <AlertCircleIcon size={14} className="text-rose-400 flex-shrink-0" />
              <span>{copyWarning}</span>
            </div>
          )}

          {/* コピー完了時にFABの真上に1秒間表示されるテキスト */}
          {copied && (
            <div className="animate-fadeIn mb-2.5 flex items-center space-x-1.5 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-2xl backdrop-blur-sm whitespace-nowrap">
              <CheckIcon size={14} className="text-emerald-400 flex-shrink-0" />
              <span>完成したプロンプトをコピーしました</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!finalPrompt.trim()}
            className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-2xl transition-all duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              copied
                ? "scale-105 bg-emerald-600 shadow-emerald-600/50"
                : "bg-indigo-600 shadow-indigo-600/50 hover:scale-110 hover:bg-indigo-500 hover:shadow-indigo-500/60"
            }`}
            title="完成したプロンプトをコピー"
          >
            {copied ? <CheckIcon size={22} /> : <CopyIcon size={22} />}
          </button>
        </div>
      )}

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

      {/* テンプレート詳細モーダル */}
      {detailTemplate && (
        <PromptTemplateDetailModal
          template={detailTemplate}
          onClose={() => setDetailTemplate(null)}
          onEdit={() => {
            const target = detailTemplate;
            setDetailTemplate(null);
            setEditingTemplate(target);
            setIsEditModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
