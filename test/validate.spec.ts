import { describe, it, expect } from "vitest";
import { FormRepository } from "../src/store/form-repository.js";
import { validateAnswers } from "../src/validate/validate-answers.js";

const repo = new FormRepository();

function pothole() {
  return repo.getContract("report-a-pothole")!.answerSchema;
}
function food() {
  return repo.getContract("register-a-food-business")!.answerSchema;
}

describe("validation against generated schema", () => {
  it("accepts a complete valid pothole submission", () => {
    const r = validateAnswers(pothole(), {
      where_is_the_pothole: { line1: "Acacia Ave", town: "Leeds", postcode: "LS1 1AA" },
      describe_the_pothole: "Large and dangerous.",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects when a required field is missing", () => {
    const r = validateAnswers(pothole(), {
      describe_the_pothole: "No location given.",
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field.includes("where_is_the_pothole"))).toBe(true);
  });

  it("allows optional fields to be omitted", () => {
    const r = validateAnswers(pothole(), {
      where_is_the_pothole: { line1: "A", town: "B", postcode: "LS1 1AA" },
      describe_the_pothole: "x",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects an invalid email", () => {
    const r = validateAnswers(food(), {
      name_of_the_food_business: "Cafe",
      name_of_the_owner_or_main_contact: { firstName: "A", lastName: "B" },
      contact_email_address: "not-an-email",
      owner_national_insurance_number: "QQ123456C",
      date_the_business_will_start_trading: "2026-09-01",
      what_types_of_food_activity_will_you_carry_out: ["Selling food"],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field.includes("contact_email_address"))).toBe(true);
  });

  it("rejects a malformed NI number and a bad date", () => {
    const r = validateAnswers(food(), {
      name_of_the_food_business: "Cafe",
      name_of_the_owner_or_main_contact: { firstName: "A", lastName: "B" },
      contact_email_address: "a@b.com",
      owner_national_insurance_number: "12345",
      date_the_business_will_start_trading: "01/09/2026",
      what_types_of_food_activity_will_you_carry_out: ["Selling food"],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects an unknown selection option", () => {
    const r = validateAnswers(food(), {
      name_of_the_food_business: "Cafe",
      name_of_the_owner_or_main_contact: { firstName: "A", lastName: "B" },
      contact_email_address: "a@b.com",
      owner_national_insurance_number: "QQ123456C",
      date_the_business_will_start_trading: "2026-09-01",
      what_types_of_food_activity_will_you_carry_out: ["Juggling"],
    });
    expect(r.valid).toBe(false);
  });

  it("rejects an empty required checkbox", () => {
    const r = validateAnswers(food(), {
      name_of_the_food_business: "Cafe",
      name_of_the_owner_or_main_contact: { firstName: "A", lastName: "B" },
      contact_email_address: "a@b.com",
      owner_national_insurance_number: "QQ123456C",
      date_the_business_will_start_trading: "2026-09-01",
      what_types_of_food_activity_will_you_carry_out: [],
    });
    expect(r.valid).toBe(false);
  });
});
