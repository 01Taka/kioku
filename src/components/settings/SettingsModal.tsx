import React, { useRef,useState } from "react";

import { DEFAULT_APP_SETTINGS,useAppStore } from "../../store/useAppStore";
import type { AppBackupData } from "../../types/schema";
import { CheckIcon,SlidersIcon, XIcon } from "../icons";

export interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings, exportBackupData, importBackupJson, cards, courses, lectures } =
    useAppStore();

  const [activeTab, setActiveTab] = useState<"SETTINGS" | "BACKUP">("SETTINGS");
  const [backupNotice, setBackupNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // JSON ファイルとしてダウンロードエクスポート
  const handleExportJson = () => {
    const data = exportBackupData();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `kioku-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setBackupNotice({
      type: "success",
      message: `✅ 全 ${data.cards.length} 枚のカードデータを JSON ファイルにエクスポートしました。`,
    });
  };

  // JSON ファイルからマージインポート
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppBackupData;

      if (!parsed || !Array.isArray(parsed.cards)) {
        throw new Error("有効なバックアップ形式（cards 配列）が見つかりません。");
      }

      const result = importBackupJson(parsed);
      setBackupNotice({
        type: "success",
        message: `✅ マージインポート完了！ 科目 +${result.addedCourses}件 / 講義 +${result.addedLectures}件 / 新規カード +${result.addedCards}枚（全 ${parsed.cards.length} レコード同期）`,
      });
    } catch (err) {
      setBackupNotice({
        type: "error",
        message: `⚠️ インポート失敗: ${err instanceof Error ? err.message : "JSONの解析に失敗しました"}`,
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <SlidersIcon size={16} className="text-indigo-400" />
            <h2 className="text-base font-bold text-white">設定・データバックアップ</h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* タブ切替 */}
        <div className="flex space-x-1 rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("SETTINGS")}
            className={`flex-1 cursor-pointer rounded-lg py-2 font-semibold transition ${
              activeTab === "SETTINGS"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⚙️ 学習・FSRS設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("BACKUP")}
            className={`flex-1 cursor-pointer rounded-lg py-2 font-semibold transition ${
              activeTab === "BACKUP"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            💾 バックアップ・復元
          </button>
        </div>

        {activeTab === "SETTINGS" ? (
          <div className="space-y-4 text-xs">
            {/* 1. 目標記憶保持率 (requestRetention) */}
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-200">
                  FSRS 目標記憶保持率 (request_retention)
                </label>
                <span className="font-mono text-sm font-bold text-indigo-400">
                  {Math.round(settings.requestRetention * 100)}% (
                  {settings.requestRetention.toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                min={0.7}
                max={0.95}
                step={0.01}
                value={settings.requestRetention}
                onChange={(e) => updateSettings({ requestRetention: parseFloat(e.target.value) })}
                className="w-full cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                推奨値: <strong>82% (0.82)</strong>
                。高すぎる設定（90%以上）は復習間隔が極端に短くなり学習負荷が急増します。
              </p>
            </div>

            {/* 2. 講義プールの待機ロック時間 (waitingDurationHours) */}
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-200">
                  講義専用プールの待機ロック時間
                </label>
                <select
                  value={settings.waitingDurationHours}
                  onChange={(e) =>
                    updateSettings({
                      waitingDurationHours: Number(e.target.value),
                    })
                  }
                  className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-white outline-none"
                >
                  <option value={1}>1 時間</option>
                  <option value={4}>4 時間</option>
                  <option value={6}>6 時間</option>
                  <option value={8}>8 時間（推奨・デフォルト）</option>
                  <option value={12}>12 時間</option>
                  <option value={24}>24 時間</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-400">
                未暗記カードに1回正解したあと、2回目の卒業テストが可能になるまでの冷却時間です。
              </p>
            </div>

            {/* 3. 先取り補充枠 (enableEarlyReview) */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="space-y-1">
                <div className="font-semibold text-slate-200">
                  ⚡ 先取り（パープル）カードの自動補充
                </div>
                <p className="text-[11px] text-slate-400">
                  本日の復習カードが10問未満のとき、翌日以降に期日が来るカードを近い順に10問まで補充します。
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    enableEarlyReview: !settings.enableEarlyReview,
                  })
                }
                className={`flex-shrink-0 cursor-pointer rounded-lg px-3.5 py-1.5 font-bold transition ${
                  settings.enableEarlyReview
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {settings.enableEarlyReview ? "ON" : "OFF"}
              </button>
            </div>

            {/* 4. 出題順 (sortOrder) */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="space-y-1">
                <div className="font-semibold text-slate-200">共通プールのカテゴリ内出題順</div>
                <p className="text-[11px] text-slate-400">
                  優先・通常カテゴリ内でのカードの並び順を選択します（いずれの場合も🔁リベンジ枠が先頭になります）。
                </p>
              </div>
              <select
                value={settings.sortOrder}
                onChange={(e) =>
                  updateSettings({
                    sortOrder: e.target.value as "DUE_ASC" | "SHUFFLE",
                  })
                }
                className="flex-shrink-0 cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white outline-none"
              >
                <option value="DUE_ASC">期日昇順 (DUE_ASC)</option>
                <option value="SHUFFLE">シャッフル (SHUFFLE)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => updateSettings(DEFAULT_APP_SETTINGS)}
                className="cursor-pointer text-[11px] text-slate-400 underline hover:text-white"
              >
                初期設定（デフォルト）に戻す
              </button>
              <span className="text-[11px] text-slate-500">
                日付変更線: 毎日 午前0{settings.dayCutoffHour}:00
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {backupNotice && (
              <div
                className={`rounded-xl border p-3 ${
                  backupNotice.type === "success"
                    ? "border-emerald-800/60 bg-emerald-950/60 text-emerald-200"
                    : "border-rose-800/60 bg-rose-950/60 text-rose-200"
                }`}
              >
                {backupNotice.message}
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  📤 フルバックアップのエクスポート (JSON)
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {courses.length}科目 / {lectures.length}講義 / {cards.length}枚
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                全カードの所属科目・講義情報、短期特訓フェーズ、およびFSRS長期記憶パラメータを1つの自己完結型JSONファイルとして保存します。
              </p>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 font-semibold text-white shadow transition hover:bg-indigo-500"
              >
                <CheckIcon size={14} />
                <span>JSONバックアップファイルをダウンロード</span>
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="font-semibold text-slate-200">
                📥 マージインポート（既存名維持・差分統合）
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                バックアップJSONファイルを読み込みます。同じIDの科目・講義が既に存在する場合は現在の名称を維持し、新しい講義やカードを安全にマージします。
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileImport}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800 py-2.5 font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                JSONファイルを選択してマージインポート...
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-800 pt-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
