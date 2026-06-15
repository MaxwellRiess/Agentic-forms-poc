import type { FormRepository } from "../store/form-repository.js";

/**
 * Generate a minimal OpenAPI 3.1 document from the same contracts. OpenAPI 3.1
 * adopts JSON Schema, so the generated answer schemas drop straight in as
 * request bodies — the REST surface, the `/schema` endpoint and the MCP
 * inputSchema all share one schema.
 */
export function buildOpenApi(repo: FormRepository): object {
  const paths: Record<string, unknown> = {
    "/forms": {
      get: {
        summary: "List available forms",
        responses: { "200": { description: "List of forms" } },
      },
    },
  };

  for (const { formId, name } of repo.listForms()) {
    const contract = repo.getContract(formId)!;
    paths[`/forms/${formId}`] = {
      get: {
        summary: `Describe "${name}"`,
        responses: { "200": { description: "Form questions and metadata" } },
      },
    };
    paths[`/forms/${formId}/schema`] = {
      get: {
        summary: `JSON Schema for "${name}" answers`,
        responses: { "200": { description: "JSON Schema" } },
      },
    };
    paths[`/forms/${formId}/submissions`] = {
      post: {
        summary: `Submit "${name}"`,
        requestBody: {
          required: true,
          content: { "application/json": { schema: contract.answerSchema } },
        },
        responses: {
          "201": { description: "Submitted" },
          "422": { description: "Validation failed" },
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "GOV.UK Agentic Forms (POC)",
      version: "0.1.0",
      description:
        "Machine-readable surface for GOV.UK forms, generated automatically from form definitions.",
    },
    paths,
  };
}
