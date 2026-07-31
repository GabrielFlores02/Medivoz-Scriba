import { FastifyInstance } from "fastify";
import { clinicalService } from "./clinical.service.js";
import { 
  createPatientSchema, 
  updatePatientSchema, 
  createConsultationSchema, 
  updateConsultationSchema 
} from "./clinical.schema.js";
import { convertSchema } from "../../core/utils/schema.js";

export async function clinicalRoutes(app: FastifyInstance) {
  // All routes in this module require authentication
  app.addHook("onRequest", app.authenticate);
  app.addHook("preHandler", async (request, reply) => {
    if (String((request.user as any).rol) === "evaluador") {
      return reply.code(403).send({
        error: "El rol Evaluador no accede a pacientes, consultas ni datos clínicos identificables",
      });
    }
  });

  // --- Patients ---

  app.get("/patients", async (request) => {
    const actorId = (request.user as any).sub;
    const canViewAll = String((request.user as any).rol) === "administrador";
    const { search } = request.query as any;
    return await clinicalService.listPatients(actorId, search, canViewAll);
  });

  app.get("/patients/:id", async (request, reply) => {
    const actorId = (request.user as any).sub;
    const canViewAll = String((request.user as any).rol) === "administrador";
    const { id } = request.params as any;
    try {
      return await clinicalService.getPatientById(id, actorId, canViewAll);
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  app.post("/patients", {
    schema: { body: convertSchema(createPatientSchema) }
  }, async (request, reply) => {
    const doctorId = (request.user as any).sub;
    try {
      const patient = await clinicalService.createPatient(doctorId, request.body);
      return reply.code(201).send(patient);
    } catch (error: any) {
      const message = error?.message || "Error al crear paciente";
      const duplicateDni =
        message.includes("uq_pacientes_doctor_dni") ||
        message.toLowerCase().includes("duplicate key");
      return reply.code(duplicateDni ? 400 : 500).send({
        error: duplicateDni
          ? "Ya existe un paciente con ese DNI para este doctor"
          : message,
      });
    }
  });

  app.patch("/patients/:id", {
    schema: { body: convertSchema(updatePatientSchema) }
  }, async (request, reply) => {
    const doctorId = (request.user as any).sub;
    const { id } = request.params as any;
    try {
      return await clinicalService.updatePatient(id, doctorId, request.body);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.delete("/patients/:id", async (request, reply) => {
    const doctorId = (request.user as any).sub;
    const { id } = request.params as any;
    try {
      await clinicalService.deletePatient(id, doctorId);
      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // --- Consultations ---

  app.get("/consultations", async (request) => {
    const actorId = (request.user as any).sub;
    const canViewAll = String((request.user as any).rol) === "administrador";
    const { pacienteId } = request.query as any;
    return await clinicalService.listConsultations(actorId, pacienteId, canViewAll);
  });

  app.get("/consultations/:id", async (request, reply) => {
    const actorId = (request.user as any).sub;
    const canViewAll = String((request.user as any).rol) === "administrador";
    const { id } = request.params as any;
    try {
      return await clinicalService.getConsultationById(id, actorId, canViewAll);
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  app.post("/consultations", {
    schema: { body: convertSchema(createConsultationSchema) }
  }, async (request, reply) => {
    const doctorId = (request.user as any).sub;
    try {
      const consultation = await clinicalService.createConsultation(doctorId, request.body);
      return reply.code(201).send(consultation);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.patch("/consultations/:id", {
    schema: { body: convertSchema(updateConsultationSchema) }
  }, async (request, reply) => {
    const doctorId = (request.user as any).sub;
    const { id } = request.params as any;
    try {
      return await clinicalService.updateConsultation(id, doctorId, request.body);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });
}
