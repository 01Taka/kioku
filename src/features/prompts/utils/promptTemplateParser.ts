/**
 * プロンプトテンプレートのパース・変数抽出・行・ブロック連動ユーティリティ
 */

export interface TemplateSegment {
  id: string;
  type: "BULLET" | "CODE_BLOCK" | "CUSTOM_BLOCK" | "STATIC";
  isToggleable: boolean; // チェックボックスでON/OFFできるか（箇条書き or 明示的ブロック）
  title?: string;
  displayText: string; // UI表示用のテキスト（BLOCKタグなどを整理したもの）
  outputTemplate: string; // 最終出力用のテンプレート（BLOCKタグを除去したもの）
  defaultEnabled: boolean;
}

export interface PromptVariableDefinition {
  key: string; // 一意キー (例: "問題数|10", "問題数|20", "問題数")
  name: string; // 表示用変数名 (例: "問題数")
  fallback?: string;
  isRequired: boolean; // *変数名 で指定された必須変数
}

const BULLET_PREFIX_REGEX = /^[-*+]\s+/;
const NUMBERED_LIST_REGEX = /^\d+[.)]\s+/;
const HEADING_LINE_REGEX = /^(#{1,6})\s+(.*)$/;
const CUSTOM_BLOCK_OPEN_REGEX = /^\[BLOCK(?::\s*([^\]]+))?\]$/i;
const CUSTOM_BLOCK_CLOSE_REGEX = /^\[\/BLOCK\]$/i;
const INLINE_VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g;
const TRAILING_CONDITION_REGEX = /\s*\(\(([^{}]+?)\)\)\s*$/;
const DOUBLE_SEPARATOR_REGEX = /(?:\r?\n|^)\s*-{3,}\s*\r?\n\s*-{3,}\s*(?:\r?\n|$)/;

/**
 * 変数名とフォールバック値から一意なキーを生成する
 * フォールバックが異なる変数は、同じ名前であっても異なる変数として扱う
 */
export function getVariableKey(name: string, fallback?: string): string {
  return fallback !== undefined ? `${name}|${fallback}` : name;
}

/**
 * 箇条書き（リスト項目）かどうか判定する
 * 行頭が -, *, +, または 1. 2. 等の数字付きリスト
 */
export function isBulletLine(line: string): boolean {
  const trimmed = line.trim();
  return BULLET_PREFIX_REGEX.test(trimmed) || NUMBERED_LIST_REGEX.test(trimmed);
}

/**
 * {{変数名|フォールバック}} または {{*変数名}} の中身をパースする
 * - 変数名の先頭に * がある場合は必須変数 (isRequired: true)
 * - {{変数名}} または {{変数名|}} は省略可能変数 (isRequired: false)
 */
export function parseVariableToken(token: string): {
  varName: string;
  fallback?: string;
  isRequired: boolean;
} {
  const pipeIndex = token.indexOf("|");
  let rawName: string;
  let fallback: string | undefined;

  if (pipeIndex === -1) {
    rawName = token.trim();
    fallback = undefined;
  } else {
    rawName = token.slice(0, pipeIndex).trim();
    const rawFallback = token.slice(pipeIndex + 1).trim();
    fallback = rawFallback !== "" ? rawFallback : undefined;
  }

  const isRequired = rawName.startsWith("*");
  const varName = isRequired ? rawName.slice(1).trim() : rawName;

  return {
    varName,
    fallback,
    isRequired,
  };
}

/**
 * テンプレート内の変数定義（名前、フォールバック、必須フラグ等）を抽出する
 * - 変数のフォールバックが異なる変数は同じ名前の異なる変数として扱う
 * - {{*変数名}} の形式のみ「必須の質問」とする（{{変数名}} や {{変数名|}} は省略可能）
 */
