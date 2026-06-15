import type { FormDefinition, Page } from "../domain/form-definition.js";

/**
 * Map opaque page ids to readable, self-documenting argument keys (snake_case
 * derived from the question text). Agents fill arguments far more reliably when
 * the key reads like the question, and tool-call transcripts become legible.
 *
 * We keep a stable id <-> key index so answers can always be re-assembled back
 * onto page ids regardless of which transport collected them.
 */
export interface FieldEntry {
  pageId: string;
  key: string;
  questionText: string;
  position: number;
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/g, "");
  return base.length > 0 ? base : "answer";
}

export function buildFieldIndex(form: FormDefinition): FieldEntry[] {
  const seen = new Map<string, number>();
  const pages = [...form.pages].sort((a, b) => a.position - b.position);
  return pages.map((page: Page) => {
    let key = slugify(page.questionText);
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count > 0) key = `${key}_${count + 1}`;
    return {
      pageId: page.id,
      key,
      questionText: page.questionText,
      position: page.position,
    };
  });
}
