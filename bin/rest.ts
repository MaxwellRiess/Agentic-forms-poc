#!/usr/bin/env -S npx tsx
import { buildRestApp } from "../src/rest/server.js";

const PORT = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  const app = buildRestApp();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`REST + discovery surface on http://localhost:${PORT}`);
  console.log(`  Agent descriptor: http://localhost:${PORT}/.well-known/agents.json`);
  console.log(`  OpenAPI:          http://localhost:${PORT}/openapi.json`);
  console.log(`  Forms:            http://localhost:${PORT}/forms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
