import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, userRoles } from "../../db/schema/auth.js";
import { consultations, patients } from "../../db/schema/clinical.js";
import {
  pdqiAssignments,
  pdqiDocuments,
  pdqiScores,
  studyAnamnesisTexts,
  studyConsultations,
} from "../../db/schema/study.js";

export const PDQI9_CRITERIA = [
  "exactitud", "completitud", "claridad", "utilidad", "organizacion",
  "objetividad", "consistencia", "lenguaje_profesional", "pertinencia",
] as const;

const cleanText = (text: string, name?: string | null, dni?: string | null) => {
  let value = text;
  if (name?.trim()) value = value.replace(new RegExp(name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[PACIENTE]");
  if (dni?.trim()) value = value.replaceAll(dni.trim(), "[DNI]");
  return value
    .replace(/\b\d{8}\b/g, "[DNI]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[CORREO]")
    .replace(/(?:\+?51[\s-]?)?9\d{8}\b/g, "[TELÉFONO]");
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export class EvaluationsService {
  async listEvaluators() {
    return db
      .select({ id: users.id, email: users.email })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(eq(userRoles.rol, "evaluador"))
      .orderBy(asc(users.email));
  }

  async listAssignableConsultations() {
    const rows = await db
      .select({
        id: studyConsultations.id,
        codigoEstudio: studyConsultations.codigoEstudio,
        especialidad: studyConsultations.especialidad,
        flujo: studyConsultations.flujo,
        estado: studyConsultations.estadoProtocolo,
        independiente: studyAnamnesisTexts.anamnesisIndependiente,
        borrador: studyAnamnesisTexts.borradorIaSinCorregir,
        final: studyAnamnesisTexts.borradorIaCorregido,
      })
      .from(studyConsultations)
      .innerJoin(studyAnamnesisTexts, eq(studyAnamnesisTexts.consultaEstudioId, studyConsultations.id))
      .where(and(eq(studyConsultations.excluida, false), eq(studyConsultations.estadoProtocolo, "completa")))
      .orderBy(desc(studyConsultations.createdAt));

    return rows.map((row) => ({
      id: row.id,
      codigoEstudio: row.codigoEstudio,
      especialidad: row.especialidad,
      flujo: row.flujo,
      listo: Boolean(row.independiente?.trim() && row.borrador?.trim() && row.final?.trim()),
    }));
  }

  async createAssignment(adminId: string, consultaEstudioId: string, evaluadorId: string) {
    const evaluator = await db.query.userRoles.findFirst({
      where: and(eq(userRoles.userId, evaluadorId), eq(userRoles.rol, "evaluador")),
    });
    if (!evaluator) throw new Error("El usuario seleccionado no tiene rol Evaluador");

    const row = await db
      .select({
        id: studyConsultations.id,
        patientName: patients.nombre,
        patientDni: patients.dni,
        independiente: studyAnamnesisTexts.anamnesisIndependiente,
        borrador: studyAnamnesisTexts.borradorIaSinCorregir,
        final: studyAnamnesisTexts.borradorIaCorregido,
      })
      .from(studyConsultations)
      .innerJoin(studyAnamnesisTexts, eq(studyAnamnesisTexts.consultaEstudioId, studyConsultations.id))
      .innerJoin(consultations, eq(consultations.id, studyConsultations.consultaId))
      .innerJoin(patients, eq(patients.id, consultations.pacienteId))
      .where(and(eq(studyConsultations.id, consultaEstudioId), eq(studyConsultations.excluida, false)))
      .limit(1);
    if (!row[0]) throw new Error("Consulta de estudio no encontrada o excluida");
    const source = row[0];
    const documents = [
      { origin: "independiente", text: source.independiente },
      { origin: "borrador_ia", text: source.borrador },
      { origin: "final", text: source.final },
    ];
    if (documents.some((document) => !document.text?.trim())) {
      throw new Error("La consulta debe contener los documentos independiente, borrador IA y final antes de asignarla");
    }

    const [assignment] = await db.insert(pdqiAssignments).values({
      consultaEstudioId,
      evaluadorId,
      asignadaPorId: adminId,
    }).returning();

    const blinded = shuffle(documents).map((document, index) => ({
      asignacionId: assignment.id,
      etiquetaCiega: `Documento ${String.fromCharCode(65 + index)}`,
      orden: index + 1,
      textoPseudonimizado: cleanText(document.text!.trim(), source.patientName, source.patientDni),
      origenInterno: document.origin,
    }));
    await db.insert(pdqiDocuments).values(blinded);
    return { id: assignment.id, estado: assignment.estado };
  }

  async listEvaluatorAssignments(evaluadorId: string) {
    const assignments = await db.query.pdqiAssignments.findMany({
      where: eq(pdqiAssignments.evaluadorId, evaluadorId),
      orderBy: [desc(pdqiAssignments.createdAt)],
    });
    return Promise.all(assignments.map(async (assignment) => {
      const docs = await db.query.pdqiDocuments.findMany({
        where: eq(pdqiDocuments.asignacionId, assignment.id),
        orderBy: [asc(pdqiDocuments.orden)],
      });
      const scores = await db.query.pdqiScores.findMany({ where: eq(pdqiScores.asignacionId, assignment.id) });
      return {
        id: assignment.id,
        estado: assignment.estado,
        createdAt: assignment.createdAt,
        completedAt: assignment.completedAt,
        documents: docs.map((document) => ({ id: document.id, label: document.etiquetaCiega, text: document.textoPseudonimizado })),
        completedDocuments: scores.map((score) => score.documentoId),
      };
    }));
  }

  async submitScore(evaluadorId: string, assignmentId: string, documentId: string, scores: Record<string, number>, observations?: string) {
    const assignment = await db.query.pdqiAssignments.findFirst({
      where: and(eq(pdqiAssignments.id, assignmentId), eq(pdqiAssignments.evaluadorId, evaluadorId)),
    });
    if (!assignment) throw new Error("Asignación no encontrada o no autorizada");
    const document = await db.query.pdqiDocuments.findFirst({
      where: and(eq(pdqiDocuments.id, documentId), eq(pdqiDocuments.asignacionId, assignmentId)),
    });
    if (!document) throw new Error("Documento no pertenece a la asignación");
    const total = PDQI9_CRITERIA.reduce((sum, criterion) => sum + scores[criterion], 0);
    await db.insert(pdqiScores).values({
      asignacionId: assignmentId, documentoId: documentId, evaluadorId,
      puntajes: scores, puntajeTotal: total, observaciones: observations?.trim() || null,
    }).onConflictDoUpdate({
      target: [pdqiScores.asignacionId, pdqiScores.documentoId],
      set: { puntajes: scores, puntajeTotal: total, observaciones: observations?.trim() || null, submittedAt: new Date() },
    });
    const count = await db.query.pdqiScores.findMany({ where: eq(pdqiScores.asignacionId, assignmentId) });
    if (count.length === 3) {
      await db.update(pdqiAssignments).set({ estado: "completada", completedAt: new Date() }).where(eq(pdqiAssignments.id, assignmentId));
    } else {
      await db.update(pdqiAssignments).set({ estado: "en_progreso" }).where(eq(pdqiAssignments.id, assignmentId));
    }
    return { total, completed: count.length === 3 };
  }
}

export const evaluationsService = new EvaluationsService();
