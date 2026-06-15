import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FormRepository } from "../store/form-repository.js";
import { SubmissionStore } from "../store/submission-store.js";
import { callTool, toolDefs } from "./tools.js";

/**
 * Build an MCP server that exposes any GOV.UK form as agent tools. The same
 * server object is connected to a stdio transport in production (bin/mcp.ts)
 * and to an in-memory transport in the integration tests.
 */
export function createMcpServer(
  repo: FormRepository = new FormRepository(),
  store: SubmissionStore = new SubmissionStore(),
): Server {
  const server = new Server(
    { name: "govuk-agentic-forms", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefs(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // ToolResult is structurally a CallToolResult; cast to satisfy the SDK's
    // broader ServerResult union (which also covers async task results).
    return callTool(repo, store, name, (args ?? {}) as Record<string, unknown>) as unknown as Record<
      string,
      unknown
    >;
  });

  return server;
}
