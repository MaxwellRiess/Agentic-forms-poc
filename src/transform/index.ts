import type { FormDefinition, Page } from "../domain/form-definition.js";
import { buildFieldIndex } from "./field-key.js";
import { toJsonSchema } from "./to-json-schema.js";
import { toMcpAnswersSchema } from "./to-mcp-input-schema.js";
import type { AgentContract, ContractQuestion } from "./contract.js";

export * from "./contract.js";
export { buildFieldIndex } from "./field-key.js";
export type { JSONSchema } from "./json-schema.js";

function routingNote(page: Page): string | undefined {
  if (!page.routing || page.routing.length === 0) return undefined;
  const branches = page.routing
    .map((r) =>
      r.goToPageId === "CHECK_ANSWERS"
        ? `answering "${r.answerValue}" finishes the form`
        : `answering "${r.answerValue}" leads to a different next question`,
    )
    .join("; ");
  return `This answer affects which questions follow: ${branches}.`;
}

/**
 * buildAgentContract — the canonical transform.
 *
 * This is the whole thesis of the POC in one function: a service team authors a
 * GOV.UK form definition, and the complete machine-readable agent interface
 * falls out automatically. No extra work, no second schema, no drift.
 */
export function buildAgentContract(form: FormDefinition): AgentContract {
  const fieldIndex = buildFieldIndex(form);
  const pageById = new Map(form.pages.map((p) => [p.id, p]));

  const questions: ContractQuestion[] = fieldIndex.map((entry) => {
    const page = pageById.get(entry.pageId)!;
    return {
      key: entry.key,
      questionText: page.questionText,
      hintText: page.hintText,
      required: !page.isOptional,
      answerType: page.answerType,
      options: page.answerSettings?.selectionOptions?.map((o) => o.name),
      routingNote: routingNote(page),
    };
  });

  const description = [
    `Complete the GOV.UK service "${form.name}".`,
    form.whatHappensNext ? `What happens next: ${form.whatHappensNext}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    formId: form.id,
    name: form.name,
    description,
    answerSchema: toJsonSchema(form, fieldIndex),
    mcpInputSchema: toMcpAnswersSchema(form, fieldIndex),
    fieldIndex,
    questions,
    confirmation: {
      submissionEmail: form.submissionEmail,
      whatHappensNext: form.whatHappensNext,
    },
  };
}
