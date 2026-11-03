import katex from "katex";
import React, { useMemo } from "react";

import { tokenizeLatex } from "@/shared/utils/latexTokenizer";

export interface LatexTextProps {
  /** レンダリングするテキスト（LaTeX数式記号を含む可能性のある文字列） */
  text: string;
  /** ラッパー要素に適用するクラス名 */
  className?: string;
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
 * プレーンテキスト内のLaTeX数式（明示デリミタ付き＆デリミタなし数式の自動判定）を検出・描画するコンポーネント。
 * Markdownパーサーは通さず、改行やスペースはCSSのwhitespace-pre-wrap等で保持されます。
 */
export const LatexText: React.FC<LatexTextProps> = React.memo(function LatexText({
  text,
  className,
}) {
  const renderedElements = useMemo(() => {
    const tokens = tokenizeLatex(text);

    // カード全体が単一の数式のみで構成されている場合は、分数や根号が潰れないよう \displaystyle を適用
    const nonWhitespaceTokens = tokens.filter(
      (t) => !(t.type === "text" && t.content.trim() === ""),
    );
    const isSingleStandaloneFormula =
      nonWhitespaceTokens.length === 1 && nonWhitespaceTokens[0].type === "inline-math";

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
        const texToRender = isSingleStandaloneFormula
          ? `\\displaystyle ${token.content}`
          : token.content;
        const html = renderKatexHtml(texToRender, false);
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
