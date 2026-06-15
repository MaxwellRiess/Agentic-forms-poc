import { describe, it, expect } from "vitest";
import { buildRestApp } from "../src/rest/server.js";
import { FormRepository } from "../src/store/form-repository.js";
import { SubmissionStore } from "../src/store/submission-store.js";
import { createMcpServer } from "../src/mcp/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

describe("REST + discovery surface", () => {
  it("serves the .well-known agent descriptor", async () => {
    const app = buildRestApp();
    const res = await app.inject({ method: "GET", url: "/.well-known/agents.json" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contracts.openapi).toContain("/openapi.json");
    expect(body.standards).toContain("Model Context Protocol");
    await app.close();
  });

  it("lists forms and serves a JSON Schema per form", async () => {
    const app = buildRestApp();
    const forms = (await app.inject({ method: "GET", url: "/forms" })).json();
    expect(forms.forms.length).toBeGreaterThanOrEqual(3);

    const schema = (
      await app.inject({ method: "GET", url: "/forms/report-a-pothole/schema" })
    ).json();
    expect(schema.type).toBe("object");
    expect(schema.required).toContain("where_is_the_pothole");
    await app.close();
  });

  it("accepts a valid submission (201) and rejects an invalid one (422)", async () => {
    const app = buildRestApp();

    const ok = await app.inject({
      method: "POST",
      url: "/forms/report-a-pothole/submissions",
      payload: {
        where_is_the_pothole: { line1: "Acacia Ave", town: "Leeds", postcode: "LS1 1AA" },
        describe_the_pothole: "Large and dangerous.",
      },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().reference).toBeTruthy();

    const bad = await app.inject({
      method: "POST",
      url: "/forms/report-a-pothole/submissions",
      payload: { describe_the_pothole: "no location" },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().errors.length).toBeGreaterThan(0);
    await app.close();
  });
});

describe("cross-transport parity (one contract, two projections)", () => {
  it("MCP and REST accept the same payload and store the same answers", async () => {
    const answers = {
      where_is_the_pothole: { line1: "Acacia Ave", town: "Leeds", postcode: "LS1 1AA" },
      describe_the_pothole: "Large and dangerous.",
      how_many_potholes_are_there_at_this_location: 2,
    };

    // REST
    const restStore = new SubmissionStore();
    const app = buildRestApp(new FormRepository(), restStore);
    const restRes = await app.inject({
      method: "POST",
      url: "/forms/report-a-pothole/submissions",
      payload: answers,
    });
    expect(restRes.statusCode).toBe(201);
    await app.close();

    // MCP
    const mcpStore = new SubmissionStore();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer(new FormRepository(), mcpStore);
    await server.connect(st);
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(ct);
    await client.callTool({
      name: "submit_form",
      arguments: { formId: "report-a-pothole", answers },
    });
    await client.close();
    await server.close();

    expect(mcpStore.all()[0]!.answers).toEqual(restStore.all()[0]!.answers);
  });
});
