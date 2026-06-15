import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { JSONSchema } from "../transform/json-schema.js";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * Validate an answers payload against a generated JSON Schema. Both the MCP
 * `submit_form` tool and the REST `POST /submissions` endpoint call this, so
 * the two transports accept and reject identically.
 */
export function validateAnswers(
  schema: JSONSchema,
  answers: unknown,
): ValidationResult {
  const validate = ajv.compile(schema as object);
  const valid = validate(answers) as boolean;
  if (valid) return { valid: true, errors: [] };

  const errors: FieldError[] = (validate.errors ?? []).map((e) => {
    const path = e.instancePath.replace(/^\//, "").replace(/\//g, ".");
    const field =
      path ||
      (e.params && "missingProperty" in e.params
        ? String((e.params as { missingProperty: string }).missingProperty)
        : "(root)");
    return { field, message: e.message ?? "is invalid" };
  });

  return { valid: false, errors };
}