export function extractTemplateVariableDefinitions(content: string): PromptVariableDefinition[] {
  const lines = content.split(/\r?\n/);
  const defs: PromptVariableDefinition[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines) {
    INLINE_VARIABLE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_VARIABLE_REGEX.exec(line)) !== null) {
      const token = parseVariableToken(match[1]);
      if (token.varName) {
        const varKey = getVariableKey(token.varName, token.fallback);
        if (!seenKeys.has(varKey)) {
          seenKeys.add(varKey);
          defs.push({
            key: varKey,
            name: token.varName,
            fallback: token.fallback,
            isRequired: token.isRequired,
          });
        }
      }
    }
  }

  return defs;
}

/**
 * テンプレート文字列を連動ブロック・通常行に分解する
 * 1. [BLOCK:タイトル]...[/BLOCK] または [BLOCK]...[/BLOCK] は指定された範囲で連動（トグル可能）
 * 2. ```...``` (コードブロック) は省略不可の固定セグメント
 * 3. セクション見出し変数行 (# タイトル {{...}}) は固定表示で未入力時に見出しごと自動削除
 * 4. 箇条書き行は1行単位でトグル可能、それ以外の通常行は固定セグメント
 */
export function parseTemplateSegments(
  content: string,
  savedEnabledMap?: Record<string, boolean>,
): TemplateSegment[] {
  const lines = content.split(/\r?\n/);
  const segments: TemplateSegment[] = [];
  let index = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 空行は単独のトグル項目にせずスキップ
    if (!line.trim()) {
      i++;
      continue;
    }

    // 1. [BLOCK:タイトル]...[/BLOCK] または [BLOCK]...[/BLOCK]
    const customBlockMatch = line.trim().match(CUSTOM_BLOCK_OPEN_REGEX);
    if (customBlockMatch) {
      const blockTitle = customBlockMatch[1]?.trim() || "連動ブロック";
      const blockLines: string[] = [];
      i++; // [BLOCK...] の次行から探索

      while (i < lines.length) {
        if (CUSTOM_BLOCK_CLOSE_REGEX.test(lines[i].trim())) {
          i++; // [/BLOCK] を消費
          break;
        }
        blockLines.push(lines[i]);
        i++;
      }

      const segmentId = `block_${index++}`;
      const outputText = blockLines.join("\n");
      const displayText = blockLines
        .map((l) => l.replace(TRAILING_CONDITION_REGEX, ""))
        .join("\n");
      const isEnabled = savedEnabledMap?.[segmentId] ?? true;

      segments.push({
        id: segmentId,
        type: "CUSTOM_BLOCK",
        isToggleable: true,
        title: blockTitle,
        displayText: displayText || "(空のブロック)",
        outputTemplate: outputText,
        defaultEnabled: isEnabled,
      });
      continue;
    }

    // 2. ```...``` (コードブロック: 明示的 [BLOCK] 外のため省略不可の固定要素)
    if (line.trim().startsWith("```")) {
      const codeBlockLines: string[] = [line];
      i++;

      while (i < lines.length) {
        codeBlockLines.push(lines[i]);
        if (lines[i].trim().startsWith("```")) {
          i++;
          break;
        }
        i++;
      }

      const segmentId = `code_${index++}`;
      const outputText = codeBlockLines.join("\n");

      segments.push({
        id: segmentId,
        type: "CODE_BLOCK",
        isToggleable: false,
        displayText: outputText,
        outputTemplate: outputText,
        defaultEnabled: true,
      });
      continue;
    }

    // 3. 通常の行（箇条書き行はトグル可能、それ以外の文章や見出しは固定STATIC）
    const isBullet = isBulletLine(line);
    const segmentId = `${isBullet ? "bullet" : "static"}_${index++}`;
    const isEnabled = isBullet ? (savedEnabledMap?.[segmentId] ?? true) : true;
    const cleanDisplayText = line.replace(TRAILING_CONDITION_REGEX, "");

    segments.push({
      id: segmentId,
      type: isBullet ? "BULLET" : "STATIC",
      isToggleable: isBullet,
      displayText: cleanDisplayText,
      outputTemplate: line,
      defaultEnabled: isEnabled,
    });
    i++;
  }

  return segments;
}

