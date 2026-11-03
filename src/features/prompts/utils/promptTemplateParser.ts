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
  key: string; // 変数キー (変数名と同一)
  name: string; // 表示用変数名
  fallback?: string; // 未入力時の既定値（フォールバック）
  isRequired: boolean; // 必須変数フラグ（未入力時にコピー防止）
}

const HYPHEN_BULLET_PREFIX_REGEX = /^-\s+/;
const PLUS_BULLET_PREFIX_REGEX = /^\+\s+/;
const ASTERISK_BULLET_PREFIX_REGEX = /^\*\s+/;
const HEADING_LINE_REGEX = /^(#{1,6})\s+(.*)$/;
const CUSTOM_BLOCK_OPEN_REGEX = /^\[BLOCK(?::\s*([^\]]+))?\]$/i;
const CUSTOM_BLOCK_CLOSE_REGEX = /^\[\/BLOCK\]$/i;
const INLINE_VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g;
const TRAILING_CONDITION_REGEX = /\s*\(\(([^{}]+?)\)\)\s*$/;
const VARS_BLOCK_REGEX = /```vars\s*([\s\S]*?)\s*```/i;
const DOUBLE_SEPARATOR_REGEX = /(?:\r?\n|^)\s*-{3,}\s*\r?\n\s*-{3,}\s*(?:\r?\n|$)/;

/**
 * テンプレート文字列から ```vars ... ``` メタデータブロックを抽出・除去する
 */
export function extractVarsBlock(content: string): {
  body: string;
  varsJson: string | null;
} {
  const match = content.match(VARS_BLOCK_REGEX);
  if (!match) {
    return { body: content, varsJson: null };
  }
  const body = content.replace(VARS_BLOCK_REGEX, "").trim();
  const varsJson = match[1].trim();
  return { body, varsJson };
}

/**
 * ```vars の JSON 文字列をパースして変数定義の配列を取得する
 */
export function parseVarsBlockJson(jsonText: string): PromptVariableDefinition[] | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return null;

    const defs: PromptVariableDefinition[] = [];
    for (const item of parsed) {
      if (typeof item === "object" && item !== null && typeof item.name === "string" && item.name.trim()) {
        const name = item.name.trim();
        const fallback =
          typeof item.fallback === "string" && item.fallback.trim() !== ""
            ? item.fallback.trim()
            : undefined;
        const isRequired = item.required === true;
        defs.push({
          key: name,
          name,
          fallback,
          isRequired,
        });
      }
    }
    return defs;
  } catch {
    return null;
  }
}

/**
 * 変数名から一意なキーを生成する
 */
export function getVariableKey(name: string, fallback?: string): string {
  void fallback;
  return name.trim();
}

/**
 * ハイフン「- 」による箇条書き行かどうか判定する（省略可能・デフォルトON）
 */
export function isHyphenBulletLine(line: string): boolean {
  return HYPHEN_BULLET_PREFIX_REGEX.test(line.trim());
}

/**
 * プラス「+ 」による箇条書き行かどうか判定する（省略可能・デフォルトOFF・出力時は「- 」に変換）
 */
export function isPlusBulletLine(line: string): boolean {
  return PLUS_BULLET_PREFIX_REGEX.test(line.trim());
}

/**
 * アスタリスク「* 」による箇条書き行かどうか判定する（省略不可・固定保護・出力時は「- 」に変換）
 */
export function isAsteriskBulletLine(line: string): boolean {
  return ASTERISK_BULLET_PREFIX_REGEX.test(line.trim());
}

/**
 * 「+ 」または「* 」で始まる箇条書き行を出力用の「- 」に正規化する
 */
export function normalizeBulletPrefix(line: string): string {
  const trimmed = line.trim();
  if (PLUS_BULLET_PREFIX_REGEX.test(trimmed)) {
    return line.replace(/^(\s*)\+\s+/, "$1- ");
  }
  if (ASTERISK_BULLET_PREFIX_REGEX.test(trimmed)) {
    return line.replace(/^(\s*)\*\s+/, "$1- ");
  }
  return line;
}

/**
 * 変数トークンから変数名を取得する（後方互換用のインターフェースを維持）
 */
export function parseVariableToken(token: string): {
  varName: string;
  fallback?: string;
  isRequired: boolean;
} {
  return {
    varName: token.trim(),
    fallback: undefined,
    isRequired: false,
  };
}

/**
 * テンプレート内の変数定義（名前、フォールバック、必須フラグ等）を抽出する
 * 1. 末尾の ```vars ... ``` メタデータJSONブロックがある場合はその定義（および配列の並び順）を優先採用
 * 2. 本文中にあって ```vars に含まれていない変数は「デフォルト設定（必須ではない・フォールバックなし）」として末尾に出現順で追加
 */
export function extractTemplateVariableDefinitions(content: string): PromptVariableDefinition[] {
  const { body, varsJson } = extractVarsBlock(content);
  const defs: PromptVariableDefinition[] = [];
  const seenNames = new Set<string>();

  // 1. ```vars メタデータブロックがあれば優先的に登録
  if (varsJson) {
    const parsedDefs = parseVarsBlockJson(varsJson);
    if (parsedDefs) {
      for (const def of parsedDefs) {
        if (!seenNames.has(def.name)) {
          seenNames.add(def.name);
          defs.push(def);
        }
      }
    }
  }

  // 2. 本文に出現する変数を走査
  // メタデータ未定義の変数は「デフォルト設定（必須ではない・フォールバックなし）」として末尾に追加
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    INLINE_VARIABLE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_VARIABLE_REGEX.exec(line)) !== null) {
      const varName = match[1].trim();
      if (varName && !seenNames.has(varName)) {
        seenNames.add(varName);
        defs.push({
          key: varName,
          name: varName,
          fallback: undefined,
          isRequired: false,
        });
      }
    }
  }

  return defs;
}

