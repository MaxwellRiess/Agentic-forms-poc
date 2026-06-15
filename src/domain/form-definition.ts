import type { AnswerType } from "./answer-types.js";

/**
 * A FormDefinition is a faithful (if simplified) shape of what GOV.UK Forms
 * already stores for every form. The point of the POC: this structure is the
 * *only* thing a service team authors, and the agent contract is derived from it.
 */
export interface FormDefinition {
  id: string;
  name: string;
  /** Where completed submissions are sent (forms-admin `submission_email`). */
  submissionEmail: string;
  privacyPolicyUrl?: string;
  supportEmail?: string;
  /** Shown to the user on the confirmation page after submitting. */
  whatHappensNext?: string;
  /** Ordered list of steps the user works through. */
  pages: Page[];
}

export interface Page {
  id: string;
  position: number;
  /** GOV.UK `question_text`. */
  questionText: string;
  /** GOV.UK `hint_text` — optional guidance shown under the question. */
  hintText?: string;
  /** GOV.UK `is_optional` — when true the answer may be omitted. */
  isOptional: boolean;
  answerType: AnswerType;
  answerSettings?: AnswerSettings;
  /** Conditional routing driven by selection answers. */
  routing?: RoutingRule[];
}

export interface AnswerSettings {
  /** text: single line vs multi-line. */
  inputType?: "single_line" | "long_text";
  /** selection: choose exactly one (radio) vs many (checkbox). */
  selectionType?: "radio" | "checkbox";
  /** selection: the available options. */
  selectionOptions?: SelectionOption[];
  /** name: include a title field (Mr/Ms/Dr...). */
  includeTitle?: boolean;
  /** address: allow non-UK addresses. */
  addressIsInternational?: boolean;
}

export interface SelectionOption {
  name: string;
}

export interface RoutingRule {
  /** The selected option name that triggers this branch. */
  answerValue: string;
  /** Target page id, or the sentinel for "skip to the end / check answers". */
  goToPageId: string | "CHECK_ANSWERS";
}
