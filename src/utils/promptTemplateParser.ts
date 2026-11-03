/**
 * プロンプトテンプレートのパース・変数抽出・行・ブロック連動ユーティリティ
 */

export interface TemplateSegment {
  id: string;
  type: "LINE" | "BULLET" | "CODE_BLOCK" | "CUSTOM_BLOCK" | "STATIC" | "SECTION_VARIABLE";
  isToggleable: boolean; // チェックボックスでON/OFFできるか（箇条書き or 明示的ブロック）
  title?: string;
  rawText: string; // セグメント全体の生テキスト（BLOCKタグ含む）
  displayText: string; // UI表示用のテキスト（BLOCKタグなどを整理したもの）
  outputTemplate: string; // 最終出力用のテンプレート（BLOCKタグを除去したもの）
  defaultEnabled: boolean;
  sectionHeader?: string;
  boundVariable?: string;
  boundVariableKey?: string;
  fallback?: string;
}

export interface PromptVariableDefinition {
  key: string; // 一意キー (例: "問題数|10", "問題数|20", "問題数")
  name: string; // 表示用変数名 (例: "問題数")
  fallback?: string;
  isSectionVar: boolean;
  isRequired: boolean; // フォールバックがなく、かつセクション見出し変数ではない必須変数
}

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
  return /^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
}

/**
 * {{変数名|フォールバック}} の中身をパースする
 */
export function parseVariableToken(token: string): {
  varName: string;
  fallback?: string;
} {
  const pipeIndex = token.indexOf("|");
  if (pipeIndex === -1) {
    return {
      varName: token.trim(),
      fallback: undefined,
    };
  }
  const varName = token.slice(0, pipeIndex).trim();
  const fallback = token.slice(pipeIndex + 1).trim();
  return {
    varName,
    fallback: fallback !== "" ? fallback : undefined,
  };
}

/**
 * セクション見出し変数行 (# セクションタイトル {{...}}) を判定・解析する
 * 例:
 *  # セクションタイトル {{}}
 *  # セクションタイトル {{|フォールバック}}
 *  # セクションタイトル {{変数名}}
 *  # セクションタイトル {{変数名|フォールバック}}
 */
