# Agentic Forms POC — making GOV.UK services legible to AI agents

**Thesis:** [GOV.UK Forms](https://github.com/govuk-forms/forms) already stores every
form as structured data — a form is `pages → questions → answer_types` (text, email,
date, address, selection, …), served to the [forms-runner](https://github.com/alphagov/forms-runner)
which renders it for humans. **That same definition is exactly what an AI agent needs.**

So "agentic integration out of the box" isn't a new product — it's a *projection*. This
POC takes a GOV.UK-style form definition and, with **one canonical transform**, generates
a machine-readable agent contract exposed two ways:

- an **MCP server** (form-as-tools) that an agent like Claude calls directly, and
- a **REST API + `/.well-known/agents.json` discovery + per-form JSON Schema**.

A service team writes a normal form. The agent interface falls out for free — and the two
surfaces can never drift, because both are generated from the same mapping.

## The one transform

```
FormDefinition  ──buildAgentContract()──►  AgentContract
                                              ├─ answerSchema     (JSON Schema  → REST)
                                              ├─ mcpInputSchema   (+descriptions → MCP)
                                              ├─ questions        (human-readable)
                                              └─ fieldIndex       (id ⇄ readable key)
```

`src/transform/answer-type-map.ts` is the single source of truth mapping each GOV.UK
`answer_type` to a schema fragment. `src/transform/index.ts` (`buildAgentContract`) is the
whole thesis in one function. Transports (`src/mcp`, `src/rest`) only project it — they
never re-implement schema logic, and both submit through the same `src/core/submit.ts`.

## Layout

```
fixtures/        sample form definitions (pothole; parking permit w/ routing; food business)
src/domain/      FormDefinition + answer_type types (mirror GOV.UK Forms)
src/transform/   the canonical transform (answer-type-map, to-json-schema, routing-to-conditionals, contract, index)
src/validate/    ajv validation against the generated schema (shared by both transports)
src/core/        submitForm — single submit path
src/mcp/         MCP server: list_forms, describe_form, submit_form
src/rest/        Fastify routes, OpenAPI, /.well-known/agents.json, llms.txt
bin/             mcp.ts (stdio) and rest.ts (HTTP) entrypoints
demo/            scripted offline agent run + prompts for driving a real LLM
test/            transform/validation/routing unit tests + MCP & REST integration + parity test
```

## Run it

```bash
npm install
npm test            # 32 tests: transform, validation, branch-aware routing, MCP & REST e2e, parity
npm run demo        # offline scripted "agent" completes a form via MCP
npm run rest        # REST + discovery on http://localhost:3000
npm run mcp         # MCP server on stdio
```

With the REST server running:

```bash
curl localhost:3000/.well-known/agents.json          # discovery
curl localhost:3000/forms                            # list services
curl localhost:3000/forms/report-a-pothole/schema    # generated JSON Schema
curl -X POST localhost:3000/forms/report-a-pothole/submissions \
  -H 'content-type: application/json' \
  -d '{"where_is_the_pothole":{"line1":"Acacia Ave","town":"Leeds","postcode":"LS1 1AA"},
       "describe_the_pothole":"Deep, ~30cm, dangerous to cyclists."}'
```

To drive it with a real agent (Claude), see [`demo/prompts.md`](demo/prompts.md) for the
MCP client config and example prompts.

## What needs to happen next

This POC proves the *shape*. Turning it into real "easy agentic gov services" needs
discovery standards, citizen identity/consent, audit, payments and trust/safety — and,
ultimately, generating the contract inside `forms-runner`/`forms-admin` itself. See
[`VISION.md`](VISION.md).
