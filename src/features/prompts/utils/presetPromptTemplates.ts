import type { PromptCategory, PromptTemplate } from "@/shared/types/schema";

import { parseTemplateClipboardText } from "./promptTemplateParser";

// src/templates/prompts/active サブディレクトリ配下の .md ファイルをテキストとして一括インポート
const promptModules = import.meta.glob<string>(
  "../../../templates/prompts/active/**/*.md",
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
  "refine-cards": { id: "preset-refine-cards", order: 4 },
};

function loadPresetPromptTemplates(): PromptTemplate[] {
  const templates: PromptTemplate[] = [];

  for (const [filePath, rawContent] of Object.entries(promptModules)) {
    // 例: "../../../templates/prompts/active/create/lecture-syllabus-generation.md"
    const match = filePath.match(/\/([^/]+)\/([^/]+)\.md$/);
    const dirName = match ? match[1] : "";
    const fileNameWithoutExt = match ? match[2] : filePath;

    // ドキュメント・仕様書ファイル（sample.md等）は除外
    if (fileNameWithoutExt === "sample") {
      continue;
    }

    const category: PromptCategory =
      dirName === "create" ? "create" : dirName === "refine" ? "refine" : "create";

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
      category,
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