/**
 * 1行のテキストを処理し、省略可能変数や末尾の ((変数名)) 条件に基づいて行を保持するか判定・変換する
 * - 行末の ((変数名)) はノイズ防止のため常に削除
 * - 省略可能変数（{{変数名}} または {{変数名|}}）が含まれ、ユーザー入力がない場合、行全体を省略（null を返す）
 * - 行末に ((変数名)) があり、その変数が省略可能かつユーザー入力がない場合、行全体を省略（null を返す）
 */
export function processTemplateLine(
  line: string,
  variables: Record<string, string>,
): string | null {
  let targetLine = line;

  // 1. 行末の ((変数名)) のチェックと除去
  const condMatch = targetLine.match(TRAILING_CONDITION_REGEX);
  let conditionVarName: string | null = null;
  if (condMatch) {
    conditionVarName = condMatch[1].trim();
    // 行末の ((...)) を除去
    targetLine = targetLine.slice(0, condMatch.index);
  }

  // 2. 行に含まれるインライン変数 {{...}} を走査
  INLINE_VARIABLE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  const lineTokens: ReturnType<typeof parseVariableToken>[] = [];
  while ((match = INLINE_VARIABLE_REGEX.exec(targetLine)) !== null) {
    lineTokens.push(parseVariableToken(match[1]));
  }

  // 3. 行内の省略可能変数（!isRequired かつ fallback がないもの）の未入力判定
  for (const token of lineTokens) {
    if (!token.isRequired && token.fallback === undefined) {
      const varKey = getVariableKey(token.varName, token.fallback);
      const val = variables[varKey];
      if (!val || val.trim().length === 0) {
        return null; // 省略可能変数が未入力なので行全体を省略
      }
    }
  }

  // 4. 行末の ((変数名)) 条件の判定
  if (conditionVarName) {
    const isReq = conditionVarName.startsWith("*");
    const cleanName = isReq ? conditionVarName.slice(1).trim() : conditionVarName;

    // 「その変数が省略可能かつユーザーが入力を省略した場合に削除」
    if (!isReq) {
      const varKey = getVariableKey(cleanName);
      const val = variables[varKey];
      if (!val || val.trim().length === 0) {
        return null;
      }
    }
  }

  // 5. 変数の実際の置換
  const replacedLine = targetLine.replace(INLINE_VARIABLE_REGEX, (m, rawKey) => {
    const token = parseVariableToken(rawKey);
    const varKey = getVariableKey(token.varName, token.fallback);
    const val = variables[varKey];

    if (val !== undefined && val.trim().length > 0) {
      return val.trim();
    }
    if (token.fallback !== undefined) {
      return token.fallback;
    }
    return m;
  });

  return replacedLine;
}

/**
 * 見出しの階層とコンテンツを管理するスタックアイテム
 */
interface HeadingStackItem {
  level: number; // # の数 (1〜6)
  headingLine: string; // 見出し行のテキスト
  contentLines: string[]; // この見出しの直下に属するコンテンツ行（子見出しの出力も含む）
}

/**
 * 処理済みの行リストから、配下のコンテンツがすべて省略された空の見出し行を自動除外する
 * - 見出しから次の自分以上の大きさの見出しまで（または末尾まで）のすべての行が省略された場合は見出しも省略
 * - 下位レベルの見出しが省略され、結果として親見出しの配下も空になった場合は親見出しも連鎖して省略
 */
