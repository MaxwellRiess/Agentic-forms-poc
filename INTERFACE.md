# Interface contract: GOV.UK Forms platform ⇄ agent layer

This document formalises the boundary between **the Forms platform** (what the GOV.UK Forms
team would build) and **the agent layer** (the projection this POC demonstrates). It exists
so the two halves can be built largely independently, as proposed by the Forms team.

The shapes below are drawn from the POC's working mock. In the POC a single REST app both
serves form data *and* projects it for agents; in production those are two layers owned by
two teams. This doc draws the line.

## Responsibility split

| Forms platform (their side) | Agent layer (our side) |
|---|---|
| Public **form-document API** | `answer_type → JSON Schema / MCP` projection (`src/transform/`) |
| **Submission API** (validate + accept) | MCP server (`list_forms` / `describe_form` / `submit_form`) |
| **List / discover / search** forms | `.well-known/agents.json`, `llms.txt`, OpenAPI emission |
| **High-volume delivery** (webhooks, etc.) | Branch-aware routing, human-readable field descriptions |
| Server-side validation + abuse controls | Client-side pre-validation; agent UX, consent prompts |

The POC's dependency rule mirrors this line: `src/domain` + `src/store` mock the platform;
`src/transform` + `src/mcp` + `src/rest/well-known` are the agent layer and never reach into
platform internals.

## What the Forms platform needs to expose

Maps 1:1 to the Forms team's list (their item numbers in brackets).

### A. Form-document API — public [their #1]

Read access to a form's structure. **Critical:** split public structure from internal
delivery config.

`GET /forms/{id}` → the form document:

```jsonc
{
  "id": "report-a-pothole",
  "version": 7,                       // see "Versioning" below — REQUIRED
  "name": "Report a pothole",
  "whatHappensNext": "A highways inspector will assess...",
  "privacyPolicyUrl": "https://...",
  "supportEmail": "support@...",
  "pages": [
    {
      "id": "p1",
      "position": 1,
      "questionText": "Where is the pothole?",
      "hintText": "Give the street and nearest house number.",
      "isOptional": false,
      "answerType": "address",
      "answerSettings": { /* inputType | selectionType | selectionOptions | includeTitle | ... */ },
      "routing": [ { "answerValue": "...", "goToPageId": "..." } ]
    }
  ]
}
```

**Public vs internal field split** (their "move some info to internal APIs"):

| Field | Public form-document API | Internal API only |
|---|---|---|
| `id`, `version`, `name`, `whatHappensNext`, privacy/support links | ✅ | |
| `pages` (question text, hints, answer types, options, routing) | ✅ | |
| `submissionEmail` / delivery destination | | 🔒 internal |
| Notify template ids, processing/routing config, team metadata | | 🔒 internal |

> **POC catch to fix on alignment:** the POC currently echoes the submission email back to
> the caller as `confirmationSentTo` (`src/core/submit.ts`). That destination is internal
> and must not appear in any agent-facing response. The agent only needs a boolean/opaque
> "a confirmation was sent", never the address.

The POC's `FormDefinition` (`src/domain/form-definition.ts`) is our best guess at this
document. **Action: replace it with the real schema** once the platform team shares it.

### B. Submission API [their #2]

`POST /forms/{id}/submissions`

- **Request:** the answer payload, keyed per question. The platform validates **server-side**
  against the form document (the agent layer also pre-validates client-side using the
  generated JSON Schema, but the platform must not trust that).
- **Headers:** `Idempotency-Key` (REQUIRED) so a retrying agent never double-submits.
- **Success → 201:**

```jsonc
{ "status": "submitted", "reference": "POTH-7F3K2", "submittedAt": "2026-06-16T...Z" }
```

- **Validation failure → 422:** structured, per-field errors the agent can act on and
  re-ask the user:

```jsonc
{ "error": "validation_failed",
  "errors": [ { "field": "where_is_the_pothole", "message": "is required" } ] }
```

The POC implements exactly this shape (`POST /forms/:id/submissions`, `src/core/submit.ts`,
`src/validate/validate-answers.ts`) minus the idempotency key and the internal-email leak.

### C. List / discover / search [their #3]

- `GET /forms` → paginated list of `{ id, name, description, version }`. The POC has the
  list (`GET /forms`, `list_forms`).
- **Search by intent** — query like `?q=pothole` or tag/category metadata so an agent (or a
  cross-government registry) can find a service by *what the user wants to do*, not by URL.
  **Not in the POC** beyond per-service discovery; this is the highest-value agent-specific
  addition.

### D. High-volume submission delivery [their #4]

Webhooks / queue delivery for forms that outgrow the email-inbox model. **Entirely
platform-side; not in the POC.** Per the Forms team this is on the roadmap anyway (App,
save-and-return), and it is also the real answer to the "capacity once submission gets
cheap" concern — see `VISION.md`.

### E. Documentation [their #5]

Human docs are platform-side. The agent layer already emits the *machine-readable* docs —
OpenAPI (`src/rest/openapi.ts`), per-form JSON Schema (`/forms/{id}/schema`),
`.well-known/agents.json`, `llms.txt`.

## Cross-cutting requirements

- **Versioning.** Form documents change. Every document and submission must carry a
  `version` so an agent references a stable definition and submissions are attributable to
  the version in force. (Also enables "save and return".)
- **Validation is server-authoritative.** The generated schema makes the agent a good
  citizen, but the platform re-validates everything.
- **Stable field keys.** The agent layer derives readable keys from question text
  (`src/transform/field-key.ts`). If the platform exposes stable per-question identifiers,
  the agent layer should key on those instead, so renaming a question doesn't break clients.

## Deferrable for a v1 (deliberately out of scope)

Most simple forms use neither, so a useful v1 can ship without them (see `VISION.md`):

- **Delegated identity / auth** (GOV.UK One Login agent delegation).
- **Payments** (GOV.UK Pay handoff).

These matter for the high-value services later, not for the long tail of simple forms a v1
targets.