export function parseSectionVarLine(line: string): {
  isSectionVar: boolean;
  headerPrefix?: string;
  sectionTitle?: string;
  varName?: string;
  varKey?: string;
  fallback?: string;
  sectionHeader?: string;
} {
  const match = line.trim().match(/^(#{1,6}\s+)(.*?)\s*\{\{\s*([^{}]*?)\s*\}\}\s*$/);
  if (!match) return { isSectionVar: false };

  const headerPrefix = match[1];
  const sectionTitle = match[2].trim();
  const token = parseVariableToken(match[3]);

  // # セクションタイトル {{}} や {{|フォールバック}} の場合、変数名が空ならセクションタイトルを変数名とする
  const varName = token.varName !== "" ? token.varName : sectionTitle;
  const varKey = getVariableKey(varName, token.fallback);
  const sectionHeader = `${headerPrefix}${sectionTitle}`;

  return {
    isSectionVar: true,
    headerPrefix,
    sectionTitle,
    varName,
    varKey,
    fallback: token.fallback,
    sectionHeader,
  };
}

/**
 * テンプレート内の変数定義（名前、フォールバック、必須フラグ等）を抽出する
 * - 変数のフォールバックが異なる変数は同じ名前の異なる変数として扱う
 * - |フォールバックがない通常変数は「必須の質問」とする
 * - セクション見出し形式（# セクション名 {{...}}）は未入力でもセクションごと削除されるため必須警告なし
 */
export function extractTemplateVariableDefinitions(content: string): PromptVariableDefinition[] {
  const lines = content.split(/\r?\n/);
  const defs: PromptVariableDefinition[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines) {
    const secVar = parseSectionVarLine(line);
    if (secVar.isSectionVar && secVar.varName && secVar.varKey) {
      if (!seenKeys.has(secVar.varKey)) {
        seenKeys.add(secVar.varKey);
        defs.push({
          key: secVar.varKey,
          name: secVar.varName,
          fallback: secVar.fallback,
          isSectionVar: true,
          isRequired: false, // セクション見出し変数は空でも削除されるだけで警告はなし
        });
      }
    } else {
      const regex = /\{\{([^{}]+)\}\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const token = parseVariableToken(match[1]);
        if (token.varName) {
          const varKey = getVariableKey(token.varName, token.fallback);
          if (!seenKeys.has(varKey)) {
            seenKeys.add(varKey);
            defs.push({
              key: varKey,
              name: token.varName,
              fallback: token.fallback,
              isSectionVar: false,
              // フォールバックがない場合それを必須の質問とする
              isRequired: token.fallback === undefined,
            });
          }
        }
      }
    }
  }

  return defs;
}

/**
 * テンプレート内の変数を重複なく順番通りに抽出する（変数名リスト）
 */
export function extractTemplateVariables(content: string): string[] {
  return extractTemplateVariableDefinitions(content).map((d) => d.name);
}

/**
 * テンプレート文字列を連動ブロック・通常行に分解する
 * 1. ```...``` (コードブロック) は自動で1つのセグメントに連動
 * 2. [BLOCK:タイトル]...[/BLOCK] または [BLOCK]...[/BLOCK] は指定された範囲で連動
 * 3. 上記以外の空行でない各行は、それぞれ1つの独立したセグメント
 * 4. 空行は直前のセグメントまたは自然な改行として扱われる（空行単体ではトグル項目にしない）
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
    const customBlockMatch = line.trim().match(/^\[BLOCK(?::\s*([^\]]+))?\]$/i);
    if (customBlockMatch) {
      const blockTitle = customBlockMatch[1]?.trim() || "連動ブロック";
      const blockLines: string[] = [];
      i++; // [BLOCK...] の次行から探索

      while (i < lines.length) {
        if (lines[i].trim().match(/^\[\/BLOCK\]$/i)) {
          i++; // [/BLOCK] を消費
          break;
        }
        blockLines.push(lines[i]);
        i++;
      }

      const segmentId = `block_${index++}`;
      const outputText = blockLines.join("\n");
      const isEnabled = savedEnabledMap?.[segmentId] ?? true;

      segments.push({
        id: segmentId,
        type: "CUSTOM_BLOCK",
        isToggleable: true,
        title: blockTitle,
        rawText: `[BLOCK:${blockTitle}]\n${outputText}\n[/BLOCK]`,
        displayText: outputText || "(空のブロック)",
        outputTemplate: outputText,
        defaultEnabled: isEnabled,
      });
      continue;
    }

    // 2. ```...``` (コードブロック)
    if (line.trim().startsWith("```")) {
      const codeBlockLines: string[] = [line];
      const codeBlockLang = line.trim().slice(3).trim();
      const blockTitle = codeBlockLang
        ? `コードブロック (${codeBlockLang})`
        : "コードブロック";
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
        isToggleable: false, // [BLOCK] で明示的に囲まれていないコードブロックは省略不可（固定）
        title: blockTitle,
        rawText: outputText,
        displayText: outputText,
        outputTemplate: outputText,
        defaultEnabled: true,
      });
      continue;
    }

    // 3. セクション見出し変数 (# セクションタイトル {{...}})
    const secVar = parseSectionVarLine(line);
    if (secVar.isSectionVar && secVar.varName && secVar.sectionHeader && secVar.varKey) {
      const segmentId = `secvar_${index++}`;
      const fallbackSuffix = secVar.fallback ? `|${secVar.fallback}` : "";
      const displayText = `${secVar.sectionHeader}\n{{${secVar.varName}${fallbackSuffix}}}`;

      segments.push({
        id: segmentId,
        type: "SECTION_VARIABLE",
        isToggleable: false, // 箇条書きではないためトグル対象外（固定表示）
        title: secVar.sectionTitle,
        rawText: line,
        displayText,
        outputTemplate: displayText,
        defaultEnabled: true,
        sectionHeader: secVar.sectionHeader,
        boundVariable: secVar.varName,
        boundVariableKey: secVar.varKey,
        fallback: secVar.fallback,
      });
      i++;
      continue;
    }

    // 4. 通常の行（箇条書き行はトグル可能、それ以外の文章や見出しは固定STATIC）
    const isBullet = isBulletLine(line);
    const segmentId = `${isBullet ? "bullet" : "static"}_${index++}`;
    const isEnabled = isBullet ? (savedEnabledMap?.[segmentId] ?? true) : true;

    segments.push({
      id: segmentId,
      type: isBullet ? "BULLET" : "STATIC",
      isToggleable: isBullet,
      rawText: line,
      displayText: line,
      outputTemplate: line,
      defaultEnabled: isEnabled,
    });
    i++;
  }

  return segments;
}

/**
 * 有効なセグメントのみを抽出し、変数を置換して最終プロンプトテキストを組み立てる
 * - isToggleable が false のセグメントは常に含まれる
 * - SECTION_VARIABLE の例外: 変数が空文字・スペースや改行のみの場合は # セクションタイトル自体も含めて削除（フォールバックがある場合はフォールバック値を使用）
 * - 通常変数: 未入力時にフォールバックがあればフォールバック値を使用
 */
export function assemblePrompt(
  segments: TemplateSegment[],
  activeSegmentIds: Set<string>,
  variables: Record<string, string>,
): string {
  const activeOutputs: string[] = [];

  for (const seg of segments) {
    if (seg.isToggleable && !activeSegmentIds.has(seg.id)) {
      continue;
    }

    // セクション見出し変数の例外ルール
    if (seg.type === "SECTION_VARIABLE" && seg.boundVariable) {
      const varKey = seg.boundVariableKey ?? getVariableKey(seg.boundVariable, seg.fallback);
      const val = variables[varKey] ?? variables[seg.boundVariable];
      // ユーザー入力値がある場合（空文字・スペースや改行のみではない）
      if (val !== undefined && val.trim().length > 0) {
        activeOutputs.push(`${seg.sectionHeader}\n${val.trim()}`);
      } else if (seg.fallback !== undefined && seg.fallback.trim().length > 0) {
        // ユーザー入力はないが、フォールバック値が指定されている場合
        activeOutputs.push(`${seg.sectionHeader}\n${seg.fallback.trim()}`);
      }
      // 入力値もフォールバック値もない場合はセクションタイトルごと丸ごと削除
      continue;
    }

    activeOutputs.push(seg.outputTemplate);
  }

  let fullText = activeOutputs.join("\n\n");

  // 通常の変数 {{変数名|フォールバック}} または {{変数名}} の置換
  fullText = fullText.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey) => {
    const token = parseVariableToken(rawKey);
    const varKey = getVariableKey(token.varName, token.fallback);
    const val = variables[varKey] ?? variables[token.varName];

    if (val !== undefined && val.trim().length > 0) {
      return val.trim();
    }
    // 未入力だがフォールバックがある場合
    if (token.fallback !== undefined) {
      return token.fallback;
    }
    // フォールバックもない未入力の場合はプレースホルダーのまま残す
    return match;
  });

  return fullText.trim();
}

/**
 * クリップボード等のテキストからテンプレート名・概要・本文を二重区切り線（--- \n ---）で分割パースする
 * 表記揺れ（#や見出し文字）に依存せず、二重の区切り線のみを確実なセパレーターとして認識
 *
 * 構成例:
 * （テンプレート名）
 * ---
 * ---
 * （概要・説明文）
 * ---
 * ---
 * （プロンプト本文）
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

  // 二重区切り線: 2行連続した --- (3つ以上のハイフン)
  const doubleSepRegex = /(?:\r?\n|^)\s*-{3,}\s*\r?\n\s*-{3,}\s*(?:\r?\n|$)/;

  const parts = trimmed.split(doubleSepRegex).map((p) => p.trim());

  if (parts.length >= 3) {
    // 1番目: テンプレート名, 2番目: 概要, 3番目以降: プロンプト本文
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
    // 1番目: テンプレート名, 2番目: プロンプト本文
    const name = parts[0] || undefined;
    const content = parts[1].trim();
    return {
      isStructured: true,
      name,
      content,
    };
  }

  // 二重区切り線が含まれていない場合は全体を本文とする
  return {
    isStructured: false,
    content: trimmed,
  };
}
