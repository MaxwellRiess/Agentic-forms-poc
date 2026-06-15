#!/usr/bin/env -S npx tsx
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";

/**
 * A deterministic, offline stand-in for an LLM agent. It performs exactly the
 * tool sequence a real agent (e.g. Claude) would: discover -> understand ->
 * fill from what the "user" said -> submit -> report the reference.
 *
 * Run with: npm run demo
 */
function parseToolJson(result: any): any {
  const block = (result.content as { type: string; text?: string }[]).find(
    (c) => c.type === "text",
  );
  return block?.text ? JSON.parse(block.text) : undefined;
}

async function main(): Promise<void> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  await server.connect(serverTransport);

  const client = new Client({ name: "demo-agent", version: "0.1.0" });
  await client.connect(clientTransport);

  const say = (s: string) => console.log(s);

  say('🧑  User: "There\'s a deep pothole on Acacia Avenue, near number 42 in Leeds.');
  say('         It\'s about 30cm wide and a cyclist nearly came off. Report it for me."');
  say("");

  // 1. Discover
  const list = parseToolJson(await client.callTool({ name: "list_forms", arguments: {} }));
  say(`🤖  Agent → list_forms: found ${list.forms.length} services`);
  const form = list.forms.find((f: any) => f.formId === "report-a-pothole");
  say(`         picked "${form.name}"`);

  // 2. Understand
  const described = parseToolJson(
    await client.callTool({ name: "describe_form", arguments: { formId: "report-a-pothole" } }),
  );
  const required = described.questions.filter((q: any) => q.required).map((q: any) => q.key);
  say(`🤖  Agent → describe_form: ${described.questions.length} questions, required: ${required.join(", ")}`);

  // 3. Fill from what the user said (a real agent would reason this out itself)
  const answers = {
    where_is_the_pothole: { line1: "Acacia Avenue, near number 42", town: "Leeds", postcode: "LS1 1AA" },
    describe_the_pothole: "Deep pothole roughly 30cm wide. A cyclist nearly came off — dangerous.",
    how_many_potholes_are_there_at_this_location: 1,
  };
  say("🤖  Agent: drafted answers from the request; address postcode confirmed with user.");

  // 4. Submit
  const submitted = parseToolJson(
    await client.callTool({ name: "submit_form", arguments: { formId: "report-a-pothole", answers } }),
  );
  say("");
  say(`✅  Submitted. Reference: ${submitted.reference}`);
  say(`         ${submitted.whatHappensNext}`);

  await client.close();
  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
