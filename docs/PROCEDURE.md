ウェブアプリ開発における認知負荷（「次に何をすべきか」を迷う脳のメモリ消費）を最小化するための**開発実践手順書**です。

---

# 認知負荷最小化・ウェブアプリ開発標準手順書

## 開発の3大原則

1. **「画面単位」ではなく「機能（1つの動詞）単位」で縦割りに完結させる**
   画面全体を一度に作ろうとせず、「一覧表示」「作成」「完了切替」など、1本のデータフローごとに開発します。
2. **全体で揃えるのは「動詞の洗い出し」と「TS型の骨格」まで**
   バリデーションや詳細仕様まで一括で決めようとすると机上の空論になります。動的なルールは各機能の実装時に決定します。
3. **「1フェーズ＝1つの問い」に固定し、触るファイルは最大2個に限定する**
   見た目（CSS）とロジック（型・通信）を同時に考えない仕組みを徹底します。

---

## 全体ロードマップ

```
【全体共通フェーズ（足並みを揃える：目安30〜60分）】
  0-1. 画面と機能（動詞）の粗いリスト化
       ↓
  0-2. コアドメインのTypeScriptインターフェース・スケッチ
       ↓
【機能ごとの縦割りスプリント（1動詞ずつフェーズ1〜5を完結）】
  ※ 着手順：表示(Read) → 作成(Create) → 更新(Update) → 削除(Delete)
       ├ Phase 1: 機能仕様の確定（Markdown）
       ├ Phase 2: データ契約・Zodスキーマ定義（types.ts）
       ├ Phase 3: データアクセス層の疎通確認（repository.ts）
       ├ Phase 4: 骨格UIと状態結合・生HTML（Component.tsx）
       └ Phase 5: 表層仕上げ・CSS/UX（Component.tsx）
       ↓
【画面統合（認知負荷ゼロの配置作業）】
  完成した部品を Page コンポーネントに並べる
```

---

## STEP 0: 全体共通フェーズ（足並みを揃える）

全体のリレーション破綻（後戻り）を防ぐため、最初に着手します。**所要時間は最大1時間にとどめます。**

### 0-1. 画面と動詞の粗い洗い出し

- **解くべき問い**: 「どの画面で、ユーザーは何の操作ができるのか？」
- **成果物**: `specs/features-overview.md`
- **ルール**: エラー処理やUI挙動の詳細は書かない。「画面名」と「動詞」の対応関係だけを書き出す。

```markdown
# 画面・機能一覧（粗いリスト）

## 1. ダッシュボード画面（/）

- 今日のタスク一覧を見る (Read)
- タスクの完了/未完了を切り替える (Update)

## 2. プロジェクト詳細画面（/projects/:id）

- タスク一覧を見る (Read)
- 新規タスクを追加する (Create)
- タスクを削除する (Delete)
```

### 0-2. コアドメインのTSスケッチ

- **解くべき問い**: 「アプリ全体の主要な登場人物と、それらのリレーション（関連）は何か？」
- **成果物**: `specs/domain-sketch.ts`
- **境界線（終了サイン）**: **TypeScriptの `interface` や `type` だけで記述する。**
- **禁止事項**: **Zodは使わない。** 文字数制限、UUID検証、フォーム専用の型などは考えない。

```tsx
// あくまで骨格と関連（外部キー）のみを宣言
export type UserId = string;
export type ProjectId = string;
export type TaskId = string;

export interface Project {
  id: ProjectId;
  name: string;
  ownerId: UserId;
}

export interface Task {
  id: TaskId;
  projectId: ProjectId;
  assigneeId: UserId | null;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  createdAt: string;
}
```

---

## STEP 1〜5: 機能ごとの縦割りスプリント

1つの動詞（例：「タスク完了トグル」）を選び、以下の5工程を一気に駆け抜けます。

> **推奨実装順序**:
>
> 1. **表示（Read）**: 初期状態の目視確認用。まずはダミーデータで表示を通す。
> 2. **作成（Create）**: 入力結果が表示に反映されるかを確認。
> 3. **更新（Update）／ 削除（Delete）**: 既存データへの操作を肉付け。

---

### Phase 1: 機能仕様の確定

- **解くべき問い**: 「この操作によって、データと状態はどう変化するか？」
- **成果物**: `specs/[feature-name].md`
- **禁止事項**: JSX/HTML、CSS、コンポーネント分割について考えない。

```markdown
# 仕様: タスク完了トグル

## ユーザー操作

- チェックボックスをクリックすると、完了/未完了が切り替わる。

## 状態変化

- status が 'DONE' または 'TODO' に更新される。

## 例外系・エッジケース

- 更新リクエスト中はチェックボックスを非活性（連打防止）。
- 通信失敗時は元のチェック状態に戻し、エラーを表示する。
- 0件時は「タスクがありません」を表示。
```

### Phase 2: データ契約 & Zod定義

- **解くべき問い**: 「この機能の入出力に必要な型とランタイムバリデーションは何か？」
- **成果物**: `src/entities/[entity]/model/types.ts`
- **やること**: ここで初めて **Zod** を導入し、この機能に必要な入力値の制約を定義する。
- **禁止事項**: 画面実装、ストレージ/APIの実装。

