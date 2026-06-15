import type { FormRepository } from "../store/form-repository.js";
import type { SubmissionStore, Submission } from "../store/submission-store.js";
import { validateAnswers, type FieldError } from "../validate/validate-answers.js";

export type SubmitResult =
  | { ok: true; submission: Submission; whatHappensNext?: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; errors: FieldError[] };

/**
 * Single submit path shared by the MCP `submit_form` tool and the REST
 * `POST /submissions` endpoint. Validates against the generated schema and
 * records the submission — identical behaviour, whichever transport calls it.
 */
export function submitForm(
  repo: FormRepository,
  store: SubmissionStore,
  formId: string,
  answers: Record<string, unknown>,
  via: "mcp" | "rest",
): SubmitResult {
  const contract = repo.getContract(formId);
  if (!contract) return { ok: false, reason: "not_found" };

  const result = validateAnswers(contract.answerSchema, answers);
  if (!result.valid) return { ok: false, reason: "invalid", errors: result.errors };

  const submission = store.record({
    formId,
    formName: contract.name,
    answers,
    confirmationSentTo: contract.confirmation.submissionEmail,
    via,
  });

  return {
    ok: true,
    submission,
    whatHappensNext: contract.confirmation.whatHappensNext,
  };
}
