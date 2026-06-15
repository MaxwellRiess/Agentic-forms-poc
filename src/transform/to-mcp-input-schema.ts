import type { FormDefinition } from "../domain/form-definition.js";
import type { FieldEntry } from "./field-key.js";
import type { JSONSchema } from "./json-schema.js";
import { toJsonSchema } from "./to-json-schema.js";

/**
 * The MCP tool input schema IS the JSON Schema — just with per-field
 * descriptions inlined, because agents lean heavily on argument descriptions
 * when filling tool calls. Reusing `toJsonSchema` guarantees the MCP surface
 * and the REST surface validate identically.
 */
export function toMcpAnswersSchema(
  form: FormDefinition,
  fieldIndex: FieldEntry[],
): JSONSchema {
  return toJsonSchema(form, fieldIndex, { withDescription: true });
}
