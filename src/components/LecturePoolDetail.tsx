import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import type { LectureCardPhase, PriorityMode, Card } from "../types/schema";
import { isWaitingCardLocked } from "../types/schema";
import { AiBatchImportModal } from "./AiBatchImportModal";
import { LecturePlayer, type PracticeCardItem } from "./practice/LecturePlayer";
import { parseFlashcardsFromAI } from "../utils/aiCardParser";
import { calculateCardRetrievability } from "../services/fsrsService";
import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  ClockIcon,
  ArrowUpRightIcon,
  PauseIcon,
  CheckIcon,
  XIcon,
  SparklesIcon,
  UndoIcon,
  SlidersIcon,
  PlayIcon,
  ShuffleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "./icons";

export function LecturePoolDetail() {
  const {
    courses,
    lectures,
    cards,
    settings,
    sessionState,
    selectedLectureId,
    updateLecture,
    deleteLecture,
    toggleLectureSuspension,
    addCard,
    updateCard,
    deleteCard,
    deleteCardsByBundleId,
    addCardsBatch,
    isDuplicateOfLastBatch,
    setCardPhase,
    toggleCardSuspension,
    answerLectureTrainingCard,
    getLectureProgress,
    getLectureTrainingQueue,
  } = useAppStore();

  const selectedLecture = lectures.find((l) => l.id === selectedLectureId);
  const selectedCourse = courses.find((c) => c.id === selectedLecture?.courseId);

  // リアルタイムロック解除監視・カウントダウン更新用タイマー (30秒ごと)
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  // AI一括取り込みモーダル状態
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  // 演習セッション状態（短期特訓 or 自由演習のスナップショット）
  const [practiceSession, setPracticeSession] = useState<{
    mode: "TRAINING" | "FREE_PRACTICE";
    cards: PracticeCardItem[];
  } | null>(null);
  const [importInitialText, setImportInitialText] = useState("");
  const [lastImportNotification, setLastImportNotification] = useState<{
    bundleId: string;
    count: number;
  } | null>(null);

  // カード追加用フォーム状態
  const [frontInput, setFrontInput] = useState("");
  const [backInput, setBackInput] = useState("");
  const [isCreateFormExpanded, setIsCreateFormExpanded] = useState(false);

  // カード編集用モーダル状態
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  // フィルター & 検索
  const [phaseFilter, setPhaseFilter] = useState<LectureCardPhase | "ALL" | "SUSPENDED" | "TRAINING">("ALL");
  const [cardSearchQuery, setCardSearchQuery] = useState("");

  // 講義名編集状態
  const [isEditingLectureName, setIsEditingLectureName] = useState(false);
  const [lectureNameInput, setLectureNameInput] = useState("");

  const lectureCards = useMemo(() => {
    if (!selectedLectureId) return [];
    return cards.filter((c) => c.lectureId === selectedLectureId);
  }, [cards, selectedLectureId]);

  const trainingQueue = useMemo(() => {
    if (!selectedLectureId) return null;
    return getLectureTrainingQueue(
      selectedLectureId,
      settings.waitingDurationHours,
      new Date(nowTick),
    );
  }, [selectedLectureId, getLectureTrainingQueue, cards, settings.waitingDurationHours, nowTick]);

  const filteredCards = useMemo(() => {
    const trainingCardIds = new Set(trainingQueue?.cards.map((c) => c.id) ?? []);
    const q = cardSearchQuery.trim().toLowerCase();
    return lectureCards.filter((card) => {
      if (q) {
        const matchFront = card.front.toLowerCase().includes(q);
        const matchBack = card.back.toLowerCase().includes(q);
        if (!matchFront && !matchBack) return false;
      }
      if (phaseFilter === "ALL") return true;
      if (phaseFilter === "SUSPENDED") return card.isSuspended;
      if (phaseFilter === "TRAINING") return trainingCardIds.has(card.id);
      return card.lecturePool.phase === phaseFilter;
    });
  }, [lectureCards, phaseFilter, trainingQueue, cardSearchQuery]);

  const retryCardSet = useMemo(
    () => new Set(sessionState.retryCardIds),
    [sessionState.retryCardIds],
  );

  const progress = selectedLectureId ? getLectureProgress(selectedLectureId) : null;

  if (!selectedLecture || !selectedCourse) {
    return (
      <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-slate-400">
        <div className="max-w-md text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            📚
          </div>
          <h2 className="text-lg font-semibold text-slate-200">講義専用プールを選択してください</h2>
          <p className="text-xs text-slate-400">
            左側のサイドバーから科目内の講義回を選択するか、新しく講義を作成してください。
          </p>
        </div>
      </main>
    );
  }

  // クールダウン残り時間の計算 (nowTick に連動してリアルタイム更新)
  const getRemainingCooldownText = (lastCorrectAt: string | null) => {
    if (!lastCorrectAt) return null;
    const unlockTime = new Date(lastCorrectAt);
    unlockTime.setHours(unlockTime.getHours() + settings.waitingDurationHours);
    const diffMs = unlockTime.getTime() - nowTick;
    if (diffMs <= 0) return "ロック解除済み (出題可能)";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `あと ${hours}時間 ${minutes}分 ロック中`;
  };

  // 短期特訓スタート（未暗記＋待機解除済みカードのみ出題し、状態遷移を行う）
  const startTrainingMode = () => {
    if (!trainingQueue || trainingQueue.cards.length === 0) return;
    setPracticeSession({
      mode: "TRAINING",
      cards: trainingQueue.cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        badge:
          c.lecturePool.phase === "WAITING"
            ? "待機解除 (正解で卒業)"
            : "未暗記 (正解で8h待機)",
      })),
    });
  };

  // 自由演習ループスタート（休止以外の全講義カードを状態変更なしで演習）
  const startFreePracticeMode = () => {
    const activeLectureCards = lectureCards.filter((c) => !c.isSuspended);
    if (activeLectureCards.length === 0) return;
    setPracticeSession({
      mode: "FREE_PRACTICE",
      cards: activeLectureCards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        badge:
          c.lecturePool.phase === "ACTIVE"
            ? "卒業済"
            : c.lecturePool.phase === "WAITING"
              ? "待機中"
              : "未暗記",
      })),
    });
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontInput.trim() || !backInput.trim()) return;
    addCard(selectedCourse.id, selectedLecture.id, frontInput, backInput);
    setFrontInput("");
    setBackInput("");
  };

  const handleKeyDownOnInput = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleAddCard(e);
    }
  };

  const startEditCard = (card: Card) => {
    setEditingCard(card);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const saveEditCard = () => {
    if (!editingCard) return;
    updateCard(editingCard.id, {
      front: editFront.trim(),
      back: editBack.trim(),
    });
    setEditingCard(null);
  };

  const handleSaveLectureName = () => {
    if (!lectureNameInput.trim()) return;
    updateLecture(selectedLecture.id, { name: lectureNameInput.trim() });
    setIsEditingLectureName(false);
  };

  // クリップボードからの即時一括取り込み
  const handleQuickClipboardImport = async () => {
    let clipboardText = "";
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      // 権限エラー等の場合は直接モーダルを開く
      setImportInitialText("");
      setIsImportModalOpen(true);
      return;
    }

    if (!clipboardText || !clipboardText.trim()) {
      alert("クリップボードが空です。AIの出力テキストをコピーしてから再度お試しください。");
      return;
    }

    const parseResult = parseFlashcardsFromAI(clipboardText);

    if (parseResult.success && parseResult.cards.length > 0) {
      // 直前の一括追加と同一内容かチェック（二重追加防止）
      if (isDuplicateOfLastBatch(selectedLecture.id, parseResult.cards)) {
        alert(
          `⚠️ 警告: 直前に追加した一括カード（全 ${parseResult.cards.length} 件）と全く同じ内容です。\n二重登録を防止するため、追加をキャンセルしました。`,
        );
        return;
      }

      const d = new Date();
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const rand = Math.random().toString(36).substring(2, 6);
      const bundleId = `clip_${dateStr}_${rand}`;

      const res = addCardsBatch(
        selectedCourse.id,
        selectedLecture.id,
        parseResult.cards,
        bundleId,
      );

      setLastImportNotification({
        bundleId: res.bundleId,
        count: res.addedCards.length,
      });
    } else {
      // パース失敗時、エラー理由を案内してモーダルにテキストを渡して開く
      const shouldOpenModal = window.confirm(
        `クリップボードのテキストからカードを認識できませんでした。\n\n理由: ${parseResult.errorMessage || "有効なデータが見つかりません"}\n\n詳細確認・編集画面を開きますか？`,
      );
      if (shouldOpenModal) {
        setImportInitialText(clipboardText);
        setIsImportModalOpen(true);
      }
    }
  };

  return (
    <main className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-full overflow-hidden">
      {/* 講義ヘッダー */}
      <header className="p-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-indigo-400 font-medium mb-1">
              {selectedCourse.name}
            </div>
            {isEditingLectureName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={lectureNameInput}
                  onChange={(e) => setLectureNameInput(e.target.value)}
                  className="px-2.5 py-1 text-base font-bold bg-slate-950 text-white border border-slate-700 rounded focus:border-indigo-500 outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveLectureName}
                  className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded font-medium"
                >
                  保存
                </button>
                <button
                  onClick={() => setIsEditingLectureName(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {selectedLecture.name}
                </h1>
                <button
                  onClick={() => {
                    setLectureNameInput(selectedLecture.name);
                    setIsEditingLectureName(true);
                  }}
                  className="text-slate-500 hover:text-indigo-400 p-1 rounded"
                  title="講義名を変更"
                >
                  <EditIcon size={14} />
                </button>
              </div>
            )}
          </div>

          {/* 講義操作・設定 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 短期特訓スタートボタン（状態遷移あり） */}
            <button
              onClick={startTrainingMode}
              disabled={!trainingQueue || trainingQueue.cards.length === 0}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md shadow-amber-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              title="未暗記と8h待機解除済みのカードを出題し、短期暗記・卒業判定を行います"
            >
              <PlayIcon size={12} />
              <span>⚡ 短期特訓 ({trainingQueue?.cards.length ?? 0}枚)</span>
            </button>

            {/* 自由演習（集中ループ）ボタン（状態変更なし） */}
            <button
              onClick={startFreePracticeMode}
              disabled={lectureCards.filter((c) => !c.isSuspended).length === 0}
              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg border border-indigo-400/30 flex items-center space-x-1.5 transition cursor-pointer"
              title="待機時間や卒業ステータスを変更せず、この講義のカードを何度でも集中ループ演習します"
            >
              <ShuffleIcon size={12} />
              <span>🔁 自由演習</span>
            </button>

            {/* 優先度設定 */}
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400">優先度:</span>
              <select
                value={selectedLecture.customPriorityMode ?? "INHERIT"}
                onChange={(e) => {
                  const val = e.target.value;
                  updateLecture(selectedLecture.id, {
                    customPriorityMode: val === "INHERIT" ? null : (val as PriorityMode),
                  });
                }}
                className="bg-transparent text-slate-200 outline-none cursor-pointer"
              >
                <option value="INHERIT" className="bg-slate-900 text-slate-300">
                  親科目継承 ({selectedCourse.priorityMode === "FORCE" ? "強制" : selectedCourse.priorityMode === "PRIORITY" ? "優先" : "通常"})
                </option>
                <option value="NORMAL" className="bg-slate-900 text-slate-300">通常</option>
                <option value="PRIORITY" className="bg-slate-900 text-slate-300">優先</option>
                <option value="FORCE" className="bg-slate-900 text-slate-300">強制出題</option>
              </select>
            </div>

            {/* 休止切替 */}
            <button
              onClick={() => toggleLectureSuspension(selectedLecture.id)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 flex items-center space-x-1 transition"
              title="講義内の全カードを休止/再開"
            >
              <PauseIcon size={13} />
              <span>一括休止/再開</span>
            </button>

            {/* 講義削除 */}
            <button
              onClick={() => {
                if (window.confirm(`講義「${selectedLecture.name}」とカードを削除しますか？`)) {
                  deleteLecture(selectedLecture.id);
                }
              }}
              className="p-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700/60 transition"
              title="講義を削除"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        </div>

        {/* 進捗プログレス統計 */}
        {progress && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {/* 特訓可能キューサマリー */}
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 font-medium shadow-xs">
                <span>⚡ 特訓可能:</span>
                <strong className="font-mono text-white text-xs">{trainingQueue?.cards.length ?? 0}</strong>
                <span className="text-[10px] opacity-75">
                  (未 {trainingQueue?.unmemorizedCount ?? 0} / 解除 {trainingQueue?.unlockedWaitingCount ?? 0})
                </span>
              </span>

              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-slate-300">未暗記: </span>
                <strong className="font-mono text-slate-100">{progress.unmemorizedCount}</strong>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-300">待機中 (8hロック): </span>
                <strong className="font-mono text-amber-300">{progress.waitingCount}</strong>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">卒業済 (共通FSRS): </span>
                <strong className="font-mono text-emerald-300">{progress.activeCount}</strong>
              </span>
            </div>

            {/* クールダウン案内 */}
            {trainingQueue?.earliestUnlockAt && (
              <div className="flex items-center space-x-1.5 text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-md">
                <ClockIcon size={13} />
                <span>
                  最短ロック解除:{" "}
                  {getRemainingCooldownText(
                    new Date(
                      new Date(trainingQueue.earliestUnlockAt).getTime() -
                        settings.waitingDurationHours * 3600000,
                    ).toISOString(),
                  )}
                </span>
              </div>
            )}

            {/* 3色積み上げプログレスバー（卒業済 / 待機中 / 未暗記） */}
            {lectureCards.length > 0 && (
              <div className="w-full pt-1">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.activeCount / lectureCards.length) * 100}%`,
                    }}
                    title={`卒業済: ${progress.activeCount}枚`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.waitingCount / lectureCards.length) * 100}%`,
                    }}
                    title={`待機中: ${progress.waitingCount}枚`}
                  />
                  <div
                    className="bg-slate-500 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.unmemorizedCount / lectureCards.length) * 100}%`,
                    }}
                    title={`未暗記: ${progress.unmemorizedCount}枚`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* コンテンツ領域 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* 直前のインポート通知 & 取り消しバナー */}
        {lastImportNotification && (
          <div className="bg-indigo-950/60 border border-indigo-700/60 rounded-xl p-3 text-xs flex items-center justify-between gap-3 text-indigo-200 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <SparklesIcon size={16} className="text-indigo-400 flex-shrink-0" />
              <span>
                <strong>{lastImportNotification.count} 枚</strong> のカードを一括取り込みしました（ID:{" "}
                <code className="bg-indigo-900/60 px-1 py-0.5 rounded font-mono text-[11px] text-indigo-300">
                  {lastImportNotification.bundleId}
                </code>
                ）
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `この一括追加（ID: ${lastImportNotification.bundleId}）の全カードを削除して取り消しますか？`,
                    )
                  ) {
                    const deleted = deleteCardsByBundleId(lastImportNotification.bundleId);
                    alert(`${deleted} 枚のカードを取り消しました。`);
                    setLastImportNotification(null);
                  }
                }}
                className="px-2.5 py-1 bg-indigo-800 hover:bg-rose-900 hover:text-rose-200 text-white rounded font-medium flex items-center space-x-1 transition"
                title="この一括追加の全カードを削除"
              >
                <UndoIcon size={13} />
                <span>追加を取り消す</span>
              </button>
              <button
                type="button"
                onClick={() => setLastImportNotification(null)}
                className="p-1 text-indigo-400 hover:text-white rounded"
              >
                <XIcon size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 新規カード作成エリア（省スペース開閉アコーディオン対応） */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsCreateFormExpanded((prev) => !prev)}
              className="text-xs font-semibold text-slate-200 hover:text-white flex items-center space-x-2 cursor-pointer py-0.5"
            >
              {isCreateFormExpanded || lectureCards.length === 0 ? (
                <ChevronDownIcon size={14} className="text-indigo-400" />
              ) : (
                <ChevronRightIcon size={14} className="text-indigo-400" />
              )}
              <PlusIcon size={14} className="text-indigo-400" />
              <span>カードを新規作成（手動追加）</span>
              {!isCreateFormExpanded && lectureCards.length > 0 && (
                <span className="text-[11px] font-normal text-slate-400 ml-1">
                  — クリックして入力フォームを開く
                </span>
              )}
            </button>

            <div className="flex items-center space-x-3">
              {/* AI一括取り込み スプリットボタン（常時ワンクリック利用可能） */}
              <div className="inline-flex rounded-lg shadow-sm border border-indigo-500/30 overflow-hidden bg-indigo-600/20">
                <button
                  type="button"
                  onClick={handleQuickClipboardImport}
                  className="px-2.5 py-1 text-indigo-300 hover:bg-indigo-600/30 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
                  title="クリップボードの内容から即座にカードを生成"
                >
                  <SparklesIcon size={13} />
                  <span>AI一括取り込み</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportInitialText("");
                    setIsImportModalOpen(true);
                  }}
                  className="px-1.5 py-1 text-indigo-300/80 hover:text-white hover:bg-indigo-600/40 border-l border-indigo-500/30 transition cursor-pointer"
                  title="手動貼り付け・詳細設定モーダルを開く"
                >
                  <SlidersIcon size={12} />
                </button>
              </div>
              {(isCreateFormExpanded || lectureCards.length === 0) && (
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Ctrl + Enter で登録
                </span>
              )}
            </div>
          </div>

          {(isCreateFormExpanded || lectureCards.length === 0) && (
            <form onSubmit={handleAddCard} className="space-y-3 mt-3 pt-3 border-t border-slate-800/80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    表面（問題・問い）
                  </label>
                  <textarea
                    rows={3}
                    value={frontInput}
                    onChange={(e) => setFrontInput(e.target.value)}
                    onKeyDown={handleKeyDownOnInput}
                    placeholder="例: オームの法則の公式は？"
                    className="w-full px-3 py-2 text-xs bg-slate-950 text-white border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    裏面（解答・解説）
                  </label>
                  <textarea
                    rows={3}
                    value={backInput}
                    onChange={(e) => setBackInput(e.target.value)}
                    onKeyDown={handleKeyDownOnInput}
                    placeholder="例: V = R · I"
                    className="w-full px-3 py-2 text-xs bg-slate-950 text-white border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!frontInput.trim() || !backInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <PlusIcon size={14} />
                  <span>カードを追加</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* カード一覧セクション */}
        <section className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-3">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>登録カード一覧</span>
                <span className="text-xs font-mono text-slate-400 font-normal">
                  ({filteredCards.length} / {lectureCards.length}枚)
                </span>
              </h2>

              {/* カード内キーワード検索 */}
              <div className="relative w-48 sm:w-60">
                <input
                  type="text"
                  value={cardSearchQuery}
                  onChange={(e) => setCardSearchQuery(e.target.value)}
                  placeholder="🔍 問題・解答を検索..."
                  className="w-full px-2.5 py-1 pr-6 text-xs bg-slate-900 text-slate-100 placeholder-slate-500 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                {cardSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCardSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* フィルタータブ */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setPhaseFilter("ALL")}
                className={`px-2.5 py-1 rounded transition ${
                  phaseFilter === "ALL" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setPhaseFilter("TRAINING")}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1 ${
                  phaseFilter === "TRAINING" ? "bg-indigo-600 text-white font-medium shadow-xs" : "text-indigo-300 hover:text-white"
                }`}
                title="未暗記および待機解除済みの出題対象カード"
              >
                <span>⚡ 特訓可能 ({trainingQueue?.cards.length ?? 0})</span>
              </button>
              <button
                onClick={() => setPhaseFilter("UNMEMORIZED")}
                className={`px-2.5 py-1 rounded transition ${
                  phaseFilter === "UNMEMORIZED" ? "bg-slate-800 text-slate-200 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                未暗記 ({progress?.unmemorizedCount})
              </button>
              <button
                onClick={() => setPhaseFilter("WAITING")}
                className={`px-2.5 py-1 rounded transition ${
                  phaseFilter === "WAITING" ? "bg-slate-800 text-amber-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                待機中 ({progress?.waitingCount})
              </button>
              <button
                onClick={() => setPhaseFilter("ACTIVE")}
                className={`px-2.5 py-1 rounded transition ${
                  phaseFilter === "ACTIVE" ? "bg-slate-800 text-emerald-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                卒業済 ({progress?.activeCount})
              </button>
              <button
                onClick={() => setPhaseFilter("SUSPENDED")}
                className={`px-2.5 py-1 rounded transition ${
                  phaseFilter === "SUSPENDED" ? "bg-slate-800 text-rose-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                休止中
              </button>
            </div>
          </div>

          {/* カード一覧リスト */}
          {filteredCards.length === 0 ? (
            <div className="py-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl">
              <p className="text-xs text-slate-400">該当するカードはありません</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCards.map((card, idx) => {
                const phase = card.lecturePool.phase;
                const isLocked = isWaitingCardLocked(
                  card,
                  settings.waitingDurationHours,
                  new Date(nowTick),
                );
                const cooldownText = getRemainingCooldownText(card.lecturePool.lastCorrectAt);

                return (
                  <div
                    key={card.id}
                    className={`bg-slate-900/70 border rounded-xl p-3.5 transition hover:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      card.isSuspended ? "border-rose-900/40 opacity-70" : "border-slate-800"
                    }`}
                  >
                    {/* 左側: 番号 & ステータス & 内容 */}
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <span className="text-xs font-mono text-slate-500 pt-0.5">#{idx + 1}</span>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* ステータスバッジ群 */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {phase === "UNMEMORIZED" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              未暗記
                            </span>
                          )}
                          {phase === "WAITING" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/80 flex items-center space-x-1">
                              <ClockIcon size={10} />
                              <span>待機中 ({isLocked ? cooldownText : "解除済"})</span>
                            </span>
                          )}
                          {phase === "ACTIVE" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center space-x-1">
                              <CheckIcon size={10} />
                              <span>共通プール (卒業)</span>
                            </span>
                          )}

                          {/* 卒業済みカードの FSRS 詳細情報バッジ (due / R% / リベンジ / 連続ミス) */}
                          {phase === "ACTIVE" && card.commonPool && (
                            <>
                              {retryCardSet.has(card.id) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/70">
                                  🔁 リベンジ対象
                                </span>
                              )}
                              <span
                                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700"
                                title={`次回復習予定日時: ${new Date(card.commonPool.fsrs.due).toLocaleString("ja-JP")}`}
                              >
                                📅 次回:{" "}
                                {new Date(card.commonPool.fsrs.due).getMonth() + 1}/
                                {new Date(card.commonPool.fsrs.due).getDate()}
                              </span>
                              <span
                                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/90 text-indigo-300 border border-slate-700"
                                title="現在の推定記憶維持率 (Retrievability)"
                              >
                                🧠 R:{" "}
                                {Math.round(
                                  calculateCardRetrievability(
                                    card.commonPool.fsrs,
                                    new Date(nowTick),
                                    settings.requestRetention,
                                  ) * 100,
                                )}
                                %
                              </span>
                              {card.commonPool.consecutiveFailCount > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 border border-rose-800/70">
                                  ⚠️ {card.commonPool.consecutiveFailCount}連続ミス
                                </span>
                              )}
                            </>
                          )}

                          {card.isSuspended && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/80">
                              休止中
                            </span>
                          )}

                          {card.bundleId && (
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/60 flex items-center space-x-1"
                              title={`一括追加グループID: ${card.bundleId}`}
                            >
                              <span>📦</span>
                              <span>{card.bundleId}</span>
                            </span>
                          )}
                        </div>

                        {/* カードテキスト */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60">
                            <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">表面 (問題)</span>
                            <p className="text-slate-100 whitespace-pre-wrap select-text">{card.front}</p>
                          </div>
                          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60">
                            <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">裏面 (解答)</span>
                            <p className="text-slate-200 whitespace-pre-wrap select-text">{card.back}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右側: カード操作ボタン群 */}
                    <div className="flex md:flex-col items-end justify-between md:justify-center gap-1.5 flex-shrink-0 text-xs">
                      {/* 仕様書2-3: 個別スキップ機能（抜け道）「この問題をプールに移動」 */}
                      {phase !== "ACTIVE" && (
                        <button
                          onClick={() => setCardPhase(card.id, "ACTIVE")}
                          className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded text-[11px] font-medium flex items-center space-x-1 transition"
                          title="待機時間を待たずに即時共通プールへ強制昇格"
                        >
                          <ArrowUpRightIcon size={12} />
                          <span>プールに移動</span>
                        </button>
                      )}

                      {/* 降格ボタン */}
                      {phase !== "UNMEMORIZED" && (
                        <button
                          onClick={() => setCardPhase(card.id, "UNMEMORIZED")}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                          title="講義プールの未暗記へ降格（FSRS履歴リセット）"
                        >
                          未暗記に戻す
                        </button>
                      )}

                      <div className="flex items-center space-x-1">
                        {/* 休止トグル */}
                        <button
                          onClick={() => toggleCardSuspension(card.id)}
                          className={`p-1.5 rounded transition ${
                            card.isSuspended
                              ? "bg-rose-950/60 text-rose-300 hover:bg-rose-900 border border-rose-800/60"
                              : "text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                          }`}
                          title={card.isSuspended ? "出題を再開" : "カードを休止（出題除外）"}
                        >
                          <PauseIcon size={13} />
                        </button>

                        {/* 編集 */}
                        <button
                          onClick={() => startEditCard(card)}
                          className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition"
                          title="カードを編集"
                        >
                          <EditIcon size={13} />
                        </button>

                        {/* 削除 */}
                        <button
                          onClick={() => {
                            if (window.confirm("このカードを削除しますか？")) {
                              deleteCard(card.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                          title="カードを削除"
                        >
                          <TrashIcon size={13} />
                        </button>

                        {/* bundleId一括削除 */}
                        {card.bundleId && (
                          <button
                            onClick={() => {
                              const bId = card.bundleId;
                              if (!bId) return;
                              if (
                                window.confirm(
                                  `同じ一括追加グループ「${bId}」に属するカードをすべて削除しますか？`,
                                )
                              ) {
                                const count = deleteCardsByBundleId(bId);
                                alert(`${count} 枚のカードを削除しました。`);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                            title={`一括追加グループ「${card.bundleId}」のカードをすべて削除`}
                          >
                            <UndoIcon size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* カード編集モーダル */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <EditIcon size={15} className="text-indigo-400" />
                <span>カードを編集</span>
              </h3>
              <button
                onClick={() => setEditingCard(null)}
                className="text-slate-400 hover:text-white"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">表面 (問題)</label>
                <textarea
                  rows={4}
                  value={editFront}
                  onChange={(e) => setEditFront(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">裏面 (解答)</label>
                <textarea
                  rows={4}
                  value={editBack}
                  onChange={(e) => setEditBack(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800 text-xs">
              <button
                onClick={() => setEditingCard(null)}
                className="px-3 py-1.5 text-slate-400 hover:text-white"
              >
                キャンセル
              </button>
              <button
                onClick={saveEditCard}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium shadow"
              >
                変更を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI一括取り込みモーダル */}
      {isImportModalOpen && (
        <AiBatchImportModal
          courseId={selectedCourse.id}
          lectureId={selectedLecture.id}
          lectureName={selectedLecture.name}
          initialText={importInitialText}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={(bundleId, count) => {
            setLastImportNotification({ bundleId, count });
          }}
        />
      )}

      {/* 講義カード演習プレイヤー（短期特訓モード / 自由演習モード） */}
      {practiceSession && (
        <LecturePlayer
          lectureTitle={`${selectedCourse.name} - ${selectedLecture.name}`}
          mode={practiceSession.mode}
          cards={practiceSession.cards}
          onAnswer={(cardId, result) => {
            if (practiceSession.mode === "TRAINING") {
              answerLectureTrainingCard(cardId, result);
            }
          }}
          onClose={() => setPracticeSession(null)}
        />
      )}
    </main>
  );
}
