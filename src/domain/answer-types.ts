/**
 * Answer types mirror the GOV.UK Forms `answer_type` model.
 *
 * In the real platform these live on the Page/Step model in `alphagov/forms-admin`
 * and `alphagov/forms-runner`. The runner uses the answer type to decide which
 * input component to render for a human; here we use the exact same enum to decide
 * how to project the question into a machine-readable contract for an agent.
 */
export type AnswerType =
  | "text"
  | "number"
  | "date"
  | "email"
  | "phone_number"
  | "national_insurance_number"
  | "address"
  | "name"
  | "organisation_name"
  | "selection"
  | "file";

export const ANSWER_TYPES: readonly AnswerType[] = [
  "text",
  "number",
  "date",
  "email",
  "phone_number",
  "national_insurance_number",
  "address",
  "name",
  "organisation_name",
  "selection",
  "file",
] as const;
