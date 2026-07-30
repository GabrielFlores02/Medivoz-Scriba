import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { convertSchema } from "../../core/utils/schema.js";
import { studyService } from "./study.service.js";
import {
  INCIDENT_TYPES,
  STUDY_FLOWS,
  STUDY_SPECIALTIES,
  STUDY_TIMING_EVENTS,
} from "./study.policy.js";

const createConsultationSchema = z.object({
  consultaId: z.string().uuid(),
  flujo: z.enum(STUDY_FLOWS),
  especialidad: z.enum(STUDY_SPECIALTIES),
  esPacienteNuevo: z.boolean(),
  complejidad: z.enum(["baja", "media", "alta"]),
  acompanantePresente: z.boolean().default(false),
  numeroProblemas: z.number().int().min(1).max(20).default(1),
  confirmoNoRevisionExterna: z.literal(true),
  motivoExclusion: z.string().max(500).nullable().optional(),
});

const timingEventSchema = z.object({
  tipoEvento: z.enum(STUDY_TIMING_EVENTS),
  ocurridoEn: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const textSchema = z.object({
  text: z.string().min(20).max(50000),
});

const incidentSchema = z.object({
  tipo: z.enum(INCIDENT_TYPES),
  severidad: z.enum(["baja", "media", "alta", "critica"]).default("media"),
  descripcion: z.string().max(2000).optional(),
});

const actorFrom = (request: any) => ({
  userId: String(request.user.sub),
  role: String(request.user.rol || "doctor"),
});

export async function studyRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);
  app.addHook("preHandler", async (request, reply) => {
    if (String((request.user as any).rol) !== "administrador") {
      return reply.code(403).send({
        error: "El módulo Estudio 2.0 está disponible solo para administradores",
      });
    }
  });

  app.get("/protocols/active", async (_request, reply) => {
    try {
      return await studyService.getActiveProtocol();
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  app.get("/specialties", async (_request, reply) => {
    try {
      return await studyService.listSpecialties();
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/specialties/:specialty/knowledge", async (request, reply) => {
    try {
      const { specialty } = request.params as any;
      return await studyService.getSpecialtyKnowledge(decodeURIComponent(specialty));
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post(
    "/consultations",
    { schema: { body: convertSchema(createConsultationSchema) } },
    async (request, reply) => {
      try {
        const created = await studyService.createConsultation(
          actorFrom(request),
          request.body as any
        );
        return reply.code(201).send(created);
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  app.get("/consultations", async (request, reply) => {
    try {
      const query = request.query as any;
      return await studyService.listConsultations(actorFrom(request), {
        flujo: query.flujo,
        especialidad: query.especialidad,
        estado: query.estado,
        pendingToday: query.pendingToday === "true",
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/consultations/:id", async (request, reply) => {
    try {
      const { id } = request.params as any;
      return await studyService.getConsultation(id, actorFrom(request));
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  app.post(
    "/consultations/:id/timing-events",
    { schema: { body: convertSchema(timingEventSchema) } },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const { tipoEvento, ocurridoEn, metadata } = request.body as any;
        return await studyService.recordTimingEvent(
          id,
          actorFrom(request),
          tipoEvento,
          ocurridoEn,
          metadata
        );
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  app.post(
    "/consultations/:id/independent-anamnesis",
    { schema: { body: convertSchema(textSchema) } },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        return await studyService.saveIndependentAnamnesis(
          id,
          actorFrom(request),
          (request.body as any).text
        );
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  app.post("/consultations/:id/ai-draft/sync", async (request, reply) => {
    try {
      const { id } = request.params as any;
      return await studyService.syncHiddenAiDraft(id, actorFrom(request));
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/consultations/:id/ai-draft", async (request, reply) => {
    try {
      const { id } = request.params as any;
      return await studyService.getAiDraft(id, actorFrom(request));
    } catch (error: any) {
      const message = String(error.message || "");
      return reply
        .code(message.includes("BORRADOR_IA_BLOQUEADO") ? 423 : 400)
        .send({ error: message });
    }
  });

  app.post(
    "/consultations/:id/final-anamnesis",
    { schema: { body: convertSchema(textSchema) } },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        return await studyService.saveFinalAnamnesis(
          id,
          actorFrom(request),
          (request.body as any).text
        );
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  app.post(
    "/consultations/:id/incidents",
    { schema: { body: convertSchema(incidentSchema) } },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        return reply
          .code(201)
          .send(
            await studyService.addIncident(
              id,
              actorFrom(request),
              request.body as any
            )
          );
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  app.post("/consultations/:id/copy-events", async (request, reply) => {
    try {
      const { id } = request.params as any;
      return await studyService.registerCopyEvent(id, actorFrom(request));
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/dashboard", async (request, reply) => {
    try {
      return await studyService.dashboard(actorFrom(request));
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/exports/operational", async (request, reply) => {
    try {
      const csv = await studyService.exportOperational(actorFrom(request));
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header(
        "content-disposition",
        `attachment; filename="consultas_estudio_${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return reply.send(csv);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });
}
