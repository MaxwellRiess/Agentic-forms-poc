import type { FormDefinition } from "../domain/form-definition.js";
import type { FieldEntry } from "./field-key.js";
import type { JSONSchema } from "./json-schema.js";

/**
 * Branch-aware routing.
 *
 * GOV.UK Forms supports forward "skip" routing: a selection question may say
 * "if the answer is V, jump to page T", which skips every page strictly between
 * the routing question and T (or, with the CHECK_ANSWERS sentinel, every
 * remaining page). A skipped page is not part of that branch's journey.
 *
 * We compile those rules into JSON Schema `if/then/else` so the generated
 * contract enforces the journey: a skipped question must be absent, and a
 * mandatory question that IS on the branch must be present. The same ajv
 * validator used everywhere understands these keywords natively.
 *
 * Scope: assumes routing questions themselves sit on the main path (a routing
 * question that is itself conditionally skipped is out of scope for the POC).
 */
export interface RoutingAnalysis {
  /** `allOf` conditional blocks to merge into the answer schema. */
  conditionals: JSONSchema[];
  /** Keys whose requiredness is conditional — kept OUT of top-level `required`. */
  conditionalKeys: Set<string>;
  /** Human note per pageId explaining when the question applies. */
  applicability: Map<string, string>;
}

interface SkipCondition {
  questionKey: string;
  questionText: string;
  value: string;
}

export function analyseRouting(
  form: FormDefinition,
  fieldIndex: FieldEntry[],
): RoutingAnalysis {
  const entryByPageId = new Map(fieldIndex.map((e) => [e.pageId, e]));
  const pageById = new Map(form.pages.map((p) => [p.id, p]));
  const sorted = [...form.pages].sort((a, b) => a.position - b.position);

  // pageId -> the conditions under which it is skipped
  const skips = new Map<string, SkipCondition[]>();
  const addSkip = (pageId: string, cond: SkipCondition): void => {
    const list = skips.get(pageId) ?? [];
    list.push(cond);
    skips.set(pageId, list);
  };

  for (const question of sorted) {
    if (!question.routing || question.routing.length === 0) continue;
    const qEntry = entryByPageId.get(question.id);
    if (!qEntry) continue;

    for (const rule of question.routing) {
      // Upper bound (exclusive) of the skipped range.
      let upper: number;
      if (rule.goToPageId === "CHECK_ANSWERS") {
        upper = Number.POSITIVE_INFINITY;
      } else {
        const target = pageById.get(rule.goToPageId);
        if (!target) continue;
        upper = target.position;
      }
      for (const candidate of sorted) {
        if (candidate.position > question.position && candidate.position < upper) {
          addSkip(candidate.id, {
            questionKey: qEntry.key,
            questionText: question.questionText,
            value: rule.answerValue,
          });
        }
      }
    }
  }

  const conditionals: JSONSchema[] = [];
  const conditionalKeys = new Set<string>();
  const applicability = new Map<string, string>();

  for (const [pageId, conditions] of skips) {
    const entry = entryByPageId.get(pageId);
    const page = pageById.get(pageId);
    if (!entry || !page) continue;
    conditionalKeys.add(entry.key);

    // Skipped when ANY governing routing answer is active. `required` on the
    // routing key means an absent answer counts as "not skipped" (default flow).
    const skipIf: JSONSchema = {
      anyOf: conditions.map((c) => ({
        properties: { [c.questionKey]: { const: c.value } },
        required: [c.questionKey],
      })),
    };

    const block: JSONSchema = {
      if: skipIf,
      then: { not: { required: [entry.key] } }, // off-branch: must be absent
    };
    if (!page.isOptional) {
      block.else = { required: [entry.key] }; // on-branch + mandatory: required
    }
    conditionals.push(block);

    const reasons = conditions.map((c) => `"${c.questionText}" is "${c.value}"`).join(" or ");
    applicability.set(
      pageId,
      `Does not apply when ${reasons}; omit it on that branch.`,
    );
  }

  return { conditionals, conditionalKeys, applicability };
}
