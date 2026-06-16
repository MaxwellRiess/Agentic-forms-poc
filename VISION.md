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

## Limitations and open questions

This proposal is a strong *bridge*, not a finished answer. It is worth being explicit about
where it is weak — a proposal that names its own limitations tends to be more credible than
one that doesn't.

1. **It makes simple *forms* legible, not "government services."** GOV.UK Forms is
   deliberately for low-complexity services: no payments, no integrations, no case
   management, with submissions often landing in an inbox as CSV/PDF. The high-value,
   high-volume services — HMRC/tax, Universal Credit, passports, visas, DVLA — are bespoke
   and are not (and will not be) built on Forms. So the honest claim is "agent-legible
   **simple forms**", which is the long tail, not the services people most want an agent
   for.

2. **The POC proves the easy 20%; the hard 80% is bracketed as "future" above.** Generating
   a schema is cheap. Identity/delegated auth (GOV.UK One Login has no agent-delegation
   model today), consent, liability, payments, fraud and audit are the real barrier — and
   they are institutionally hard, not just technically hard. The schema is the enabler, not
   the project.

3. **The bottleneck is behind the front door.** Agentic submission collapses the cost of
   *creating* submissions while the cost of *processing* them (often human caseworking)
   stays flat. Form friction today quietly acts as a rate limiter; removing it makes spam,
   fraudulent applications and caseworker-DoS cheaper too, against a high-value target.
   Agent-scale input meeting human-scale processing needs deliberate design (rate limits,
   triage, capacity planning).

4. **Accountability does not map cleanly onto agents.** Government submissions carry legal
   weight ("I confirm this is true"). If an agent misreads a user or hallucinates a field on
   a benefits or immigration form, the consequences are severe and liability is unresolved.
   Human-in-the-loop confirmation is load-bearing, and getting it right for vulnerable users
   on high-stakes services is harder than anything in this POC.

5. **Forms may be the on-ramp, not the destination.** A form is a human-UI artifact (pages,
   hints, "what happens next") that exists to guide people through data entry. For
   machine-to-government interaction the right primitive may be a clean service/data API,
   with the form as one renderer of it. Making the form *be* the agent contract risks
   encoding the human-form metaphor into the machine layer rather than designing that layer
   properly. Forms-as-agent-contract is a great bridge; it is a questionable end state.

**Net:** back it as a wedge — the "free projection" insight is sound and the near-term value
for simple forms and accessibility is real — but pitch it as "agent-legible simple forms",
treat identity/consent/liability/abuse/back-end capacity as the actual project, and be
explicit that structured service APIs (which forms render) may be the longer-term goal.

---

*One sentence: because GOV.UK Forms already models services as data, agentic access is not a
new platform — it is a generated view of the platform we already have.*
