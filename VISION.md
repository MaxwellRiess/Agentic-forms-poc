# What needs to happen to make easy agentic government services real

## The core idea

Government services should be **legible to AI agents**: a citizen's agent should be able to
discover a service, understand what it needs, fill it in, and submit it on the citizen's
behalf — safely and accountably.

We don't need to build that from scratch. **GOV.UK Forms is the leverage point.** Every
form on the platform is already authored as structured data (form → pages → questions →
answer types). The [forms-runner](https://github.com/alphagov/forms-runner) turns that
definition into a journey for humans. The same definition is, almost verbatim, the contract
an agent needs.

So the strategic move is: **make "agentic integration" a free projection of the form
definition.** A service team builds a form the way they do today; the machine-readable
contract (JSON Schema + discovery descriptor + MCP tools) is generated automatically. This
POC demonstrates exactly that projection. The rest of this document is what stands between
the POC and production.

## 1. A discovery standard

Agents need to find services by *intent*, not URL. We propose:

- A per-domain **`/.well-known/agents.json`** descriptor (prototyped here) pointing to the
  OpenAPI doc, per-form JSON Schemas, and the MCP endpoint, plus an **`llms.txt`** summary.
- A **cross-government registry** mapping intents ("report a pothole", "register a food
  business") to the right service and its contract — the agent equivalent of search on
  GOV.UK.
- Convergence on existing standards (**OpenAPI 3.1**, **JSON Schema**, **MCP**) so any
  agent framework interoperates without bespoke glue.

## 2. Identity and authorisation (GOV.UK One Login)

An agent acting for a citizen must prove it is authorised to do so.

- Delegated, **scoped, revocable** authorisation via **GOV.UK One Login** (OAuth-style):
  the citizen grants an agent permission to submit *this kind of* form, and can revoke it.
- Submissions must record **on whose behalf** they were made, and clearly distinguish
  agent-initiated from human-initiated sessions.

## 3. Human-in-the-loop consent and confirmation

For anything consequential, the human commits — not the agent.

- The agent **drafts**; the citizen **reviews and approves** the exact payload before it is
  submitted ("You are about to submit X to gov.uk").
- The structured `describe_form` → fill → confirm → `submit_form` flow makes this natural:
  the confirmation step is a first-class part of the contract, not an afterthought.

## 4. Audit and accountability

- Every agentic submission carries **provenance**: which agent, which model/version, the
  consent record, and a timestamp.
- Citizens get a **visible history** of what was submitted for them.
- A tamper-evident trail supports legal, FOI and complaint processes.

## 5. Eligibility and routing

GOV.UK forms already support conditional routing. Agents should benefit from it:

- **Branch-aware schemas** so an agent only collects answers that are actually relevant.
  *Prototyped here:* `src/transform/routing-to-conditionals.ts` compiles GOV.UK skip
  routing into JSON Schema `if/then/else`, so a question that is skipped on a branch must
  be absent, and a mandatory question that is on the branch is required. See the
  parking-permit fixture (a "Resident permit" skips the "Business name" question).
- **Next:** chained/multi-hop routing and routing questions that are themselves
  conditionally skipped; a two-phase flow where the agent submits routing answers first and
  gets back the narrowed set of remaining questions (mirroring how forms-runner reveals
  pages to humans).
- **Machine-readable eligibility rules** so an agent can pre-check whether the citizen even
  qualifies before asking a single question.

## 6. Payments

Many services charge a fee.

- An **agent-safe payment handoff** via **GOV.UK Pay**, where card details and the final
  payment authorisation stay with the human — the agent orchestrates, it never holds funds.

## 7. Error handling and resilience

- **Structured, recoverable validation errors** (prototyped here: per-field reasons the
  agent can act on and re-ask the user).
- **Idempotency keys** on submission so a retrying agent never double-submits.
- Clear retry and timeout semantics.

## 8. Trust and safety

- Defences against **prompt injection** and **impersonation** of government services.
- **Rate limiting**, **agent attestation / allow-listing**, and abuse monitoring.
- Particular care for **vulnerable users**, where an agent acting incorrectly could cause
  real harm — bias the design toward confirmation, transparency and reversibility.

## 9. The path to production

The cleanest end state is to **generate the contract inside `forms-runner` /
`forms-admin`** (Ruby on Rails), next to where the form definition already lives — so it is
genuinely out of the box for every form, with zero work from service teams. The same
endpoints could be served by the runner alongside the human-facing pages, and an MCP
gateway could front the whole estate.

This TypeScript POC deliberately proves the *shape and feasibility* of the projection. The
production win is wiring that projection into the existing Rails form-definition pipeline,
then layering on identity, consent, audit and payments as above.

---

*One sentence: because GOV.UK Forms already models services as data, agentic access is not a
new platform — it is a generated view of the platform we already have.*
