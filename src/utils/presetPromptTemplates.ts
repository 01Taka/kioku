import type { PromptTemplate } from "../types/schema";
import { parseTemplateClipboardText } from "./promptTemplateParser";

// src/templates/prompts 配下の .md ファイルをテキストとして一括インポート
const promptModules = import.meta.glob<string>("../templates/prompts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * .md のファイル名から固定のプリセットIDとソート順を決定するメタデータ
 */
const PRESET_METADATA: Record<string, { id: string; order: number }> = {
  "batch-generation": { id: "preset-batch-generation", order: 1 },
  "refine-cards": { id: "preset-refine-cards", order: 2 },
  "terms-definitions": { id: "preset-terms-definitions", order: 3 },
  "active-recall-rewrite": { id: "preset-active-recall-rewrite", order: 4 },
  "meta-prompt-generator": { id: "preset-meta-prompt-generator", order: 5 },
};

function loadPresetPromptTemplates(): PromptTemplate[] {
  const templates: PromptTemplate[] = [];

  for (const [filePath, rawContent] of Object.entries(promptModules)) {
    // 例: "../templates/prompts/batch-generation.md" -> "batch-generation"
    const match = filePath.match(/\/([^/]+)\.md$/);
    const fileNameWithoutExt = match ? match[1] : filePath;

    const meta = PRESET_METADATA[fileNameWithoutExt] ?? {
      id: `preset-${fileNameWithoutExt}`,
      order: 99,
    };

    const parsed = parseTemplateClipboardText(rawContent);

    templates.push({
      id: meta.id,
      name: parsed.name ?? fileNameWithoutExt,
      description: parsed.description ?? "",
      isPreset: true,
      content: parsed.content,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }

  // 決まった表示順序でソート
  templates.sort((a, b) => {
    const orderA =
      Object.values(PRESET_METADATA).find((m) => m.id === a.id)?.order ?? 99;
    const orderB =
      Object.values(PRESET_METADATA).find((m) => m.id === b.id)?.order ?? 99;
    return orderA - orderB;
  });

  return templates;
}

export const PRESET_PROMPT_TEMPLATES: PromptTemplate[] = loadPresetPromptTemplates();
