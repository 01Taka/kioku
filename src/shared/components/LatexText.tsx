import katex from "katex";
import React, { useMemo } from "react";

export interface LatexTextProps {
  /** レンダリングするテキスト（LaTeX数式記号を含む可能性のある文字列） */
  text: string;
  /** ラッパー要素に適用するクラス名 */
  className?: string;
}

type Token =
  | { type: "text"; content: string }
  | { type: "inline-math"; content: string }
  | { type: "block-math"; content: string };

/**
 * LaTeX数式のデリミタを認識してテキストをトークンに分割する
 * - ブロック数式: $$...$$ または \[...\]
 * - インライン数式: $...$ または \(...\)
 */
function tokenizeLatex(text: string): Token[] {
  if (!text) return [];

  const tokens: Token[] = [];
  // $$...$$ / \[...\] / \(...\) / $...$
  const regex =
    /(\$\$(?:[\s\S]*?)\$\$|\\\[(?:[\s\S]*?)\\\]|\\\((?:[\s\S]*?)\\\)|\$(?:\\\$|[^$])+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith("$$") && matchedStr.endsWith("$$")) {
      tokens.push({
        type: "block-math",
        content: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith("\\[") && matchedStr.endsWith("\\]")) {
      tokens.push({
        type: "block-math",
        content: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith("\\(") && matchedStr.endsWith("\\)")) {
      tokens.push({
        type: "inline-math",
        content: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith("$") && matchedStr.endsWith("$")) {
      tokens.push({
        type: "inline-math",
        content: matchedStr.slice(1, -1),
      });
    }

    lastIndex = match.index + matchedStr.length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

function renderKatexHtml(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
    });
  } catch {
    // 万が一の例外発生時もクラッシュさせず生テキストを返す
    return tex;
  }
}

/**
 * プレーンテキスト内のLaTeX数式（インライン・ブロック）を検出・描画するコンポーネント。
 * Markdownパーサーは通さず、改行やスペースはCSSのwhitespace-pre-wrap等で保持されます。
 */
export const LatexText: React.FC<LatexTextProps> = React.memo(function LatexText({
  text,
  className,
}) {
  const renderedElements = useMemo(() => {
    const tokens = tokenizeLatex(text);

    return tokens.map((token, index) => {
      if (token.type === "block-math") {
        const html = renderKatexHtml(token.content, true);
        return (
          <div
            key={index}
            className="my-2 max-w-full overflow-x-auto py-1 text-center"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      if (token.type === "inline-math") {
        const html = renderKatexHtml(token.content, false);
        return (
          <span
            key={index}
            className="inline-block max-w-full overflow-x-auto px-0.5 align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // エスケープされた \$ は $ に戻して表示
      const unescapedText = token.content.replace(/\\\$/g, "$");
      return <React.Fragment key={index}>{unescapedText}</React.Fragment>;
    });
  }, [text]);

  return <div className={className}>{renderedElements}</div>;
});
