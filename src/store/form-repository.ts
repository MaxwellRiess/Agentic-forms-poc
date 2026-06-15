import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FormDefinition } from "../domain/form-definition.js";
import { buildAgentContract } from "../transform/index.js";
import type { AgentContract } from "../transform/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, "..", "..", "fixtures");

/**
 * Loads the sample GOV.UK-style form definitions from `fixtures/` and exposes
 * the derived agent contracts. In production this would read from the
 * forms-admin API instead of JSON files on disk.
 */
export class FormRepository {
  private forms = new Map<string, FormDefinition>();
  private contracts = new Map<string, AgentContract>();

  constructor(dir: string = FIXTURES_DIR) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const raw = readFileSync(join(dir, file), "utf8");
      const form = JSON.parse(raw) as FormDefinition;
      this.add(form);
    }
  }

  add(form: FormDefinition): void {
    this.forms.set(form.id, form);
    this.contracts.set(form.id, buildAgentContract(form));
  }

  listForms(): { formId: string; name: string; description: string }[] {
    return [...this.contracts.values()].map((c) => ({
      formId: c.formId,
      name: c.name,
      description: c.description,
    }));
  }

  getForm(id: string): FormDefinition | undefined {
    return this.forms.get(id);
  }

  getContract(id: string): AgentContract | undefined {
    return this.contracts.get(id);
  }
}