/**
 * テンプレート文字列を連動ブロック・通常行に分解する
 * 1. [BLOCK:タイトル]...[/BLOCK] または [BLOCK]...[/BLOCK] は指定された範囲で連動（トグル可能）
 * 2. ```...``` (コードブロック) は省略不可の固定セグメント
 * 3. セクション見出し行 (# タイトル) などは固定表示
 * 4. 箇条書き行（- または +）は1行単位でトグル可能、* による箇条書きやそれ以外の通常行は固定セグメント
 */
export function parseTemplateSegments(
  content: string,
  savedEnabledMap?: Record<string, boolean>,
): TemplateSegment[] {
  // ```vars メタデータブロックはプロンプトのセグメント・出力から除外
  const { body } = extractVarsBlock(content);
  const lines = body.split(/\r?\n/);
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

    // 3. 通常の行
    // - 「- 」で始まる行: 省略可能（isToggleable: true、デフォルトON）
    // - 「+ 」で始まる行: 省略可能（isToggleable: true、デフォルトOFF・出力時は「- 」に自動変換）
    // - 「* 」で始まる行: 省略不可（isToggleable: false、固定保護・出力時は「- 」に自動変換）
    // - それ以外の行（通常の文章や見出し等）も省略不可（STATIC）
    const isHyphen = isHyphenBulletLine(line);
    const isPlus = isPlusBulletLine(line);
    const isAsterisk = isAsteriskBulletLine(line);
    const isToggleable = isHyphen || isPlus;

    let segmentType: TemplateSegment["type"] = "STATIC";
    if (isHyphen || isPlus || isAsterisk) {
      segmentType = "BULLET";
    }

    const segmentId = `${isToggleable ? "bullet" : "static"}_${index++}`;
    // 保存済み設定があればそれを優先。未設定時のデフォルト: ハイフンはON (true)、プラスはOFF (false)
    const defaultInitialState = isPlus ? false : true;
    const isEnabled = isToggleable ? (savedEnabledMap?.[segmentId] ?? defaultInitialState) : true;
    const cleanDisplayText = line.replace(TRAILING_CONDITION_REGEX, "");

    segments.push({
      id: segmentId,
      type: segmentType,
      isToggleable,
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
 * - 省略可能変数（未入力かつフォールバックなし）が含まれる場合、行全体を省略（null を返す）
 * - 行末に ((変数名)) があり、その変数が省略可能かつ未入力の場合、行全体を省略（null を返す）
 */
export function processTemplateLine(
  line: string,
  variables: Record<string, string>,
  defsMap?: Map<string, PromptVariableDefinition>,
): string | null {
  let targetLine = line;

  // 1. 行末の ((変数名)) のチェックと除去
  const condMatch = targetLine.match(TRAILING_CONDITION_REGEX);
  let conditionVarName: string | null = null;
  if (condMatch) {
    conditionVarName = condMatch[1].trim();
    targetLine = targetLine.slice(0, condMatch.index);
  }

  // 2. 行に含まれるインライン変数 {{...}} を走査
  INLINE_VARIABLE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  const lineVarNames: string[] = [];
  while ((match = INLINE_VARIABLE_REGEX.exec(targetLine)) !== null) {
    lineVarNames.push(match[1].trim());
  }

  // 3. 行内の省略可能変数（!isRequired かつ fallback がないもの）の未入力判定
  for (const varName of lineVarNames) {
    const metaDef = defsMap?.get(varName);
    const isRequired = metaDef?.isRequired ?? false;
    const fallback = metaDef?.fallback;

    if (!isRequired && fallback === undefined) {
      const val = variables[varName];
      if (!val || val.trim().length === 0) {
        return null; // 省略可能変数が未入力なので行全体を省略
      }
    }
  }

  // 4. 行末の ((変数名)) 条件の判定
  if (conditionVarName) {
    const metaDef = defsMap?.get(conditionVarName);
    const isReq = metaDef?.isRequired ?? false;

    // 変数が省略可能（!isRequired）かつ未入力の場合に行全体を削除
    if (!isReq) {
      const val = variables[conditionVarName];
      if (!val || val.trim().length === 0) {
        return null;
      }
    }
  }

  // 5. 変数の実際の置換
  const replacedLine = targetLine.replace(INLINE_VARIABLE_REGEX, (m, rawName) => {
    const varName = rawName.trim();
    const metaDef = defsMap?.get(varName);
    const val = variables[varName];

    if (val !== undefined && val.trim().length > 0) {
      return val.trim();
    }
    if (metaDef?.fallback !== undefined) {
      return metaDef.fallback;
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
  variableDefs?: PromptVariableDefinition[],
): string {
  const activeLines: string[] = [];
  const defsMap = variableDefs ? new Map(variableDefs.map((d) => [d.name, d])) : undefined;

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
      const processed = processTemplateLine(line, variables, defsMap);
      if (processed !== null) {
        // 出力時は「+ 」「* 」のリストを「- 」に正規化
        activeLines.push(normalizeBulletPrefix(processed));
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
