import type { JSONSchema } from "./json-schema.js";
import type { FieldEntry } from "./field-key.js";

/**
 * The AgentContract is the single canonical artefact derived from a form
 * definition. Every transport (MCP, REST, .well-known, OpenAPI) is a thin
 * projection of this object.
 */
export interface AgentContract {
  formId: string;
  name: string;
  description: string;
  /** JSON Schema for the answer payload (REST `/schema`, request bodies). */
  answerSchema: JSONSchema;
  /** Same schema with descriptions inlined for MCP tool arguments. */
  mcpInputSchema: JSONSchema;
  /** id <-> key <-> question mapping, so answers can be re-assembled. */
  fieldIndex: FieldEntry[];
  /** Human-facing questions, for `describe_form` / `GET /forms/:id`. */
  questions: ContractQuestion[];
  confirmation: {
    submissionEmail: string;
    whatHappensNext?: string;
  };
}

export interface ContractQuestion {
  key: string;
  questionText: string;
  hintText?: string;
  required: boolean;
  answerType: string;
  options?: string[];
  /** Plain-language note about conditional routing this answer drives, if any. */
  routingNote?: string;
  /** Plain-language note about when this question itself applies, if it can be skipped. */
  appliesWhen?: string;
}
