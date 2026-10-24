import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import type { LectureCardPhase, LectureCheckCategory, PriorityMode, Card } from "../types/schema";
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
    graduateRecommendedCardsInLecture,
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

  // チェック出題カテゴリ (3 > 2 > 1) のマップ
  const checkCategoryMap = useMemo(() => {
    const map = new Map<string, LectureCheckCategory>();
    if (trainingQueue?.items) {
      for (const item of trainingQueue.items) {
        map.set(item.card.id, item.checkCategory);
      }
    }
    return map;
  }, [trainingQueue]);

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
  const getRemainingCooldownText = (lastAttemptAt: string | null) => {
    if (!lastAttemptAt) return null;
    const unlockTime = new Date(lastAttemptAt);
    unlockTime.setHours(unlockTime.getHours() + settings.waitingDurationHours);
    const diffMs = unlockTime.getTime() - nowTick;
    if (diffMs <= 0) return "規定時間経過 (チェック出題可能)";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `あと ${hours}時間 ${minutes}分 クールダウン中`;
  };

  // チェックモードスタート（3 > 2 > 1 の優先順で出題し、状態遷移を行う）
  const startTrainingMode = () => {
    if (!trainingQueue || trainingQueue.items.length === 0) return;
    setPracticeSession({
      mode: "TRAINING",
      cards: trainingQueue.items.map((item) => {
        const c = item.card;
        let badge = "";
        if (item.checkCategory === "PRIORITY_3_COOLDOWN_CLEARED") {
          badge =
            c.lecturePool.phase === "GRADUATION_RECOMMENDED"
              ? `卒業推奨 (連続${c.lecturePool.consecutiveCorrect}回正解)`
              : `未卒業 (連続${c.lecturePool.consecutiveCorrect}回正解 → 正解で卒業推奨)`;
        } else if (item.checkCategory === "PRIORITY_2_UNATTEMPTED") {
          badge = "未実施 (初回チャレンジ)";
        } else {
          badge = "未卒業 (連続正解0・リベンジ)";
        }
        return {
          id: c.id,
          front: c.front,
          back: c.back,
          checkCategory: item.checkCategory,
          badge,
        };
      }),
    });
  };

  // 全問モードスタート（休止以外の全講義カードを状態変更なしで演習）
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
          c.lecturePool.phase === "GRADUATED"
            ? "卒業済"
            : c.lecturePool.phase === "GRADUATION_RECOMMENDED"
              ? `卒業推奨 (連続${c.lecturePool.consecutiveCorrect}回正解)`
              : c.lecturePool.phase === "UNGRADUATED"
                ? `未卒業 (連続${c.lecturePool.consecutiveCorrect}回正解)`
                : "未実施",
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
            {/* チェックモードスタートボタン（3 > 2 > 1 の優先順・状態遷移あり） */}
            <button
              onClick={startTrainingMode}
              disabled={!trainingQueue || trainingQueue.cards.length === 0}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md shadow-amber-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              title="チェックモード: ③8h経過の連続正解カード ＞ ②未実施 ＞ ①連続正解0の未卒業 の優先順で出題します"
            >
              <PlayIcon size={12} />
              <span>✅ チェック ({trainingQueue?.cards.length ?? 0}枚)</span>
            </button>

            {/* 全問モードボタン（状態変更なし） */}
            <button
              onClick={startFreePracticeMode}
              disabled={lectureCards.filter((c) => !c.isSuspended).length === 0}
              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg border border-indigo-400/30 flex items-center space-x-1.5 transition cursor-pointer"
              title="全問モード: ステータスを変更せず、この講義のすべてのカードを出題します"
            >
              <ShuffleIcon size={12} />
              <span>🔁 全問 ({lectureCards.filter((c) => !c.isSuspended).length}枚)</span>
            </button>

            {/* 卒業推奨カードを共通プールへ一括移動ボタン */}
            {progress && progress.graduationRecommendedCount > 0 && (
              <button
                onClick={() => {
                  const count = graduateRecommendedCardsInLecture(selectedLecture.id);
                  if (count > 0) {
                    alert(`🎓 ${count} 枚の卒業推奨カードを共通プール（卒業済）へ移動しました！`);
                  }
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 transition cursor-pointer"
                title="現在2回以上連続で正解している卒業推奨カードをまとめて共通プールへ移動します"
              >
                <ArrowUpRightIcon size={13} />
                <span>🎓 卒業推奨を一括移動 ({progress.graduationRecommendedCount}枚)</span>
              </button>
            )}

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
              {/* チェック出題可能キューサマリー (3 > 2 > 1) */}
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/80 text-slate-200 font-medium shadow-xs">
                <span>✅ チェック対象:</span>
                <strong className="font-mono text-white text-xs">{trainingQueue?.cards.length ?? 0}</strong>
                <span className="text-[10px] flex items-center space-x-1.5 ml-1">
                  <span className="text-emerald-300" title="優先度3: 連続1回以上正解かつ規定時間経過">
                    ③定着:{trainingQueue?.priority3Count ?? 0}
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-indigo-300" title="優先度2: 未実施">
                    ②未実施:{trainingQueue?.priority2Count ?? 0}
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-amber-300" title="優先度1: 連続正解0の未卒業">
                    ①弱点:{trainingQueue?.priority1Count ?? 0}
                  </span>
                </span>
              </span>

              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <span className="text-slate-300">未実施: </span>
                <strong className="font-mono text-indigo-300">{progress.unattemptedCount}</strong>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-300">未卒業: </span>
                <strong className="font-mono text-amber-300">{progress.ungraduatedCount}</strong>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-slate-300">卒業推奨: </span>
                <strong className="font-mono text-cyan-300">{progress.graduationRecommendedCount}</strong>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">卒業済 (共通FSRS): </span>
                <strong className="font-mono text-emerald-300">{progress.graduatedCount}</strong>
              </span>
            </div>

            {/* クールダウン案内 */}
            {trainingQueue?.earliestUnlockAt && (
              <div className="flex items-center space-x-1.5 text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-md">
                <ClockIcon size={13} />
                <span>
                  最短チェック解禁 (③):{" "}
                  {getRemainingCooldownText(
                    new Date(
                      new Date(trainingQueue.earliestUnlockAt).getTime() -
                        settings.waitingDurationHours * 3600000,
                    ).toISOString(),
                  )}
                </span>
              </div>
            )}

            {/* 4色積み上げプログレスバー（卒業済 / 卒業推奨 / 未卒業 / 未実施） */}
            {lectureCards.length > 0 && (
              <div className="w-full pt-1">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.graduatedCount / lectureCards.length) * 100}%`,
                    }}
                    title={`卒業済: ${progress.graduatedCount}枚`}
                  />
                  <div
                    className="bg-cyan-400 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.graduationRecommendedCount / lectureCards.length) * 100}%`,
                    }}
                    title={`卒業推奨: ${progress.graduationRecommendedCount}枚`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.ungraduatedCount / lectureCards.length) * 100}%`,
                    }}
                    title={`未卒業: ${progress.ungraduatedCount}枚`}
                  />
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{
                      width: `${(progress.unattemptedCount / lectureCards.length) * 100}%`,
                    }}
                    title={`未実施: ${progress.unattemptedCount}枚`}
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
            <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setPhaseFilter("ALL")}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  phaseFilter === "ALL" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setPhaseFilter("TRAINING")}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1 cursor-pointer ${
                  phaseFilter === "TRAINING" ? "bg-amber-600 text-white font-medium shadow-xs" : "text-amber-300 hover:text-white"
                }`}
                title="チェックモードの出題対象カード (③8h経過 ＞ ②未実施 ＞ ①連続正解0)"
              >
                <span>✅ チェック対象 ({trainingQueue?.cards.length ?? 0})</span>
              </button>
              <button
                onClick={() => setPhaseFilter("UNATTEMPTED")}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  phaseFilter === "UNATTEMPTED" ? "bg-slate-800 text-indigo-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                未実施 ({progress?.unattemptedCount})
              </button>
              <button
                onClick={() => setPhaseFilter("UNGRADUATED")}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  phaseFilter === "UNGRADUATED" ? "bg-slate-800 text-amber-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                未卒業 ({progress?.ungraduatedCount})
              </button>
              <button
                onClick={() => setPhaseFilter("GRADUATION_RECOMMENDED")}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  phaseFilter === "GRADUATION_RECOMMENDED" ? "bg-slate-800 text-cyan-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                卒業推奨 ({progress?.graduationRecommendedCount})
              </button>
              <button
                onClick={() => setPhaseFilter("GRADUATED")}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  phaseFilter === "GRADUATED" ? "bg-slate-800 text-emerald-300 font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                卒業済 ({progress?.graduatedCount})
              </button>
              <button
                onClick={() => setPhaseFilter("SUSPENDED")}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
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
                const streak = card.lecturePool.consecutiveCorrect;
                const checkCat = checkCategoryMap.get(card.id);
                const isLocked = isWaitingCardLocked(
                  card,
                  settings.waitingDurationHours,
                  new Date(nowTick),
                );
                const cooldownText = getRemainingCooldownText(card.lecturePool.lastAttemptAt);

                // チェック対象 (3 > 2 > 1) に応じたカード枠線の色分け
                const cardBorderStyle = card.isSuspended
                  ? "border-rose-900/40 opacity-70"
                  : checkCat === "PRIORITY_3_COOLDOWN_CLEARED"
                    ? "border-emerald-500/60 bg-emerald-950/15 hover:border-emerald-400"
                    : checkCat === "PRIORITY_2_UNATTEMPTED"
                      ? "border-indigo-500/50 bg-indigo-950/15 hover:border-indigo-400"
                      : checkCat === "PRIORITY_1_ZERO_STREAK"
                        ? "border-amber-500/60 bg-amber-950/15 hover:border-amber-400"
                        : "border-slate-800 hover:border-slate-700";

                return (
                  <div
                    key={card.id}
                    className={`bg-slate-900/70 border rounded-xl p-3.5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${cardBorderStyle}`}
                  >
                    {/* 左側: 番号 & ステータス & 内容 */}
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <span className="text-xs font-mono text-slate-500 pt-0.5">#{idx + 1}</span>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* ステータスバッジ群 */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* チェック出題優先度バッジ (3 > 2 > 1) */}
                          {checkCat === "PRIORITY_3_COOLDOWN_CLEARED" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/60">
                              ③ チェック最優先 (8h経過・定着確認)
                            </span>
                          )}
                          {checkCat === "PRIORITY_2_UNATTEMPTED" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-500/60">
                              ② チェック対象 (未実施)
                            </span>
                          )}
                          {checkCat === "PRIORITY_1_ZERO_STREAK" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-500/60">
                              ① チェック対象 (連続正解0・弱点)
                            </span>
                          )}

                          {/* 4フェーズバッジ */}
                          {phase === "UNATTEMPTED" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              未実施
                            </span>
                          )}
                          {phase === "UNGRADUATED" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/80 flex items-center space-x-1">
                              <span>未卒業 (連続正解: {streak}回)</span>
                            </span>
                          )}
                          {phase === "GRADUATION_RECOMMENDED" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-700/80 flex items-center space-x-1">
                              <span>🎓 卒業推奨 (連続正解: {streak}回)</span>
                            </span>
                          )}
                          {phase === "GRADUATED" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center space-x-1">
                              <CheckIcon size={10} />
                              <span>卒業済 (共通プール)</span>
                            </span>
                          )}

                          {/* 連続1回以上正解カードの8hクールダウン表示 */}
                          {(phase === "UNGRADUATED" || phase === "GRADUATION_RECOMMENDED") &&
                            streak >= 1 &&
                            isLocked &&
                            cooldownText && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center space-x-1">
                                <ClockIcon size={10} />
                                <span>{cooldownText}</span>
                              </span>
                            )}

                          {/* 卒業済みカードの FSRS 詳細情報バッジ (due / R% / リベンジ / 連続ミス) */}
                          {phase === "GRADUATED" && card.commonPool && (
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
                      {/* 共通プールへの移動ボタン（卒業推奨 or 個別スキップ） */}
                      {phase !== "GRADUATED" && (
                        <button
                          onClick={() => setCardPhase(card.id, "GRADUATED")}
                          className={`px-2 py-1 border rounded text-[11px] font-medium flex items-center space-x-1 transition cursor-pointer ${
                            phase === "GRADUATION_RECOMMENDED"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-600/30"
                              : "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800/60"
                          }`}
                          title="このカードを共通プール（卒業済）へ移動"
                        >
                          <ArrowUpRightIcon size={12} />
                          <span>{phase === "GRADUATION_RECOMMENDED" ? "🎓 卒業させる" : "プールに移動"}</span>
                        </button>
                      )}

                      {/* 卒業済から未卒業へ戻すボタン */}
                      {phase === "GRADUATED" && (
                        <button
                          onClick={() => setCardPhase(card.id, "UNGRADUATED")}
                          className="px-2 py-1 bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded text-[11px] transition cursor-pointer"
                          title="共通プールから講義プールの「未卒業 (連続正解0)」へ戻します"
                        >
                          未卒業に戻す
                        </button>
                      )}

                      {/* 未実施にリセットボタン */}
                      {phase !== "UNATTEMPTED" && (
                        <button
                          onClick={() => setCardPhase(card.id, "UNATTEMPTED")}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition cursor-pointer"
                          title="カードの履歴を「未実施」に完全リセットします"
                        >
                          未実施にリセット
                        </button>
                      )}

                      <div className="flex items-center space-x-1">
                        {/* 休止トグル */}
                        <button
                          onClick={() => toggleCardSuspension(card.id)}
                          className={`p-1.5 rounded transition cursor-pointer ${
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
                          className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition cursor-pointer"
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
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
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
                            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
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

      {/* 講義カード演習プレイヤー（チェックモード / 全問モード） */}
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
          recommendedCount={progress?.graduationRecommendedCount ?? 0}
          onGraduateRecommended={() => {
            const count = graduateRecommendedCardsInLecture(selectedLecture.id);
            if (count > 0) {
              alert(`🎓 ${count} 枚の卒業推奨カードを共通プール（卒業済）へ移動しました！`);
            }
            return count;
          }}
          onClose={() => setPracticeSession(null)}
        />
      )}
    </main>
  );
}
