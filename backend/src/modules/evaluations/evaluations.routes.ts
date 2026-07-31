import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { convertSchema } from "../../core/utils/schema.js";
import { evaluationsService, PDQI9_CRITERIA } from "./evaluations.service.js";

const assignmentSchema = z.object({ consultaEstudioId: z.string().uuid(), evaluadorId: z.string().uuid() });
const scoreSchema = z.object({
  documentoId: z.string().uuid(),
  puntajes: z.object(Object.fromEntries(PDQI9_CRITERIA.map((key) => [key, z.number().int().min(1).max(5)])) as any),
  observaciones: z.string().max(2000).optional(),
});

export async function evaluationsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);
  app.get("/admin/evaluators", async (request, reply) => {
    if (String((request.user as any).rol) !== "administrador") return reply.code(403).send({ error: "Solo administrador" });
    return evaluationsService.listEvaluators();
  });
  app.get("/admin/assignable-consultations", async (request, reply) => {
    if (String((request.user as any).rol) !== "administrador") return reply.code(403).send({ error: "Solo administrador" });
    return evaluationsService.listAssignableConsultations();
  });
  app.post("/admin/assignments", { schema: { body: convertSchema(assignmentSchema) } }, async (request, reply) => {
    if (String((request.user as any).rol) !== "administrador") return reply.code(403).send({ error: "Solo administrador" });
    try { return reply.code(201).send(await evaluationsService.createAssignment(String((request.user as any).sub), (request.body as any).consultaEstudioId, (request.body as any).evaluadorId)); }
    catch (error: any) { return reply.code(400).send({ error: error.message }); }
  });
  app.get("/my-assignments", async (request, reply) => {
    if (String((request.user as any).rol) !== "evaluador") return reply.code(403).send({ error: "Solo evaluador" });
    return evaluationsService.listEvaluatorAssignments(String((request.user as any).sub));
  });
  app.post("/assignments/:id/scores", { schema: { body: convertSchema(scoreSchema) } }, async (request, reply) => {
    if (String((request.user as any).rol) !== "evaluador") return reply.code(403).send({ error: "Solo evaluador" });
    try { return await evaluationsService.submitScore(String((request.user as any).sub), String((request.params as any).id), (request.body as any).documentoId, (request.body as any).puntajes, (request.body as any).observaciones); }
    catch (error: any) { return reply.code(400).send({ error: error.message }); }
  });
}
