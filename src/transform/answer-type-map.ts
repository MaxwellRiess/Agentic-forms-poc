import type { Page } from "../domain/form-definition.js";
import type { AnswerType } from "../domain/answer-types.js";
import type { JSONSchema } from "./json-schema.js";

/**
 * THE single source of truth for how a GOV.UK answer type becomes a contract.
 *
 * Both projections (REST/JSON Schema and MCP) read from this table, so the two
 * surfaces can never drift: one form definition, one mapping, two transports.
 */
export interface TypeMapping {
  /** Base JSON Schema for one answer of this type (before required/optional). */
  jsonSchema: (page: Page) => JSONSchema;
  /** Natural-language hint so an agent knows exactly what to provide. */
  describe: (page: Page) => string;
}

// Canonical UK National Insurance number format (no spaces, upper-cased).
const NINO_PATTERN = "^[A-CEGHJ-PR-TW-Z]{2}[0-9]{6}[A-D]$";
// Pragmatic UK phone pattern: digits, spaces, +, (), min length.
const UK_PHONE_PATTERN = "^[0-9 ()+-]{7,}$";
// Loose UK postcode pattern.
const UK_POSTCODE_PATTERN = "^[A-Za-z]{1,2}[0-9][0-9A-Za-z]? ?[0-9][A-Za-z]{2}$";

function selectionOptionNames(page: Page): string[] {
  return (page.answerSettings?.selectionOptions ?? []).map((o) => o.name);
}

export const ANSWER_TYPE_MAP: Record<AnswerType, TypeMapping> = {
  text: {
    jsonSchema: (page) => ({
      type: "string",
      maxLength: page.answerSettings?.inputType === "long_text" ? 5000 : 499,
    }),
    describe: (page) =>
      page.answerSettings?.inputType === "long_text"
        ? "A free-text answer (can be several sentences)."
        : "A short free-text answer.",
  },

  number: {
    jsonSchema: () => ({ type: "number" }),
    describe: () => "A number.",
  },

  date: {
    jsonSchema: () => ({ type: "string", format: "date" }),
    describe: () => "A date in ISO format YYYY-MM-DD.",
  },

  email: {
    jsonSchema: () => ({ type: "string", format: "email" }),
    describe: () => "An email address.",
  },

  phone_number: {
    jsonSchema: () => ({ type: "string", pattern: UK_PHONE_PATTERN }),
    describe: () => "A UK phone number.",
  },

  national_insurance_number: {
    jsonSchema: () => ({ type: "string", pattern: NINO_PATTERN }),
    describe: () =>
      "A UK National Insurance number, e.g. QQ123456C (no spaces, upper-case).",
  },

  address: {
    jsonSchema: () => ({
      type: "object",
      properties: {
        line1: { type: "string" },
        line2: { type: "string" },
        town: { type: "string" },
        postcode: { type: "string", pattern: UK_POSTCODE_PATTERN },
      },
      required: ["line1", "town", "postcode"],
      additionalProperties: false,
    }),
    describe: () => "A UK address (line1, optional line2, town and postcode).",
  },

  name: {
    jsonSchema: (page) => {
      const properties: Record<string, JSONSchema> = {
        firstName: { type: "string" },
        lastName: { type: "string" },
      };
      const required = ["firstName", "lastName"];
      if (page.answerSettings?.includeTitle) {
        properties.title = { type: "string" };
      }
      return {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      };
    },
    describe: (page) =>
      page.answerSettings?.includeTitle
        ? "A person's name (optional title, first name, last name)."
        : "A person's name (first name and last name).",
  },

  organisation_name: {
    jsonSchema: () => ({ type: "string" }),
    describe: () => "The name of an organisation.",
  },

  selection: {
    jsonSchema: (page) => {
      const options = selectionOptionNames(page);
      if (page.answerSettings?.selectionType === "checkbox") {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string", enum: options },
          uniqueItems: true,
        };
        return schema;
      }
      return { type: "string", enum: options };
    },
    describe: (page) => {
      const options = selectionOptionNames(page);
      const list = options.map((o) => `"${o}"`).join(", ");
      return page.answerSettings?.selectionType === "checkbox"
        ? `Select one or more of: ${list}.`
        : `Select exactly one of: ${list}.`;
    },
  },

  file: {
    jsonSchema: () => ({
      type: "string",
      description: "A reference to an uploaded file (filename or URI).",
    }),
    describe: () =>
      "A reference to an uploaded file. (Real binary upload is out of scope for this POC.)",
  },
};
