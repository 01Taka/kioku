import katex from "katex";

export type LatexToken =
  | { type: "text"; content: string }
  | { type: "inline-math"; content: string }
  | { type: "block-math"; content: string };

/** 標準的な数学関数・定数名（バックスラッシュなしでも数式内で許容する語） */
const MATH_FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "log",
  "ln",
  "lg",
  "exp",
  "lim",
  "sup",
  "inf",
  "max",
  "min",
  "arg",
  "det",
  "dim",
  "gcd",
  "hom",
  "ker",
  "deg",
  "Pr",
  "mod",
  "const",
]);

/** 英文散文判定用のストップワード */
const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "was",
  "not",
  "but",
  "you",
  "all",
  "any",
  "can",
  "had",
  "her",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "our",
  "out",
  "own",
  "say",
  "she",
  "too",
  "use",
  "way",
  "who",
  "why",
  "is",
  "of",
  "in",
  "to",
  "by",
  "on",
  "at",
  "or",
  "as",
  "be",
  "if",
  "it",
  "an",
  "no",
  "so",
  "up",
  "we",
  "do",
  "go",
  "he",
  "me",
  "my",
  "us",
]);

/**
 * JSON.parse 等で誤って制御文字化されやすい LaTeX エスケープ（\b -> BS, \f -> FF）を復元する
 */
function recoverControlCharEscapes(input: string): string {
  if (!input.includes("\b") && !input.includes("\f")) {
    return input;
  }
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const next = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
    const isNextAsciiAlpha = (next >= 65 && next <= 90) || (next >= 97 && next <= 122);
    if (code === 8 && isNextAsciiAlpha) {
      out += "\\b";
    } else if (code === 12 && isNextAsciiAlpha) {
      out += "\\f";
    } else {
      out += input[i];
    }
  }
  return out;
}

/**
 * KaTeX の厳格モード（throwOnError: true）で構文として有効かどうかを検証する
 */
function canParseStrictKatex(tex: string): boolean {
  const trimmed = tex.trim();
  if (!trimmed) return false;
  try {
    katex.renderToString(trimmed, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * 括弧類の対応（(), [], {}）が取れているか検証する
 */
function hasBalancedDelimiters(str: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push(ch);
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.length === 0 || stack.pop() !== pairs[ch]) {
        return false;
      }
    }
  }
  return stack.length === 0;
}

/**
 * 入れ子になった波括弧引数を反復的に除去するヘルパー
 */
