/**
 * プロンプトテンプレートのパース・変数抽出・行・ブロック連動ユーティリティ
 */

export interface TemplateSegment {
  id: string;
  type: "LINE" | "CODE_BLOCK" | "CUSTOM_BLOCK";
  title?: string;
  rawText: string; // セグメント全体の生テキスト（BLOCKタグ含む）
  displayText: string; // UI表示用のテキスト（BLOCKタグなどを整理したもの）
  outputTemplate: string; // 最終出力用のテンプレート（BLOCKタグを除去したもの）
  defaultEnabled: boolean;
}

/**
 * テンプレート内の {{変数名}} を重複なく順番通りに抽出する
 */
export function extractTemplateVariables(content: string): string[] {
  const regex = /\{\{([^{}]+)\}\}/g;
  const variables: string[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim();
    if (varName && !seen.has(varName)) {
      seen.add(varName);
      variables.push(varName);
    }
  }

  return variables;
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
      const isEnabled = savedEnabledMap?.[segmentId] ?? true;

      segments.push({
        id: segmentId,
        type: "CODE_BLOCK",
        title: blockTitle,
        rawText: outputText,
        displayText: outputText,
        outputTemplate: outputText,
        defaultEnabled: isEnabled,
      });
      continue;
    }

    // 3. 通常の行
    const segmentId = `line_${index++}`;
    const isEnabled = savedEnabledMap?.[segmentId] ?? true;

    segments.push({
      id: segmentId,
      type: "LINE",
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
 */
export function assemblePrompt(
  segments: TemplateSegment[],
  activeSegmentIds: Set<string>,
  variables: Record<string, string>,
): string {
  const activeOutputs = segments
    .filter((s) => activeSegmentIds.has(s.id))
    .map((s) => s.outputTemplate);

  let fullText = activeOutputs.join("\n\n");

  // 変数の置換 {{変数名}}
  fullText = fullText.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    if (variables[key] !== undefined && variables[key] !== "") {
      return variables[key];
    }
    return match; // 未入力の場合はプレースホルダーのまま残す
  });

  return fullText.trim();
}
