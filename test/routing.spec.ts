import { describe, it, expect } from "vitest";
import { FormRepository } from "../src/store/form-repository.js";
import { validateAnswers } from "../src/validate/validate-answers.js";

const repo = new FormRepository();
const contract = repo.getContract("apply-for-a-parking-permit")!;
const schema = contract.answerSchema;

// Answers common to every branch.
const common = {
  your_name: { title: "Ms", firstName: "Ada", lastName: "Lovelace" },
  your_home_address: { line1: "10 Downing Street", town: "London", postcode: "SW1A 2AA" },
  vehicle_registration_number: "AB12 CDE",
  date_you_want_the_permit_to_start: "2026-07-01",
};

describe("branch-aware routing", () => {
  it("does not mark the skippable question as unconditionally required", () => {
    expect(schema.required).not.toContain("business_name");
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "what_type_of_permit_do_you_need",
        "your_name",
        "vehicle_registration_number",
      ]),
    );
  });

  it("emits an if/then/else conditional for the skipped page", () => {
    expect(schema.allOf?.length).toBe(1);
    const block = schema.allOf![0]!;
    expect(block.then).toEqual({ not: { required: ["business_name"] } });
    expect(block.else).toEqual({ required: ["business_name"] });
  });

  it("annotates the question with when it applies", () => {
    const q = contract.questions.find((q) => q.key === "business_name")!;
    expect(q.required).toBe(false);
    expect(q.appliesWhen).toContain("Resident permit");
  });

  it("Business permit REQUIRES business name", () => {
    const withName = validateAnswers(schema, {
      what_type_of_permit_do_you_need: "Business permit",
      business_name: "Acme Ltd",
      ...common,
    });
    expect(withName.valid).toBe(true);

    const withoutName = validateAnswers(schema, {
      what_type_of_permit_do_you_need: "Business permit",
      ...common,
    });
    expect(withoutName.valid).toBe(false);
  });

  it("Resident permit FORBIDS business name (off the branch)", () => {
    const withoutName = validateAnswers(schema, {
      what_type_of_permit_do_you_need: "Resident permit",
      ...common,
    });
    expect(withoutName.valid).toBe(true);

    const withName = validateAnswers(schema, {
      what_type_of_permit_do_you_need: "Resident permit",
      business_name: "Acme Ltd",
      ...common,
    });
    expect(withName.valid).toBe(false);
  });
});
