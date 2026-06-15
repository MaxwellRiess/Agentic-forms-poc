import type { FormRepository } from "../store/form-repository.js";
import type { SubmissionStore } from "../store/submission-store.js";
import { submitForm } from "../core/submit.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Tool catalogue exposed over MCP. Three generic tools cover any form. */
export function toolDefs(): ToolDef[] {
  return [
    {
      name: "list_forms",
      description:
        "Discover the GOV.UK services available to complete. Returns each form's id, name and a short description. Start here.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "describe_form",
      description:
        "Get everything needed to complete a form: its questions, hints, options, which answers are required, and the exact JSON input schema for submit_form.",
      inputSchema: {
        type: "object",
        properties: { formId: { type: "string", description: "Form id from list_forms." } },
        required: ["formId"],
        additionalProperties: false,
      },
    },
    {
      name: "submit_form",
      description:
        "Submit completed answers for a form. Answers must match the schema returned by describe_form. Returns a submission reference on success, or per-field errors to fix.",
      inputSchema: {
        type: "object",
        properties: {
          formId: { type: "string", description: "Form id from list_forms." },
          answers: {
            type: "object",
            description: "Answer payload keyed by the field names from describe_form.",
          },
        },
        required: ["formId", "answers"],
        additionalProperties: false,
      },
    },
  ];
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

function text(value: unknown): ToolResult {
  return {
    content: [
      { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
    ],
  };
}

function error(value: unknown): ToolResult {
  return { ...text(value), isError: true };
}

/** Dispatch a tool call. Shared by the live server and the integration tests. */
export function callTool(
  repo: FormRepository,
  store: SubmissionStore,
  name: string,
  args: Record<string, unknown>,
): ToolResult {
  switch (name) {
    case "list_forms":
      return text({ forms: repo.listForms() });

    case "describe_form": {
      const contract = repo.getContract(String(args.formId));
      if (!contract) return error(`No form found with id "${String(args.formId)}".`);
      return text({
        formId: contract.formId,
        name: contract.name,
        description: contract.description,
        questions: contract.questions,
        inputSchema: contract.mcpInputSchema,
        whatHappensNext: contract.confirmation.whatHappensNext,
      });
    }

    case "submit_form": {
      const formId = String(args.formId);
      const answers = (args.answers ?? {}) as Record<string, unknown>;
      const result = submitForm(repo, store, formId, answers, "mcp");
      if (result.ok === false && result.reason === "not_found") {
        return error(`No form found with id "${formId}".`);
      }
      if (result.ok === false) {
        return error({
          status: "validation_failed",
          message: "Some answers were invalid. Fix these and resubmit.",
          errors: result.errors,
        });
      }
      return text({
        status: "submitted",
        reference: result.submission.reference,
        submittedAt: result.submission.submittedAt,
        confirmationSentTo: result.submission.confirmationSentTo,
        whatHappensNext: result.whatHappensNext,
      });
    }

    default:
      return error(`Unknown tool "${name}".`);
  }
}
