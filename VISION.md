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

## A shippable v1, and the division of labour

This does not have to be boil-the-ocean. In conversation with the GOV.UK Forms team, a
pragmatic split emerged: the **Forms platform** builds a handful of APIs, and **the agent
layer** (this POC) is then built largely independently on top. The concrete platform work:

1. a **public form-document API** (with internal-only fields kept internal),
2. a **submission API**,
3. **list / discover / search** for forms,
4. **high-volume submission delivery** (webhooks, etc.), and
5. **good documentation**.

Much of this the platform wants anyway for other roadmap goals (an App, save-and-return),
so the agentic use case rides on existing momentum rather than demanding net-new investment.
The exact request/response shapes and the public-vs-internal field split are written up in
[`INTERFACE.md`](INTERFACE.md).

Crucially, a v1 can **defer identity and payments** (sections 2 and 6 below): most simple
forms use neither today, so the long tail is shippable without them. They become necessary
for the high-value services, later — not for the first useful release.

## 1. A discovery standard

Agents need to find services by *intent*, not URL. We propose:

- A per-domain **`/.well-known/agents.json`** descriptor (prototyped here) pointing to the
  OpenAPI doc, per-form JSON Schemas, and the MCP endpoint, plus an **`llms.txt`** summary.
- A **cross-government registry** mapping intents ("report a pothole", "register a food
  business") to the right service and its contract — the agent equivalent of search on
  GOV.UK.
- Convergence on existing standards (**OpenAPI 3.1**, **JSON Schema**, **MCP**) so any
  agent framework interoperates without bespoke glue.

## 2. Identity and authorisation (GOV.UK One Login) — *deferrable for v1*

An agent acting for a citizen must prove it is authorised to do so. Note this is **not a v1
blocker** for the simple-forms long tail, most of which require no sign-in today.

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

## 6. Payments — *deferrable for v1*

Many services charge a fee — but most simple forms do not, so payments are not a v1 blocker
for the target subset.

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

2. **The schema is the easy part — but for the v1 subset, the easy part is most of the
   product.** Generating a schema is cheap; identity, consent, liability, payments, fraud
   and audit are harder and institutionally, not just technically, hard. The important
   nuance (raised by the Forms team) is that *the simple forms a v1 targets use neither auth
   nor payments*, so for that subset the cheap part genuinely is most of what's needed. The
   hard parts gate the *high-value* services, not the first useful release.

3. **The bottleneck is behind the front door — but this is a shift in scale, not a novel
   risk.** Agentic submission lowers the cost of *creating* submissions while the cost of
   *processing* them (often human caseworking) stays flat, and form friction does quiet
   rate-limiting work today. The Forms team's fair pushback: agents don't introduce a *new*
   category of risk — spam, fraud and capacity already exist and are handled with the same
   tools (rate limiting, departmental data validation, better platform-side validation),
   and high-volume delivery is on the roadmap regardless. So the honest framing is
   quantitative: plan for a changed volume curve, using mechanisms that already exist.

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

**Net:** back it as a wedge — the "free projection" insight is sound, the near-term value
for simple forms and accessibility is real, and (per the Forms team) a v1 is shippable
sooner than the full list above implies, by deferring auth/payments and building on platform
work that's already on the roadmap. Pitch it as "agent-legible simple forms", scope the
first release to the platform APIs in [`INTERFACE.md`](INTERFACE.md), and keep in view that
structured service APIs (which forms render) may be the longer-term goal.

---

*One sentence: because GOV.UK Forms already models services as data, agentic access is not a
new platform — it is a generated view of the platform we already have.*
