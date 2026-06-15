import { generateReference } from "../shared/reference.js";

export interface Submission {
  reference: string;
  formId: string;
  answers: Record<string, unknown>;
  submittedAt: string;
  /** Where the submission would be emailed (GOV.UK Notify in production). */
  confirmationSentTo: string;
  /** Which transport accepted it — used to prove cross-transport parity. */
  via: "mcp" | "rest";
}

/**
 * In-memory submission store. Production would hand off to the forms-runner
 * submission pipeline (GOV.UK Notify email + CSV/JSON export).
 */
export class SubmissionStore {
  private submissions: Submission[] = [];

  record(input: {
    formId: string;
    formName: string;
    answers: Record<string, unknown>;
    confirmationSentTo: string;
    via: "mcp" | "rest";
  }): Submission {
    const submission: Submission = {
      reference: generateReference(input.formName),
      formId: input.formId,
      answers: input.answers,
      submittedAt: new Date().toISOString(),
      confirmationSentTo: input.confirmationSentTo,
      via: input.via,
    };
    this.submissions.push(submission);
    return submission;
  }

  all(): readonly Submission[] {
    return this.submissions;
  }

  get(reference: string): Submission | undefined {
    return this.submissions.find((s) => s.reference === reference);
  }
}
