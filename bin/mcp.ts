#!/usr/bin/env -S npx tsx
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../src/mcp/server.js";

/**
 * MCP stdio entrypoint. Point an MCP client (Claude Desktop, Claude Code, the
 * demo script) at this file. See README for a sample client config.
 */
async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive; stderr is safe to log to (stdout is the protocol).
  console.error("govuk-agentic-forms MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