function stripNestedBraceArgs(str: string, pattern: RegExp): string {
  let prev = str;
  for (let pass = 0; pass < 6; pass++) {
    const next = prev.replace(pattern, " ");
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

/**
 * デリミタ（$...$ 等）なしの文字列が単独の数式表現であるかを自動判定する
 */
export function isStandaloneMathFormula(raw: string): boolean {
  const candidate = raw.trim();
  if (!candidate || candidate.length > 500) return false;

  // URL・Windowsファイルパス・エスケープドル・プログラム構文・英語所有格/短縮形を除外
  if (/https?:\/\/|www\.|[A-Za-z]:\\|\\\$/.test(candidate)) return false;
  if (/===|!==|=>|&&|\|\||\/\/|\/\*|["`]|;\s*$/.test(candidate)) return false;
  if (/[a-zA-Z]'[a-zA-Z]/.test(candidate)) return false;
  if (!hasBalancedDelimiters(candidate)) return false;

  // \text{...} や \mathrm{...} 等のテキストマクロ引数を一時除去
  const withoutTextMacros = stripNestedBraceArgs(
    candidate,
    /\\(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathbb|operatorname)\s*\{[^{}]*\}/g,
  );

  // マクロ外に日本語（CJK）や非数式文字が含まれる場合は単独数式ではない
  if (/[^\x20-\x7E±×÷≤≥≠≈∞√∫∂∇∑∏]/.test(withoutTextMacros)) {
    return false;
  }

  // LaTeXコマンドおよび波括弧付きの添字・上付きを除去
  const withoutCommands = stripNestedBraceArgs(
    withoutTextMacros.replace(/\\[a-zA-Z]+/g, " "),
    /[_^]\s*\{[^{}]*\}/g,
  );

  // プログラムの snake_case 識別子（user_id, MAX_VALUE 等）を除外
  const snakeMatches = withoutCommands.match(/\b([a-zA-Z]{2,})_[a-zA-Z0-9]+\b/g);
  if (snakeMatches) {
    for (const m of snakeMatches) {
      const base = m.split("_")[0];
      if (!MATH_FUNCTIONS.has(base)) return false;
    }
  }

  // 1文字添字・上付き、および微分記号（dx, dt等）を除去して散文チェック
  const strippedForProse = withoutCommands
    .replace(/[_^]\s*[a-zA-Z0-9*+-]/g, " ")
    .replace(/\bd[a-zA-Z]\b/g, " ");

  const words = strippedForProse.match(/[a-zA-Z]+/g) ?? [];
  for (const w of words) {
    if (MATH_FUNCTIONS.has(w)) continue;
    // 4文字以上の英単語または英語ストップワードが含まれる場合は散文とみなす
    if (w.length >= 4) return false;
    if (ENGLISH_STOPWORDS.has(w.toLowerCase())) return false;
  }

  // 数学関数以外の2文字以上の英単語が空白区切りで連続する場合は散文とみなす
  const withoutFuncs = strippedForProse.replace(
    /\b(?:sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|lg|exp|lim|sup|inf|max|min|arg|det|dim|gcd|hom|ker|deg|Pr|mod|const)\b/g,
    "1",
  );
  if (/\b[a-zA-Z]{2,}\s+[a-zA-Z]{2,}\b/.test(withoutFuncs)) {
    return false;
  }

  // 明確な数式シグナルが少なくとも1つ存在することを要求
  const hasLatexCmd = /\\[a-zA-Z]+/.test(candidate);
  const hasSupOrSub =
    /[a-zA-Z0-9)\]}]\s*\^/.test(candidate) ||
    /(?:^|[^a-zA-Z0-9\\])[a-zA-Z0-9]\s*_/.test(candidate) ||
    /\b(?:sin|cos|tan|log|ln|lim|max|min|sup|inf)\s*_/.test(candidate) ||
    /_\{[^{}]+\}/.test(candidate);
  const hasEquation = /[a-zA-Z0-9)\]}]\s*=\s*[-+\\a-zA-Z0-9([{]/.test(candidate);
  const hasUnicodeMath = /[±×÷≤≥≠≈∞√∫∂∇∑∏]/.test(candidate);

  if (!hasLatexCmd && !hasSupOrSub && !hasEquation && !hasUnicodeMath) {
    return false;
  }

  return canParseStrictKatex(candidate);
}

interface WordPiece {
  isSpace: boolean;
  text: string;
}

/**
 * 括弧のネスト（{...}, (...), [...]）を保ったままトップレベルの空白で分割する
 */
function splitTopLevelWords(str: string): WordPiece[] {
  const items: WordPiece[] = [];
  let depth = 0;
  let i = 0;

  while (i < str.length) {
    if (depth === 0 && /\s/.test(str[i])) {
      const start = i;
      while (i < str.length && /\s/.test(str[i])) i++;
      items.push({ isSpace: true, text: str.slice(start, i) });
    } else {
      const start = i;
      while (i < str.length && !(depth === 0 && /\s/.test(str[i]))) {
        if (str[i] === "\\") {
          i += 2;
          continue;
        }
        if (str[i] === "{" || str[i] === "(" || str[i] === "[") {
          depth++;
        } else if (str[i] === "}" || str[i] === ")" || str[i] === "]") {
          depth = Math.max(0, depth - 1);
        }
        i++;
      }
      items.push({ isSpace: false, text: str.slice(start, i) });
    }
  }

  return items;
}

/**
 * トップレベルトークンが数式の一部になり得るかを判定する
 */
function isMathCompatibleToken(tok: string): boolean {
  const core = tok.replace(/[.,:;!?]+$/, "");
  if (!core) return false;
  if (/https?:\/\/|www\.|[A-Za-z]:\\|\\\$/.test(core)) return false;
  if (/[a-zA-Z]'[a-zA-Z]/.test(core)) return false;

  // [s], [Hz], [rad/s] などの角括弧単位は数式外に保つ
  if (/^\[[a-zA-Z0-9/%^.-]+\]$/.test(core)) return false;

  // 1) や (1) のような番号リスト表記は数式外に保つ
  if (/^(?:\(\d+\)|\d+[.)])$/.test(core)) return false;

  // 記号を含まない英字のみの語
  if (/^[a-zA-Z]{2,}$/.test(core)) {
    if (MATH_FUNCTIONS.has(core)) return true;
    if (/^d[a-zA-Z]$/.test(core)) return true;
    if (ENGLISH_STOPWORDS.has(core.toLowerCase())) return false;
    // 4文字以上の英単語、または小文字3文字の一般語/単位（rad, sec, mol等）は除外
    if (core.length >= 4) return false;
    if (/^[a-z]{3}$/.test(core)) return false;
    // IR, PV, nRT, LC などの2〜3文字の変数積は許容
    return true;
  }

  // snake_case 識別子を除外
  if (/^[a-zA-Z]{2,}_[a-zA-Z0-9]+$/.test(core)) {
    const base = core.split("_")[0];
    if (!MATH_FUNCTIONS.has(base)) return false;
  }

  return true;
}

/**
 * ASCII（および数式記号）の連続区間からデリミタなし数式を抽出する
 */
function parseBareMathInAsciiRun(run: string): LatexToken[] {
  const parts = splitTopLevelWords(run);
  const result: LatexToken[] = [];
  let idx = 0;

  while (idx < parts.length) {
    const item = parts[idx];
    if (item.isSpace || !isMathCompatibleToken(item.text)) {
      result.push({ type: "text", content: item.text });
      idx++;
      continue;
    }

    // 空白を挟んで連続する数式互換トークンの範囲を収集
    let endIdx = idx;
    while (
      endIdx + 2 < parts.length &&
      parts[endIdx + 1].isSpace &&
      isMathCompatibleToken(parts[endIdx + 2].text)
    ) {
      endIdx += 2;
    }

    // 最長の有効な数式スパンを探索
    let matched = false;
    for (let j = endIdx; j >= idx; j -= 2) {
      let rawSpan = parts
        .slice(idx, j + 1)
        .map((p) => p.text)
        .join("");
      let trailingPunct = "";
      const punctMatch = rawSpan.match(/([.,:;!?]+)$/);
      if (punctMatch) {
        trailingPunct = punctMatch[1];
        rawSpan = rawSpan.slice(0, -trailingPunct.length);
      }

      if (isStandaloneMathFormula(rawSpan)) {
        result.push({ type: "inline-math", content: rawSpan });
        if (trailingPunct) {
          result.push({ type: "text", content: trailingPunct });
        }
        idx = j + 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result.push({ type: "text", content: item.text });
      idx++;
    }
  }

  return result;
}

/**
 * 波括弧の開閉が複数行にまたがる場合のみ行を結合し、それ以外は改行で分割する
 */
function splitLogicalLines(chunk: string): string[] {
  const rawLines = chunk.split("\n");
  if (rawLines.length <= 1) return rawLines;

  const lines: string[] = [];
  let buffer = "";
  let braceDepth = 0;

  for (let l = 0; l < rawLines.length; l++) {
    const current = rawLines[l];
    buffer = buffer ? `${buffer}\n${current}` : current;

    for (let i = 0; i < current.length; i++) {
      if (current[i] === "\\") {
        i++;
        continue;
      }
      if (current[i] === "{") braceDepth++;
      else if (current[i] === "}") braceDepth = Math.max(0, braceDepth - 1);
    }

    if (braceDepth === 0) {
      lines.push(buffer);
      buffer = "";
    }
  }

  if (buffer) {
    lines.push(buffer);
  }

  return lines;
}

/**
 * プレーンテキスト断片からデリミタなしの裸のLaTeX数式を自動検出してトークン化する
 */
function autoDetectBareLatex(plainChunk: string): LatexToken[] {
  if (!plainChunk) return [];

  const logicalLines = splitLogicalLines(plainChunk);
  const out: LatexToken[] = [];
  const asciiMathRunRegex =
    /(?:\\(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathbb|operatorname)\s*\{[^{}]*\}|[\x20-\x7E±×÷≤≥≠≈∞√∫∂∇∑∏])+/g;

  logicalLines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      out.push({ type: "text", content: "\n" });
    }
    if (!line) return;

    let last = 0;
    let match: RegExpExecArray | null;
    asciiMathRunRegex.lastIndex = 0;

    while ((match = asciiMathRunRegex.exec(line)) !== null) {
      if (match.index > last) {
        out.push({ type: "text", content: line.slice(last, match.index) });
      }
      out.push(...parseBareMathInAsciiRun(match[0]));
      last = match.index + match[0].length;
    }

    if (last < line.length) {
      out.push({ type: "text", content: line.slice(last) });
    }
  });

  return out;
}