```tsx
import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(["TODO", "DONE"]),
  updatedAt: z.string().datetime(),
});

// この機能（更新）に特化した入力型
export const UpdateTaskStatusInputSchema = z.object({
  status: z.enum(["TODO", "DONE"]),
});

export type Task = z.infer<typeof TaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusInputSchema>;
```

### Phase 3: データアクセス層（I/O）の疎通

- **解くべき問い**: 「UIがなくても、関数呼び出し単体でデータの読み書きが成立するか？」
- **成果物**: `src/entities/[entity]/api/[entity]Repository.ts`
- **やること**: 呼び出し関数（またはリポジトリ）を定義し、コンソールや最小スクリプトでCRUDの疎通を確認する。
- **禁止事項**: UIコンポーネントの作成。

```tsx
import { Task, UpdateTaskStatusInput } from "../model/types";

export interface TaskRepository {
  updateStatus(id: string, input: UpdateTaskStatusInput): Promise<Task>;
}

// モックまたはLocalStorage/API通信を実装
export const taskRepository: TaskRepository = {
  async updateStatus(id: string, input: UpdateTaskStatusInput): Promise<Task> {
    // 取得・更新・保存処理
    return updatedTask;
  },
};
```

### Phase 4: 骨格UIと状態結合（ワイヤーレベル）

- **解くべき問い**: 「生HTMLとイベントで、データの取得・表示・更新が画面上で繋がっているか？」
- **成果物**: `src/features/[feature]/ui/[ComponentName].tsx`
- **やること**: 標準HTMLタグ（`<button>`, `<input>`, `<ul>`）のみで組み、Phase 3の関数と結合する。
- **禁止事項**: **CSSを1文字も書かない。** 余白、色、レスポンシブ対応は一切触らない。

```tsx
import { useState } from "react";
import { Task } from "../../../entities/task/model/types";
import { taskRepository } from "../../../entities/task/api/taskRepository";

export const TaskItem = ({
  task,
  onUpdate,
}: {
  task: Task;
  onUpdate: (t: Task) => void;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
      const updated = await taskRepository.updateStatus(task.id, {
        status: nextStatus,
      });
      onUpdate(updated);
    } catch {
      setError("更新失敗");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      <input
        type="checkbox"
        checked={task.status === "DONE"}
        onChange={handleToggle}
        disabled={isUpdating}
      />
      <span>{task.title}</span>
      {isUpdating && <span> (更新中...)</span>}
      {error && <span style={{ color: "red" }}>{error}</span>}
    </div>
  );
};
```

### Phase 5: 表層（UI/UX・スタイリング）の仕上げ

- **解くべき問い**: 「使いやすく、崩れず、視認性が保たれているか？」
- **成果物**: `src/features/[feature]/ui/[ComponentName].tsx`
- **やること**: Tailwind CSS等の適用、ローディング状態・エラー状態の装飾、アクセシビリティ対応。
- **禁止事項**: データフローや型定義（Phase 2〜3）の根本的な変更。

```tsx
// Phase 4のロジックはそのまま維持し、マークアップとスタイルのみを更新
return (
  <div className="flex items-center justify-between p-3 border-b border-slate-200 hover:bg-slate-50 transition-colors">
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        checked={task.status === "DONE"}
        onChange={handleToggle}
        disabled={isUpdating}
      />
      <span
        className={`text-sm ${task.status === "DONE" ? "line-through text-slate-400" : "text-slate-800"}`}
      >
        {task.title}
      </span>
    </label>
    {isUpdating && (
      <span className="text-xs text-slate-400 animate-pulse">保存中...</span>
    )}
    {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
  </div>
);
```

---

## STEP 6: 画面統合（Pageコンポーネントへの配置）

機能単位のコンポーネントが完成したら、Pageコンポーネントでそれらをインポートして並べるだけです。

- **解くべき問い**: 「画面上のどこにどのコンポーネントをレイアウトするか？」
- すでに個々の機能がロジックとスタイリングを含めて自立しているため、ページレベルで考えるべきは「Grid/Flexによる余白と配置」のみになり、認知負荷はほぼゼロになります。

---

## 認知負荷を下げるチートシート

| よくある詰まり・疲労の原因                        | 発生している問題                                 | 処方箋（このルールを適用する）                                                         |
| ------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **画面を作りながらデータ構造を考えている**        | 「配置」と「型の整合性」を同時に考えて脳がパンク | **Phase 2（Zod/型）が完了するまでJSXファイルを開かない**                               |
| **機能が動かない原因がCSSかロジックか分からない** | 関心事が分離されていない                         | **Phase 4で素のHTMLのまま疎通を確認するまでCSSに触らない**                             |
| **途中でデータ構造の変更が大規模に発生した**      | 画面ごとの入出力を最初から一括で決めすぎた       | **全体で揃えるのはPhase 1.5（TSインターフェース）までにとどめ、Zodは縦割りの中で書く** |
| **画面がいつまでも動く状態にならない**            | 画面単位（巨大な単位）で進めている               | **「動詞」単位（一覧表示 → 作成 → 更新）に分解し、1つずつ完成させる**                  |

この開発手順とも相性が良いか？（ディレクトリ構造を修正する）
