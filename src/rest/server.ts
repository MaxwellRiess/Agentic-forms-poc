import Fastify, { type FastifyInstance } from "fastify";
import { FormRepository } from "../store/form-repository.js";
import { SubmissionStore } from "../store/submission-store.js";
import { submitForm } from "../core/submit.js";
import { buildOpenApi } from "./openapi.js";
import { agentsDescriptor, llmsTxt } from "./well-known.js";

/**
 * Build the REST + discovery surface. Every route is a thin projection of the
 * agent contracts; submission goes through the same `submitForm` path as MCP.
 */
export function buildRestApp(
  repo: FormRepository = new FormRepository(),
  store: SubmissionStore = new SubmissionStore(),
): FastifyInstance {
  const app = Fastify({ logger: false });

  const baseUrl = (req: { protocol: string; hostname: string; headers: Record<string, unknown> }): string =>
    `${req.protocol}://${String(req.headers.host ?? req.hostname)}`;

  app.get("/.well-known/agents.json", async (req) => agentsDescriptor(baseUrl(req)));

  app.get("/llms.txt", async (req, reply) => {
    reply.type("text/plain");
    return llmsTxt(baseUrl(req));
  });

  app.get("/openapi.json", async () => buildOpenApi(repo));

  app.get("/forms", async () => ({ forms: repo.listForms() }));

  app.get<{ Params: { id: string } }>("/forms/:id", async (req, reply) => {
    const contract = repo.getContract(req.params.id);
    if (!contract) return reply.code(404).send({ error: "form_not_found" });
    return {
      formId: contract.formId,
      name: contract.name,
      description: contract.description,
      questions: contract.questions,
      whatHappensNext: contract.confirmation.whatHappensNext,
      links: {
        schema: `/forms/${contract.formId}/schema`,
        submit: `/forms/${contract.formId}/submissions`,
      },
    };
  });

  app.get<{ Params: { id: string } }>("/forms/:id/schema", async (req, reply) => {
    const contract = repo.getContract(req.params.id);
    if (!contract) return reply.code(404).send({ error: "form_not_found" });
    return contract.answerSchema;
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/forms/:id/submissions",
    async (req, reply) => {
      const result = submitForm(repo, store, req.params.id, req.body ?? {}, "rest");
      if (result.ok === false && result.reason === "not_found") {
        return reply.code(404).send({ error: "form_not_found" });
      }
      if (result.ok === false) {
        return reply
          .code(422)
          .send({ error: "validation_failed", errors: result.errors });
      }
      return reply.code(201).send({
        status: "submitted",
        reference: result.submission.reference,
        submittedAt: result.submission.submittedAt,
        confirmationSentTo: result.submission.confirmationSentTo,
        whatHappensNext: result.whatHappensNext,
      });
    },
  );

  return app;
}
