/**
 * The `.well-known/agents.json` discovery descriptor. An agent that lands on a
 * government domain reads this one file to find every machine-readable contract:
 * the OpenAPI doc, the per-form JSON Schemas, and how to reach the MCP server.
 *
 * This nods to the emerging `.well-known/` discovery convention and `llms.txt`,
 * and points at OpenAPI 3.1 + JSON Schema + MCP as the contract standards.
 */
export function agentsDescriptor(baseUrl: string): object {
  return {
    name: "GOV.UK Forms (agentic POC)",
    description:
      "Discover and submit GOV.UK forms programmatically. Every contract here is generated automatically from the form definitions service teams already author.",
    contracts: {
      openapi: `${baseUrl}/openapi.json`,
      listForms: `${baseUrl}/forms`,
      describeFormPattern: `${baseUrl}/forms/{id}`,
      answerSchemaPattern: `${baseUrl}/forms/{id}/schema`,
      submitPattern: `${baseUrl}/forms/{id}/submissions`,
    },
    mcp: {
      transport: "stdio",
      entrypoint: "bin/mcp.ts",
      tools: ["list_forms", "describe_form", "submit_form"],
    },
    standards: ["OpenAPI 3.1", "JSON Schema draft-07", "Model Context Protocol"],
  };
}

/** A tiny llms.txt pointing agents at the structured descriptor. */
export function llmsTxt(baseUrl: string): string {
  return [
    "# GOV.UK Forms (agentic POC)",
    "",
    "Submit GOV.UK forms programmatically. Contracts are generated from form definitions.",
    "",
    "## Discovery",
    `- Agent descriptor: ${baseUrl}/.well-known/agents.json`,
    `- OpenAPI: ${baseUrl}/openapi.json`,
    `- List forms: ${baseUrl}/forms`,
    "",
  ].join("\n");
}
