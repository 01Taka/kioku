import { z } from "zod";

import { type FlashcardContent, FlashcardContentSchema } from "../types/schema";

export interface ParseResult {
  success: boolean;
  cards: FlashcardContent[];
  errorMessage?: string;
  source: "JSON" | "FALLBACK_SCANNER" | "NONE";
}

const FlashcardListSchema = z.array(FlashcardContentSchema);

/**
 * AIが出力した文字列からフラッシュカード（question / answer のペア）を抽出する
 * 1. まず標準JSON.parseを試行し、Zodスキーマで厳格にバリデーション
 * 2. 失敗した場合は、ハルシネーション（{}の不整合等）に耐性のあるキートークンスキャナーを実行
 *    ※「questionとanswerが交互に配置されていること」を厳格に検証
 */
export function parseFlashcardsFromAI(rawInput: string): ParseResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      success: false,
      cards: [],
      errorMessage: "入力テキストが空です。",
      source: "NONE",
    };
  }

  // Markdownコードブロック ```json ... ``` または ``` ... ``` を除去
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const matchCodeBlock = trimmed.match(codeBlockRegex);
  const jsonCandidate = matchCodeBlock ? matchCodeBlock[1].trim() : trimmed;

  // --- アプローチ 1: 標準 JSON.parse + Zod バリデーション ---
  try {
    const parsed = JSON.parse(jsonCandidate);
    const zodResult = FlashcardListSchema.safeParse(parsed);
    if (zodResult.success && zodResult.data.length > 0) {
      return {
        success: true,
        cards: zodResult.data,
        source: "JSON",
      };
    }
  } catch {
    // JSON.parseが失敗した場合はフォールバックへ進む
  }

  // --- アプローチ 2: フォールバック・キートークンスキャナー ---
  // question: "..." または "question": "..." と answer: "..." のペアを出現順に検出
  return scanAlternatingKeyValuePairs(jsonCandidate);
}

interface KeyToken {
  type: "question" | "answer";
  value: string;
  index: number;
}

/**
 * 正規表現を用いてテキスト全体から question / answer トークンを抽出し、
 * 交互性（question → answer → question → answer ...）を厳格に検証する
 */
function scanAlternatingKeyValuePairs(text: string): ParseResult {
  // マッチ対象:
  // "question": "..." / '...' または question: "..." / '...'
  // "answer": "..." / '...' または answer: "..." / '...'
  // クォート内のエスケープ（\" や \' など）および複数行を許容
  const tokenRegex =
    /(?:"?(question|answer)"?\s*:\s*)(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/gi;

  const tokens: KeyToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const keyType = match[1].toLowerCase() as "question" | "answer";
    const rawVal = match[2] !== undefined ? match[2] : match[3];
    const unescapedVal = unescapeJsonString(rawVal);

    tokens.push({
      type: keyType,
      value: unescapedVal.trim(),
      index: match.index,
    });
  }

  if (tokens.length === 0) {
    return {
      success: false,
      cards: [],
      errorMessage:
        'フラッシュカードのデータ（"question": "..." と "answer": "..." のペア）が見つかりませんでした。',
      source: "NONE",
    };
  }

  // 1. 最初の項目が question かどうか
  if (tokens[0].type !== "question") {
    return {
      success: false,
      cards: [],
      errorMessage:
        "最初の項目が answer から始まっています。question と answer が交互に並んでいる必要があります。",
      source: "FALLBACK_SCANNER",
    };
  }

  // 2. 交互性チェック（i%2 === 0 が question, i%2 === 1 が answer）
  const cards: FlashcardContent[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const expectedType = i % 2 === 0 ? "question" : "answer";
    const currentToken = tokens[i];

    if (currentToken.type !== expectedType) {
      const pairIndex = Math.floor(i / 2) + 1;
      return {
        success: false,
        cards: [],
        errorMessage: `構造エラー: 第${pairIndex}問付近で ${currentToken.type} が連続しています。question と answer が完全に交互に配置されている必要があります。`,
        source: "FALLBACK_SCANNER",
      };
    }

    if (expectedType === "answer") {
      const prevQuestionToken = tokens[i - 1];
      cards.push({
        question: prevQuestionToken.value,
        answer: currentToken.value,
      });
    }
  }

  // 3. 最後の要素が question で終わっている（奇数個）かチェック
  if (tokens.length % 2 !== 0) {
    const incompleteIndex = Math.floor(tokens.length / 2) + 1;
    return {
      success: false,
      cards: [],
      errorMessage: `不完全なデータ: 第${incompleteIndex}問目の question に対する answer が不足しています。`,
      source: "FALLBACK_SCANNER",
    };
  }

  // Zod で各カードの最小文字数や整形を最終チェック
  const validated = FlashcardListSchema.safeParse(cards);
  if (!validated.success || validated.data.length === 0) {
    return {
      success: false,
      cards: [],
      errorMessage: "抽出されたカードの問題または解答が空です。",
      source: "FALLBACK_SCANNER",
    };
  }

  return {
    success: true,
    cards: validated.data,
    source: "FALLBACK_SCANNER",
  };
}

/**
 * JSON文字列のエスケープ（\" や \n, \t など）をアンエスケープする
 */
function unescapeJsonString(str: string): string {
  try {
    return JSON.parse(`"${str}"`);
  } catch {
    // もし特殊な改行や未完了エスケープでJSON.parseが失敗した場合は簡易置換
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }
}
