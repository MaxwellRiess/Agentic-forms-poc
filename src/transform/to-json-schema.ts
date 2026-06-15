import type { FormDefinition, Page } from "../domain/form-definition.js";
import { ANSWER_TYPE_MAP } from "./answer-type-map.js";
import type { FieldEntry } from "./field-key.js";
import type { JSONSchema } from "./json-schema.js";

/**
 * Build the per-page answer fragment, applying required/optional and
 * selection-specific tweaks (e.g. required checkbox => minItems: 1).
 */
export function pageFragment(page: Page, withDescription: boolean): JSONSchema {
  const mapping = ANSWER_TYPE_MAP[page.answerType];
  const fragment: JSONSchema = { ...mapping.jsonSchema(page) };

  if (!page.isOptional && fragment.type === "array") {
    fragment.minItems = Math.max(fragment.minItems ?? 0, 1);
  }

  if (withDescription) {
    const hint = page.hintText ? ` ${page.hintText}` : "";
    fragment.description = `${page.questionText} — ${mapping.describe(page)}${hint}`;
  }

  return fragment;
}

/**
 * Project a whole form into one JSON Schema for its answer payload. Keys come
 * from the field index so they read like the questions.
 */
export function toJsonSchema(
  form: FormDefinition,
  fieldIndex: FieldEntry[],
  options: { withDescription?: boolean } = {},
): JSONSchema {
  const withDescription = options.withDescription ?? false;
  const pageById = new Map(form.pages.map((p) => [p.id, p]));

  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const entry of fieldIndex) {
    const page = pageById.get(entry.pageId);
    if (!page) continue;
    properties[entry.key] = pageFragment(page, withDescription);
    if (!page.isOptional) required.push(entry.key);
  }

  return {
    type: "object",
    title: form.name,
    properties,
    required,
    additionalProperties: false,
  };
}