/**
 * 隣接する text トークンを結合して正規化する
 */
function mergeAdjacentTextTokens(tokens: LatexToken[]): LatexToken[] {
  const merged: LatexToken[] = [];
  for (const token of tokens) {
    if (!token.content) continue;
    const prev = merged[merged.length - 1];
    if (token.type === "text" && prev && prev.type === "text") {
      prev.content += token.content;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}

/**
 * テキストを「通常テキスト」「インライン数式」「ブロック数式」のトークン列に分割する
 * 1. 明示的デリミタ（$$...$$, \[...\], \begin{...}...\end{...}, \(...\), $...$）を優先抽出
 * 2. 残りのテキスト領域に対して、デリミタなしLaTeX数式（\omega L, \frac{\pi}{2}, Z_L = Z_i^* 等）を自動判定
 */
export function tokenizeLatex(rawText: string): LatexToken[] {
  if (!rawText) return [];

  const text = recoverControlCharEscapes(rawText);
  const pass1Tokens: LatexToken[] = [];

  // $$...$$ / \[...\] / \begin{env}...\end{env} / \(...\) / $...$
  const explicitRegex =
    /(\$\$(?:[\s\S]*?)\$\$|\\\[(?:[\s\S]*?)\\\]|\\begin\{([a-zA-Z]+\*?)\}[\s\S]*?\\end\{\2\}|\\\((?:[\s\S]*?)\\\)|\$(?:\\\$|[^$\n])+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = explicitRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pass1Tokens.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith("$$") && matchedStr.endsWith("$$")) {
      pass1Tokens.push({
        type: "block-math",
        content: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith("\\[") && matchedStr.endsWith("\\]")) {
      pass1Tokens.push({
        type: "block-math",
        content: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith("\\begin{")) {
      pass1Tokens.push({
        type: "block-math",
        content: matchedStr,
      });
    } else if (matchedStr.startsWith("\\(") && matchedStr.endsWith("\\)")) {
      pass1Tokens.push({
        type: "inline-math",
        content: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith("$") && matchedStr.endsWith("$")) {
      pass1Tokens.push({
        type: "inline-math",
        content: matchedStr.slice(1, -1),
      });
    }

    lastIndex = match.index + matchedStr.length;
  }

  if (lastIndex < text.length) {
    pass1Tokens.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  // Pass 2: 明示的デリミタ外のテキストから裸の数式を自動抽出
  const finalTokens: LatexToken[] = [];
  for (const token of pass1Tokens) {
    if (token.type === "text") {
      finalTokens.push(...autoDetectBareLatex(token.content));
    } else {
      finalTokens.push(token);
    }
  }

  return mergeAdjacentTextTokens(finalTokens);
}
