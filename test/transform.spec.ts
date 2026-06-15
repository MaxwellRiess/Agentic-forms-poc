import { describe, it, expect } from "vitest";
import type { FormDefinition, Page } from "../src/domain/form-definition.js";
import { buildAgentContract } from "../src/transform/index.js";
import { buildFieldIndex } from "../src/transform/field-key.js";
import { pageFragment } from "../src/transform/to-json-schema.js";

function page(partial: Partial<Page> & Pick<Page, "answerType">): Page {
  return {
    id: "x",
    position: 1,
    questionText: "Question",
    isOptional: false,
    ...partial,
  };
}

describe("answer_type -> JSON Schema fragment", () => {
  it("text single line is a bounded string", () => {
    expect(pageFragment(page({ answerType: "text" }), false)).toMatchObject({
      type: "string",
      maxLength: 499,
    });
  });

  it("long text allows more characters", () => {
    const f = pageFragment(
      page({ answerType: "text", answerSettings: { inputType: "long_text" } }),
      false,
    );
    expect(f.maxLength).toBeGreaterThan(499);
  });

  it("number is numeric", () => {
    expect(pageFragment(page({ answerType: "number" }), false)).toMatchObject({ type: "number" });
  });

  it("date uses the date format", () => {
    expect(pageFragment(page({ answerType: "date" }), false)).toMatchObject({
      type: "string",
      format: "date",
    });
  });

  it("email uses the email format", () => {
    expect(pageFragment(page({ answerType: "email" }), false)).toMatchObject({
      type: "string",
      format: "email",
    });
  });

  it("national insurance number has the canonical pattern", () => {
    const f = pageFragment(page({ answerType: "national_insurance_number" }), false);
    expect(f.pattern).toContain("A-CEGHJ-PR-TW-Z");
  });

  it("address is a composite object with required parts", () => {
    const f = pageFragment(page({ answerType: "address" }), false);
    expect(f.type).toBe("object");
    expect(f.required).toEqual(expect.arrayContaining(["line1", "town", "postcode"]));
  });

  it("name includes title only when configured", () => {
    const without = pageFragment(page({ answerType: "name" }), false);
    expect(without.properties).not.toHaveProperty("title");
    const withTitle = pageFragment(
      page({ answerType: "name", answerSettings: { includeTitle: true } }),
      false,
    );
    expect(withTitle.properties).toHaveProperty("title");
  });

  it("radio selection becomes a string enum", () => {
    const f = pageFragment(
      page({
        answerType: "selection",
        answerSettings: {
          selectionType: "radio",
          selectionOptions: [{ name: "A" }, { name: "B" }],
        },
      }),
      false,
    );
    expect(f).toMatchObject({ type: "string", enum: ["A", "B"] });
  });

  it("required checkbox selection is an array with minItems 1", () => {
    const f = pageFragment(
      page({
        answerType: "selection",
        isOptional: false,
        answerSettings: {
          selectionType: "checkbox",
          selectionOptions: [{ name: "A" }, { name: "B" }],
        },
      }),
      false,
    );
    expect(f.type).toBe("array");
    expect(f.minItems).toBe(1);
    expect(f.items).toMatchObject({ enum: ["A", "B"] });
  });
});

describe("MCP schema mirrors JSON Schema (one contract, two projections)", () => {
  const form: FormDefinition = {
    id: "t",
    name: "Test form",
    submissionEmail: "t@example.gov.uk",
    pages: [
      page({ id: "a", position: 1, questionText: "Your email", answerType: "email" }),
      page({
        id: "b",
        position: 2,
        questionText: "Notes",
        isOptional: true,
        answerType: "text",
      }),
    ],
  };

  it("structural shape (types/required) is identical; only descriptions differ", () => {
    const c = buildAgentContract(form);
    const strip = (s: any): any =>
      JSON.parse(JSON.stringify(s, (k, v) => (k === "description" ? undefined : v)));
    expect(strip(c.mcpInputSchema)).toEqual(strip(c.answerSchema));
  });

  it("MCP schema adds per-field descriptions", () => {
    const c = buildAgentContract(form);
    const emailKey = c.fieldIndex[0]!.key;
    expect(c.mcpInputSchema.properties![emailKey]!.description).toContain("Your email");
  });

  it("required tracks isOptional", () => {
    const c = buildAgentContract(form);
    expect(c.answerSchema.required).toEqual(["your_email"]);
  });
});

describe("field index", () => {
  it("derives readable keys and disambiguates duplicates", () => {
    const form: FormDefinition = {
      id: "d",
      name: "Dupes",
      submissionEmail: "d@example.gov.uk",
      pages: [
        page({ id: "1", position: 1, questionText: "Your name", answerType: "name" }),
        page({ id: "2", position: 2, questionText: "Your name", answerType: "name" }),
      ],
    };
    const idx = buildFieldIndex(form);
    expect(idx.map((e) => e.key)).toEqual(["your_name", "your_name_2"]);
  });
});
