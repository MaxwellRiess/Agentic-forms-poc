import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";
import { FormRepository } from "../src/store/form-repository.js";
import { SubmissionStore } from "../src/store/submission-store.js";

async function connectedClient(store: SubmissionStore) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(new FormRepository(), store);
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return { client, server };
}

function json(result: any): any {
  return JSON.parse(result.content[0].text);
}

describe("MCP end to end", () => {
  it("lists, describes and submits a form", async () => {
    const store = new SubmissionStore();
    const { client, server } = await connectedClient(store);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["list_forms", "describe_form", "submit_form"]),
    );

    const listed = json(await client.callTool({ name: "list_forms", arguments: {} }));
    expect(listed.forms.length).toBeGreaterThanOrEqual(3);

    const described = json(
      await client.callTool({ name: "describe_form", arguments: { formId: "report-a-pothole" } }),
    );
    expect(described.inputSchema.type).toBe("object");

    const submitted = json(
      await client.callTool({
        name: "submit_form",
        arguments: {
          formId: "report-a-pothole",
          answers: {
            where_is_the_pothole: { line1: "Acacia Ave", town: "Leeds", postcode: "LS1 1AA" },
            describe_the_pothole: "Large and dangerous.",
          },
        },
      }),
    );
    expect(submitted.status).toBe("submitted");
    expect(submitted.reference).toMatch(/^[A-Z]+-[A-Z0-9]{5}$/);
    expect(store.all()).toHaveLength(1);

    await client.close();
    await server.close();
  });

  it("returns structured field errors for invalid answers", async () => {
    const store = new SubmissionStore();
    const { client, server } = await connectedClient(store);

    const result: any = await client.callTool({
      name: "submit_form",
      arguments: { formId: "report-a-pothole", answers: { describe_the_pothole: "no location" } },
    });
    expect(result.isError).toBe(true);
    const payload = json(result);
    expect(payload.status).toBe("validation_failed");
    expect(payload.errors.length).toBeGreaterThan(0);
    expect(store.all()).toHaveLength(0);

    await client.close();
    await server.close();
  });
});