export function pruneEmptyHeadings(lines: string[]): string[] {
  // スタックを用いて見出し階層を走査
  // level 0 はルート（見出しの前に書かれた冒頭テキストなど）
  const stack: HeadingStackItem[] = [
    { level: 0, headingLine: "", contentLines: [] },
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // 空行は現在のコンテキストのコンテンツ行に追加
      stack[stack.length - 1].contentLines.push(line);
      continue;
    }

    const headingMatch = line.match(HEADING_LINE_REGEX);
    if (headingMatch) {
      const level = headingMatch[1].length;

      // 現在のレベル以上の見出しをスタックからポップし、コンテンツがあれば親に結合
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        const item = stack.pop()!;
        const hasContent = item.contentLines.some((l) => l.trim().length > 0);
        if (hasContent) {
          // コンテンツがある場合のみ、見出し行とコンテンツを親に追加
          stack[stack.length - 1].contentLines.push(item.headingLine);
          stack[stack.length - 1].contentLines.push(...item.contentLines);
        }
      }

      // 新しい見出しをスタックにプッシュ
      stack.push({
        level,
        headingLine: line,
        contentLines: [],
      });
    } else {
      // 通常の行は現在の見出しのコンテンツに追加
      stack[stack.length - 1].contentLines.push(line);
    }
  }

  // 残りのスタックをルートまで巻き戻す
  while (stack.length > 1) {
    const item = stack.pop()!;
    const hasContent = item.contentLines.some((l) => l.trim().length > 0);
    if (hasContent) {
      stack[stack.length - 1].contentLines.push(item.headingLine);
      stack[stack.length - 1].contentLines.push(...item.contentLines);
    }
  }

  return stack[0].contentLines;
}

/**
 * 有効なセグメントのみを抽出し、変数を置換して最終プロンプトテキストを組み立てる
 * - isToggleable が false のセグメントは常に含まれる
 * - 通常行: 省略可能変数の未入力や行末の ((変数名)) 条件により行単位で削除
 * - 見出しの自動省略: 見出し配下のすべての行が省略された場合、その見出し自体も自動省略される
 */
export function assemblePrompt(
  segments: TemplateSegment[],
  activeSegmentIds: Set<string>,
  variables: Record<string, string>,
): string {
  const activeLines: string[] = [];

  for (const seg of segments) {
    if (seg.isToggleable && !activeSegmentIds.has(seg.id)) {
      continue;
    }

    // コードブロックは行ごとの削除や見出し判定を行わずそのまま出力
    if (seg.type === "CODE_BLOCK") {
      activeLines.push(seg.outputTemplate);
      continue;
    }

    // それ以外のセグメント（STATIC, BULLET, CUSTOM_BLOCK）は行ごとに処理
    const segLines = seg.outputTemplate.split(/\r?\n/);
    for (const line of segLines) {
      const processed = processTemplateLine(line, variables);
      if (processed !== null) {
        activeLines.push(processed);
      }
    }
  }

  // 空の見出しセクションを再帰的・連鎖的に除外
  const prunedLines = pruneEmptyHeadings(activeLines);

  // 連続する空行を整理し、全体をトリムして結合
  const result: string[] = [];
  let prevEmpty = false;

  for (const line of prunedLines) {
    const isEmpty = line.trim().length === 0;
    if (isEmpty) {
      if (!prevEmpty && result.length > 0) {
        result.push("");
        prevEmpty = true;
      }
    } else {
      result.push(line);
      prevEmpty = false;
    }
  }

  return result.join("\n").trim();
}

/**
 * クリップボード等のテキストからテンプレート名・概要・本文を二重区切り線（--- \n ---）で分割パースする
 * 表記揺れ（#や見出し文字）に依存せず、二重の区切り線のみを確実なセパレーターとして認識
 */
export function parseTemplateClipboardText(rawText: string): {
  isStructured: boolean;
  name?: string;
  description?: string;
  content: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { isStructured: false, content: "" };
  }

  const parts = trimmed.split(DOUBLE_SEPARATOR_REGEX).map((p) => p.trim());

  if (parts.length >= 3) {
    const name = parts[0] || undefined;
    const description = parts[1] || undefined;
    const content = parts.slice(2).join("\n---\n---\n").trim();
    return {
      isStructured: true,
      name,
      description,
      content,
    };
  }

  if (parts.length === 2) {
    const name = parts[0] || undefined;
    const content = parts[1].trim();
    return {
      isStructured: true,
      name,
      content,
    };
  }

  return {
    isStructured: false,
    content: trimmed,
  };
}
