import type { PromptTemplate } from "@/shared/types/schema";

import { parseTemplateClipboardText } from "./promptTemplateParser";

// src/templates/prompts 配下および my-prompts 配下の .md ファイルをテキストとして一括インポート
const promptModules = import.meta.glob<string>(
  [
    "../../../templates/prompts/*.md",
    "../../../templates/prompts/my-prompts/*.md",
  ],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

/**
 * .md のファイル名から固定のプリセットIDとソート順を決定するメタデータ
 */
const PRESET_METADATA: Record<string, { id: string; order: number }> = {
  "lecture-syllabus-generation": { id: "preset-lecture-syllabus-generation", order: 1 },
  "lecture-source-text-generation": { id: "preset-lecture-source-text-generation", order: 2 },
  "lecture-file-reference-generation": { id: "preset-lecture-file-reference-generation", order: 3 },
  "batch-generation": { id: "preset-batch-generation", order: 4 },
  "refine-cards": { id: "preset-refine-cards", order: 5 },
  "terms-definitions": { id: "preset-terms-definitions", order: 6 },
  "active-recall-rewrite": { id: "preset-active-recall-rewrite", order: 7 },
  "meta-prompt-generator": { id: "preset-meta-prompt-generator", order: 8 },
};

function loadPresetPromptTemplates(): PromptTemplate[] {
  const templates: PromptTemplate[] = [];

  for (const [filePath, rawContent] of Object.entries(promptModules)) {
    // 例: "../../../templates/prompts/my-prompts/lecture-syllabus-generation.md" -> "lecture-syllabus-generation"
    const match = filePath.match(/\/([^/]+)\.md$/);
    const fileNameWithoutExt = match ? match[1] : filePath;

    // ドキュメント・仕様書ファイル（sample.md等）はプリセット一覧に含めない
    if (fileNameWithoutExt === "sample") {
      continue;
    }

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
