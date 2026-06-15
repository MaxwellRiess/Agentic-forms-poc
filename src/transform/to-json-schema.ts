import type { FormDefinition, Page } from "../domain/form-definition.js";
import { ANSWER_TYPE_MAP } from "./answer-type-map.js";
import type { FieldEntry } from "./field-key.js";
import type { JSONSchema } from "./json-schema.js";
import { analyseRouting } from "./routing-to-conditionals.js";

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
  const routing = analyseRouting(form, fieldIndex);

  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const entry of fieldIndex) {
    const page = pageById.get(entry.pageId);
    if (!page) continue;
    properties[entry.key] = pageFragment(page, withDescription);
    // Conditionally-skippable fields are required via the routing conditionals,
    // not unconditionally, so they're excluded here.
    if (!page.isOptional && !routing.conditionalKeys.has(entry.key)) {
      required.push(entry.key);
    }
  }

  const schema: JSONSchema = {
    type: "object",
    title: form.name,
    properties,
    required,
    additionalProperties: false,
  };

  if (routing.conditionals.length > 0) {
    schema.allOf = routing.conditionals;
  }

  return schema;
}
