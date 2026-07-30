import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { consultations, patients } from "../../db/schema/clinical.js";
import { medicalRecords, medicalRecordSections } from "../../db/schema/scribe.js";
import {
  specialtyAnamnesisTemplates,
  specialtyDictionaries,
  specialtyTerms,
  studyAnamnesisTexts,
  studyAuditEvents,
  studyConsultations,
  studyIncidents,
  studyProtocols,
  studySpecialties,
  studyTimingEvents,
} from "../../db/schema/study.js";
import {
  assertEligibility,
  assertStudySpecialty,
  buildCompleteness,
  calculateDurationMs,
  sanitizePlainText,
  STUDY_TIMING_EVENTS,
  type TimingEvent,
} from "./study.policy.js";

type Actor = {
  userId: string;
  role: string;
};

type CreateStudyConsultationInput = {
  consultaId: string;
  flujo: "habitual" | "asistido";
  especialidad: string;
  esPacienteNuevo: boolean;
  complejidad: "baja" | "media" | "alta";
  acompanantePresente?: boolean;
  numeroProblemas?: number;
  confirmoNoRevisionExterna: boolean;
  motivoExclusion?: string | null;
};

const SECTION_ORDER = [
  "motivo_consulta",
  "tiempo_enfermedad",
  "forma_inicio",
  "curso_enfermedad",
  "historia_cronologica",
  "sintomas_principales",
  "antecedentes",
  "estado_funcional_basal",
  "estudios_previos",
  "notas_adicionales",
];

const SECTION_LABELS: Record<string, string> = {
  motivo_consulta: "Motivo de consulta",
  tiempo_enfermedad: "Tiempo de enfermedad",
  forma_inicio: "Forma de inicio",
  curso_enfermedad: "Curso de la enfermedad",
  historia_cronologica: "Enfermedad actual",
  sintomas_principales: "Sintomas principales",
  antecedentes: "Antecedentes relevantes",
  estado_funcional_basal: "Estado funcional basal",
  estudios_previos: "Estudios previos referidos",
  notas_adicionales: "Otros datos subjetivos relevantes",
};

const csvCell = (value: unknown) => {
  const normalized =
    value instanceof Date
      ? value.toISOString()
      : value === null || value === undefined
        ? ""
        : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

export class StudyService {
  private isPrivileged(actor: Actor) {
    return actor.role === "administrador" || actor.role === "coordinador";
  }

  private async getAccessibleStudy(id: string, actor: Actor) {
    const accessCondition = this.isPrivileged(actor)
      ? or(eq(studyConsultations.id, id), eq(studyConsultations.consultaId, id))
      : and(
          or(eq(studyConsultations.id, id), eq(studyConsultations.consultaId, id)),
          eq(consultations.doctorId, actor.userId)
        );

    const rows = await db
      .select({
        study: studyConsultations,
        consultation: consultations,
        patient: patients,
        texts: studyAnamnesisTexts,
      })
      .from(studyConsultations)
      .innerJoin(consultations, eq(consultations.id, studyConsultations.consultaId))
      .innerJoin(patients, eq(patients.id, consultations.pacienteId))
      .leftJoin(
        studyAnamnesisTexts,
        eq(studyAnamnesisTexts.consultaEstudioId, studyConsultations.id)
      )
      .where(accessCondition)
      .limit(1);

    if (!rows[0]) throw new Error("Consulta de estudio no encontrada o no autorizada");
    return rows[0];
  }

  private async audit(
    consultaEstudioId: string | null,
    actor: Actor,
    accion: string,
    metadata: Record<string, unknown> = {}
  ) {
    await db.insert(studyAuditEvents).values({
      consultaEstudioId,
      usuarioId: actor.userId,
      accion,
      metadata,
    });
  }

  async getActiveProtocol() {
    const protocol = await db.query.studyProtocols.findFirst({
      where: eq(studyProtocols.estado, "activo"),
      orderBy: [desc(studyProtocols.createdAt)],
    });
    if (!protocol) throw new Error("No existe un protocolo de estudio activo");
    return protocol;
  }

  async listSpecialties() {
    const protocol = await this.getActiveProtocol();
    return db
      .select()
      .from(studySpecialties)
      .where(
        and(
          eq(studySpecialties.protocoloId, protocol.id),
          eq(studySpecialties.activa, true)
        )
      )
      .orderBy(asc(studySpecialties.nombre));
  }

  async createConsultation(actor: Actor, input: CreateStudyConsultationInput) {
    assertStudySpecialty(input.especialidad);
    const eligible = assertEligibility(input);
    const protocol = await this.getActiveProtocol();

    const consultation = await db.query.consultations.findFirst({
      where: and(
        eq(consultations.id, input.consultaId),
        eq(consultations.doctorId, actor.userId)
      ),
    });
    if (!consultation && !this.isPrivileged(actor)) {
      throw new Error("Consulta clinica no encontrada o no autorizada");
    }
    if (!consultation) {
      throw new Error("La consulta clinica indicada no existe");
    }

    const existing = await db.query.studyConsultations.findFirst({
      where: eq(studyConsultations.consultaId, input.consultaId),
    });
    if (existing) return this.getConsultation(existing.id, actor);

    const year = new Date().getFullYear();
    const code = `MEDV-${year}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const [created] = await db
      .insert(studyConsultations)
      .values({
        consultaId: input.consultaId,
        protocoloId: protocol.id,
        codigoEstudio: code,
        flujo: input.flujo,
        especialidad: input.especialidad,
        estadoProtocolo: eligible ? "preparacion" : "excluida",
        esPacienteNuevo: input.esPacienteNuevo,
        complejidad: input.complejidad,
        acompanantePresente: input.acompanantePresente ?? false,
        numeroProblemas: input.numeroProblemas ?? 1,
        confirmoNoRevisionExterna: input.confirmoNoRevisionExterna,
        excluida: !eligible,
        motivoExclusion: eligible ? null : input.motivoExclusion,
      })
      .returning();

    await db.insert(studyAnamnesisTexts).values({
      consultaEstudioId: created.id,
    });
    await this.audit(created.id, actor, "consulta_estudio_creada", {
      flujo: input.flujo,
      especialidad: input.especialidad,
      elegible: eligible,
    });
    return this.getConsultation(created.id, actor);
  }

  async getConsultation(id: string, actor: Actor) {
    const row = await this.getAccessibleStudy(id, actor);
    const [events, incidents] = await Promise.all([
      db
        .select()
        .from(studyTimingEvents)
        .where(eq(studyTimingEvents.consultaEstudioId, row.study.id))
        .orderBy(asc(studyTimingEvents.ocurridoEn)),
      db
        .select()
        .from(studyIncidents)
        .where(eq(studyIncidents.consultaEstudioId, row.study.id))
        .orderBy(desc(studyIncidents.createdAt)),
    ]);
    const completeness = buildCompleteness({
      flujo: row.study.flujo,
      estado: row.study.estadoProtocolo,
      excluida: row.study.excluida,
      confirmoNoRevisionExterna: row.study.confirmoNoRevisionExterna,
      eventTypes: events.map((event) => event.tipoEvento),
      independentSaved: Boolean(row.texts?.independienteGuardadaEn),
      aiDraftAvailable: Boolean(row.texts?.borradorOcultoDisponibleEn),
      aiFirstViewed: Boolean(row.texts?.primeraVisualizacionIaEn),
      finalSaved: Boolean(row.texts?.borradorIaCorregido?.trim()),
    });

    return {
      ...row.study,
      consulta: row.consultation,
      paciente: row.patient,
      textos: row.texts
        ? {
            anamnesisIndependiente: row.texts.anamnesisIndependiente,
            independienteIniciadaEn: row.texts.independienteIniciadaEn,
            independienteGuardadaEn: row.texts.independienteGuardadaEn,
            borradorDisponible: Boolean(row.texts.borradorOcultoDisponibleEn),
            borradorOcultoDisponibleEn: row.texts.borradorOcultoDisponibleEn,
            primeraVisualizacionIaEn: row.texts.primeraVisualizacionIaEn,
            borradorIaCorregido: row.texts.borradorIaCorregido,
            correccionIniciadaEn: row.texts.correccionIniciadaEn,
            correccionFinalizadaEn: row.texts.correccionFinalizadaEn,
          }
        : null,
      eventos: events,
      incidencias: incidents,
      completitud: completeness,
    };
  }

  async listConsultations(actor: Actor, filters: {
    flujo?: string;
    especialidad?: string;
    estado?: string;
    pendingToday?: boolean;
  } = {}) {
    const conditions = [];
    if (!this.isPrivileged(actor)) conditions.push(eq(consultations.doctorId, actor.userId));
    if (filters.flujo) conditions.push(eq(studyConsultations.flujo, filters.flujo));
    if (filters.especialidad) {
      conditions.push(eq(studyConsultations.especialidad, filters.especialidad));
    }
    if (filters.estado) {
      conditions.push(eq(studyConsultations.estadoProtocolo, filters.estado));
    }

    const rows = await db
      .select({
        study: studyConsultations,
        consultation: consultations,
        patient: patients,
        texts: studyAnamnesisTexts,
      })
      .from(studyConsultations)
      .innerJoin(consultations, eq(consultations.id, studyConsultations.consultaId))
      .innerJoin(patients, eq(patients.id, consultations.pacienteId))
      .leftJoin(
        studyAnamnesisTexts,
        eq(studyAnamnesisTexts.consultaEstudioId, studyConsultations.id)
      )
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(studyConsultations.createdAt));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows
      .filter((row) => {
        if (!filters.pendingToday) return true;
        return (
          row.study.flujo === "asistido" &&
          !row.study.excluida &&
          row.study.estadoProtocolo !== "completa" &&
          row.study.createdAt >= today
        );
      })
      .map((row) => ({
        ...row.study,
        paciente: {
          id: row.patient.id,
          nombre: row.patient.nombre,
          codigoPaciente: row.patient.codigoPaciente,
        },
        consulta: {
          id: row.consultation.id,
          codigoSesion: row.consultation.codigoSesion,
          doctorId: row.consultation.doctorId,
        },
        borradorDisponible: Boolean(row.texts?.borradorOcultoDisponibleEn),
        independienteGuardada: Boolean(row.texts?.independienteGuardadaEn),
        primeraVisualizacionIa: row.texts?.primeraVisualizacionIaEn ?? null,
      }));
  }

  async recordTimingEvent(
    id: string,
    actor: Actor,
    tipoEvento: TimingEvent,
    occurredAt?: string,
    metadata: Record<string, unknown> = {}
  ) {
    if (!STUDY_TIMING_EVENTS.includes(tipoEvento)) {
      throw new Error("Evento de tiempo no permitido");
    }
    const row = await this.getAccessibleStudy(id, actor);
    if (row.study.excluida) throw new Error("La consulta esta excluida");

    if (row.study.flujo === "habitual" && [
      "grabacion_inicio",
      "ia_generacion_inicio",
      "ia_generacion_fin",
      "ia_borrador_oculto_disponible",
      "ia_primera_visualizacion",
      "correccion_inicio",
      "correccion_fin",
    ].includes(tipoEvento)) {
      throw new Error("El flujo habitual no permite audio, transcripcion ni IA");
    }

    const eventDate = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(eventDate.getTime())) throw new Error("Fecha de evento invalida");

    let nextState = row.study.estadoProtocolo;
    if (tipoEvento === "saludo_inicio") nextState = "anamnesis";
    if (tipoEvento === "anamnesis_fin") nextState = "post_anamnesis";
    if (tipoEvento === "correccion_inicio") nextState = "correccion";
    if (tipoEvento === "redaccion_manual_fin") nextState = "completa";

    await db.transaction(async (tx) => {
      await tx.insert(studyTimingEvents).values({
        consultaEstudioId: row.study.id,
        tipoEvento,
        ocurridoEn: eventDate,
        metadata,
      });
      await tx
        .update(studyConsultations)
        .set({ estadoProtocolo: nextState, updatedAt: new Date() })
        .where(eq(studyConsultations.id, row.study.id));

      const textPatch: Record<string, Date> = {};
      if (tipoEvento === "redaccion_independiente_inicio") {
        textPatch.independienteIniciadaEn = eventDate;
      }
      if (tipoEvento === "correccion_inicio") textPatch.correccionIniciadaEn = eventDate;
      if (Object.keys(textPatch).length) {
        await tx
          .update(studyAnamnesisTexts)
          .set({ ...textPatch, updatedAt: new Date() })
          .where(eq(studyAnamnesisTexts.consultaEstudioId, row.study.id));
      }
      await tx.insert(studyAuditEvents).values({
        consultaEstudioId: row.study.id,
        usuarioId: actor.userId,
        accion: tipoEvento,
        metadata: {},
      });
    });
    return this.getConsultation(row.study.id, actor);
  }

  async saveIndependentAnamnesis(id: string, actor: Actor, text: string) {
    const row = await this.getAccessibleStudy(id, actor);
    if (row.study.flujo !== "asistido") {
      throw new Error("La anamnesis independiente solo corresponde al flujo asistido");
    }
    if (row.texts?.primeraVisualizacionIaEn) {
      throw new Error("La anamnesis independiente no puede cambiar despues de visualizar IA");
    }
    const endEvent = await db.query.studyTimingEvents.findFirst({
      where: and(
        eq(studyTimingEvents.consultaEstudioId, row.study.id),
        eq(studyTimingEvents.tipoEvento, "anamnesis_fin")
      ),
    });
    if (!endEvent) {
      throw new Error("Debe detener la grabacion al finalizar la anamnesis");
    }
    const sanitized = sanitizePlainText(text);
    if (sanitized.length < 20) {
      throw new Error("La anamnesis independiente debe contener al menos 20 caracteres");
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(studyAnamnesisTexts)
        .set({
          anamnesisIndependiente: sanitized,
          independienteGuardadaEn: now,
          independienteIniciadaEn: row.texts?.independienteIniciadaEn ?? now,
          updatedAt: now,
        })
        .where(eq(studyAnamnesisTexts.consultaEstudioId, row.study.id));
      await tx.insert(studyTimingEvents).values({
        consultaEstudioId: row.study.id,
        tipoEvento: "redaccion_independiente_guardada",
        ocurridoEn: now,
        metadata: {},
      });
      await tx.insert(studyAuditEvents).values({
        consultaEstudioId: row.study.id,
        usuarioId: actor.userId,
        accion: "anamnesis_independiente_guardada",
        metadata: { caracteres: sanitized.length },
      });
    });
    return { saved: true, savedAt: now };
  }

  async syncHiddenAiDraft(id: string, actor: Actor) {
    const row = await this.getAccessibleStudy(id, actor);
    if (row.study.flujo !== "asistido") {
      throw new Error("El flujo habitual no genera borrador IA");
    }
    if (row.texts?.borradorOcultoDisponibleEn && row.texts.borradorIaSinCorregir) {
      return { available: true, availableAt: row.texts.borradorOcultoDisponibleEn };
    }

    const record = await db.query.medicalRecords.findFirst({
      where: eq(medicalRecords.consultaId, row.study.consultaId),
    });
    if (!record) return { available: false, status: "procesando" };

    const sections = await db
      .select()
      .from(medicalRecordSections)
      .where(eq(medicalRecordSections.fichaId, record.id));
    const content = sections
      .sort(
        (a, b) =>
          SECTION_ORDER.indexOf(a.nombre) - SECTION_ORDER.indexOf(b.nombre)
      )
      .map((section) => {
        const value = String(section.textoSugeridoIa || section.textoActual || "").trim();
        return value ? `${SECTION_LABELS[section.nombre] || section.nombre}:\n${value}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    const draft = sanitizePlainText(content || record.resumenSugeridoIa || "");
    if (!draft) return { available: false, status: "procesando" };

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(studyAnamnesisTexts)
        .set({
          borradorIaSinCorregir: draft,
          borradorOcultoDisponibleEn: now,
          updatedAt: now,
        })
        .where(eq(studyAnamnesisTexts.consultaEstudioId, row.study.id));
      await tx.insert(studyTimingEvents).values({
        consultaEstudioId: row.study.id,
        tipoEvento: "ia_borrador_oculto_disponible",
        ocurridoEn: now,
        metadata: { caracteres: draft.length },
      });
      await tx.insert(studyAuditEvents).values({
        consultaEstudioId: row.study.id,
        usuarioId: actor.userId,
        accion: "borrador_ia_oculto_disponible",
        metadata: { caracteres: draft.length },
      });
    });
    return { available: true, availableAt: now };
  }

  async getAiDraft(id: string, actor: Actor) {
    const row = await this.getAccessibleStudy(id, actor);
    if (row.study.flujo !== "asistido") {
      throw new Error("El flujo habitual no utiliza borrador IA");
    }
    if (!row.texts?.independienteGuardadaEn || !row.texts.anamnesisIndependiente) {
      await this.audit(row.study.id, actor, "intento_acceso_ia_anticipado");
      throw new Error("BORRADOR_IA_BLOQUEADO: guarde primero la anamnesis independiente");
    }
    if (!row.texts.borradorIaSinCorregir) {
      throw new Error("El borrador IA aun se encuentra en procesamiento");
    }

    const now = new Date();
    if (!row.texts.primeraVisualizacionIaEn) {
      await db.transaction(async (tx) => {
        await tx
          .update(studyAnamnesisTexts)
          .set({
            primeraVisualizacionIaEn: now,
            correccionIniciadaEn: row.texts?.correccionIniciadaEn ?? now,
            updatedAt: now,
          })
          .where(eq(studyAnamnesisTexts.consultaEstudioId, row.study.id));
        await tx
          .update(studyConsultations)
          .set({ estadoProtocolo: "correccion", updatedAt: now })
          .where(eq(studyConsultations.id, row.study.id));
        await tx.insert(studyTimingEvents).values([
          {
            consultaEstudioId: row.study.id,
            tipoEvento: "ia_primera_visualizacion",
            ocurridoEn: now,
            metadata: {},
          },
          {
            consultaEstudioId: row.study.id,
            tipoEvento: "correccion_inicio",
            ocurridoEn: now,
            metadata: {},
          },
        ]);
        await tx.insert(studyAuditEvents).values({
          consultaEstudioId: row.study.id,
          usuarioId: actor.userId,
          accion: "ia_primera_visualizacion",
          metadata: {},
        });
      });
    }

    return {
      draft: row.texts.borradorIaSinCorregir,
      firstViewedAt: row.texts.primeraVisualizacionIaEn ?? now,
    };
  }

  async saveFinalAnamnesis(id: string, actor: Actor, text: string) {
    const row = await this.getAccessibleStudy(id, actor);
    if (!row.texts?.primeraVisualizacionIaEn) {
      throw new Error("Debe visualizar el borrador IA antes de guardar la version final");
    }
    const sanitized = sanitizePlainText(text);
    if (sanitized.length < 20) {
      throw new Error("La anamnesis final debe contener al menos 20 caracteres");
    }
    const now = new Date();
    const sameDay =
      row.texts.primeraVisualizacionIaEn.toDateString() === now.toDateString();

    await db.transaction(async (tx) => {
      await tx
        .update(studyAnamnesisTexts)
        .set({
          borradorIaCorregido: sanitized,
          correccionFinalizadaEn: now,
          updatedAt: now,
        })
        .where(eq(studyAnamnesisTexts.consultaEstudioId, row.study.id));
      await tx
        .update(studyConsultations)
        .set({
          estadoProtocolo: "completa",
          correccionMismoDia: sameDay,
          updatedAt: now,
        })
        .where(eq(studyConsultations.id, row.study.id));
      await tx.insert(studyTimingEvents).values({
        consultaEstudioId: row.study.id,
        tipoEvento: "correccion_fin",
        ocurridoEn: now,
        metadata: {},
      });
      await tx.insert(studyAuditEvents).values({
        consultaEstudioId: row.study.id,
        usuarioId: actor.userId,
        accion: "anamnesis_final_guardada",
        metadata: { caracteres: sanitized.length },
      });
    });
    return { saved: true, finalText: sanitized, completedAt: now };
  }

  async addIncident(
    id: string,
    actor: Actor,
    input: { tipo: string; severidad?: string; descripcion?: string }
  ) {
    const row = await this.getAccessibleStudy(id, actor);
    const [incident] = await db
      .insert(studyIncidents)
      .values({
        consultaEstudioId: row.study.id,
        tipo: input.tipo,
        severidad: input.severidad ?? "media",
        descripcion: input.descripcion?.trim() || null,
        registradaPor: actor.userId,
      })
      .returning();

    const patch: Record<string, boolean> = {};
    if (input.tipo === "revision_externa_anticipada") {
      patch.revisoEssiDuranteMedicion = true;
    }
    if (input.tipo === "escuchar_audio_para_corregir") {
      patch.requiereEscucharAudio = true;
    }
    if (Object.keys(patch).length) {
      await db
        .update(studyConsultations)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(studyConsultations.id, row.study.id));
    }
    await this.audit(row.study.id, actor, "incidencia_registrada", {
      tipo: input.tipo,
      severidad: input.severidad ?? "media",
    });
    return incident;
  }

  async registerCopyEvent(id: string, actor: Actor) {
    const row = await this.getAccessibleStudy(id, actor);
    if (!row.texts?.borradorIaCorregido) {
      throw new Error("Solo se puede copiar una anamnesis final guardada");
    }
    await this.audit(row.study.id, actor, "copiar_anamnesis_essi");
    return { registered: true };
  }

  async dashboard(actor: Actor) {
    const [consultationRows, specialties] = await Promise.all([
      this.listConsultations(actor),
      this.listSpecialties(),
    ]);
    const ids = consultationRows.map((row) => row.id);
    const events = ids.length
      ? await db
          .select()
          .from(studyTimingEvents)
          .where(inArray(studyTimingEvents.consultaEstudioId, ids))
      : [];

    const durations = consultationRows
      .map((row) => {
        const own = events.filter((event) => event.consultaEstudioId === row.id);
        if (row.flujo === "habitual") {
          const start = own.find((event) => event.tipoEvento === "saludo_inicio")?.ocurridoEn;
          const end = own.find((event) => event.tipoEvento === "redaccion_manual_fin")?.ocurridoEn;
          return calculateDurationMs(start, end);
        }
        const interview = calculateDurationMs(
          own.find((event) => event.tipoEvento === "grabacion_inicio")?.ocurridoEn,
          own.find((event) => event.tipoEvento === "anamnesis_fin")?.ocurridoEn
        );
        const ai = calculateDurationMs(
          own.find((event) => event.tipoEvento === "ia_generacion_inicio")?.ocurridoEn,
          own.find((event) => event.tipoEvento === "ia_generacion_fin")?.ocurridoEn
        );
        const correction = calculateDurationMs(
          own.find((event) => event.tipoEvento === "correccion_inicio")?.ocurridoEn,
          own.find((event) => event.tipoEvento === "correccion_fin")?.ocurridoEn
        );
        if (interview === null || ai === null || correction === null) return null;
        return interview + ai + correction;
      })
      .filter((value): value is number => value !== null);

    const averageMs = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;
    const specialtyProgress = specialties.map((specialty) => ({
      especialidad: specialty.nombre,
      habitual: consultationRows.filter(
        (row) =>
          row.especialidad === specialty.nombre &&
          row.flujo === "habitual" &&
          !row.excluida
      ).length,
      asistido: consultationRows.filter(
        (row) =>
          row.especialidad === specialty.nombre &&
          row.flujo === "asistido" &&
          !row.excluida
      ).length,
      metaHabitual: specialty.metaHabitual,
      metaAsistida: specialty.metaAsistida,
    }));

    return {
      total: consultationRows.length,
      habitual: consultationRows.filter((row) => row.flujo === "habitual").length,
      asistido: consultationRows.filter((row) => row.flujo === "asistido").length,
      completas: consultationRows.filter((row) => row.estadoProtocolo === "completa").length,
      pendientesCorreccion: consultationRows.filter(
        (row) =>
          row.flujo === "asistido" &&
          !row.excluida &&
          row.estadoProtocolo !== "completa"
      ).length,
      borradoresBloqueados: consultationRows.filter(
        (row) => row.borradorDisponible && !row.independienteGuardada
      ).length,
      excluidas: consultationRows.filter((row) => row.excluida).length,
      tiempoPromedioMs: averageMs,
      progresoEspecialidad: specialtyProgress,
      recientes: consultationRows.slice(0, 8),
    };
  }

  async exportOperational(actor: Actor) {
    const rows = await this.listConsultations(actor);
    const ids = rows.map((row) => row.id);
    const [events, incidents] = ids.length
      ? await Promise.all([
          db
            .select()
            .from(studyTimingEvents)
            .where(inArray(studyTimingEvents.consultaEstudioId, ids)),
          db
            .select()
            .from(studyIncidents)
            .where(inArray(studyIncidents.consultaEstudioId, ids)),
        ])
      : [[], []];
    const headers = [
      "codigo_estudio",
      "codigo_consulta",
      "medico_codificado",
      "especialidad",
      "flujo",
      "estado",
      "paciente_nuevo",
      "complejidad",
      "acompanante",
      "numero_problemas",
      "independiente_guardada",
      "borrador_ia_disponible",
      "primera_visualizacion_ia",
      "correccion_mismo_dia",
      "tiempo_inicial_ms",
      "tiempo_generacion_ia_ms",
      "tiempo_correccion_ms",
      "tiempo_total_activo_ms",
      "intervalo_entrevista_correccion_ms",
      "numero_incidencias",
      "excluida",
      "motivo_exclusion",
      "fecha_creacion",
    ];
    const lines = rows.map((row) => {
      const ownEvents = events.filter((event) => event.consultaEstudioId === row.id);
      const interviewStart = ownEvents.find((event) =>
        row.flujo === "habitual"
          ? event.tipoEvento === "saludo_inicio"
          : event.tipoEvento === "grabacion_inicio"
      )?.ocurridoEn;
      const interviewEnd = ownEvents.find((event) =>
        row.flujo === "habitual"
          ? event.tipoEvento === "redaccion_manual_fin"
          : event.tipoEvento === "anamnesis_fin"
      )?.ocurridoEn;
      const initialMs = calculateDurationMs(interviewStart, interviewEnd);
      const aiMs =
        row.flujo === "asistido"
          ? calculateDurationMs(
              ownEvents.find((event) => event.tipoEvento === "ia_generacion_inicio")?.ocurridoEn,
              ownEvents.find((event) => event.tipoEvento === "ia_generacion_fin")?.ocurridoEn
            )
          : null;
      const correctionStart = ownEvents.find(
        (event) => event.tipoEvento === "correccion_inicio"
      )?.ocurridoEn;
      const correctionEnd = ownEvents.find(
        (event) => event.tipoEvento === "correccion_fin"
      )?.ocurridoEn;
      const correctionMs =
        row.flujo === "asistido"
          ? calculateDurationMs(correctionStart, correctionEnd)
          : null;
      const totalActiveMs =
        initialMs !== null &&
        (row.flujo === "habitual" || (aiMs !== null && correctionMs !== null))
          ? initialMs + (aiMs ?? 0) + (correctionMs ?? 0)
          : null;
      const interviewCorrectionIntervalMs =
        row.flujo === "asistido"
          ? calculateDurationMs(interviewEnd, correctionStart)
          : null;
      const incidentCount = incidents.filter(
        (incident) => incident.consultaEstudioId === row.id
      ).length;
      return [
        row.codigoEstudio,
        row.consulta.codigoSesion,
        `MED-${row.consulta.doctorId.slice(0, 8)}`,
        row.especialidad,
        row.flujo,
        row.estadoProtocolo,
        row.esPacienteNuevo,
        row.complejidad,
        row.acompanantePresente,
        row.numeroProblemas,
        row.independienteGuardada,
        row.borradorDisponible,
        row.primeraVisualizacionIa,
        row.correccionMismoDia,
        initialMs,
        aiMs,
        correctionMs,
        totalActiveMs,
        interviewCorrectionIntervalMs,
        incidentCount,
        row.excluida,
        row.motivoExclusion,
        row.createdAt,
      ]
        .map(csvCell)
        .join(",");
    });
    await this.audit(null, actor, "exporte_operativo_generado", { filas: rows.length });
    return `\uFEFF${headers.map(csvCell).join(",")}\n${lines.join("\n")}`;
  }

  async getSpecialtyKnowledge(specialty: string) {
    assertStudySpecialty(specialty);
    const [dictionary] = await db
      .select()
      .from(specialtyDictionaries)
      .where(eq(specialtyDictionaries.especialidad, specialty))
      .orderBy(desc(specialtyDictionaries.version))
      .limit(1);
    const [template] = await db
      .select()
      .from(specialtyAnamnesisTemplates)
      .where(eq(specialtyAnamnesisTemplates.especialidad, specialty))
      .orderBy(desc(specialtyAnamnesisTemplates.version))
      .limit(1);
    const terms = dictionary
      ? await db
          .select()
          .from(specialtyTerms)
          .where(
            and(
              eq(specialtyTerms.diccionarioId, dictionary.id),
              eq(specialtyTerms.activa, true)
            )
          )
          .orderBy(asc(specialtyTerms.terminoCanonico))
      : [];
    return { dictionary: dictionary ?? null, terms, template: template ?? null };
  }

  async assertAudioAllowed(
    consultaId: string,
    doctorId: string,
    options: { allowFinalUpload?: boolean } = {}
  ) {
    const row = await db
      .select({
        study: studyConsultations,
        transcription: consultations.transcripcion,
      })
      .from(studyConsultations)
      .innerJoin(consultations, eq(consultations.id, studyConsultations.consultaId))
      .where(
        and(
          eq(studyConsultations.consultaId, consultaId),
          eq(consultations.doctorId, doctorId)
        )
      )
      .limit(1);
    const study = row[0]?.study;
    if (!study) return;
    if (study.flujo === "habitual") {
      throw new Error("El flujo habitual no permite audio ni IA");
    }
    const allowedStates = options.allowFinalUpload
      ? ["preparacion", "anamnesis", "post_anamnesis"]
      : ["preparacion", "anamnesis"];
    if (!allowedStates.includes(study.estadoProtocolo)) {
      throw new Error("La grabacion de anamnesis ya fue cerrada");
    }
    if (
      options.allowFinalUpload &&
      study.estadoProtocolo === "post_anamnesis" &&
      row[0]?.transcription?.trim()
    ) {
      throw new Error("El audio final de anamnesis ya fue procesado");
    }
  }

  async assertAiDraftVisibleForScribe(consultaId: string, actor: Actor) {
    const rows = await db
      .select({
        study: studyConsultations,
        texts: studyAnamnesisTexts,
      })
      .from(studyConsultations)
      .leftJoin(
        studyAnamnesisTexts,
        eq(studyAnamnesisTexts.consultaEstudioId, studyConsultations.id)
      )
      .where(eq(studyConsultations.consultaId, consultaId))
      .limit(1);
    const row = rows[0];
    if (!row || row.study.flujo !== "asistido") return;
    if (!row.texts?.independienteGuardadaEn) {
      await this.audit(row.study.id, actor, "intento_acceso_ia_anticipado");
      throw new Error("BORRADOR_IA_BLOQUEADO: guarde primero la anamnesis independiente");
    }
    if (!row.texts.primeraVisualizacionIaEn) {
      await this.audit(row.study.id, actor, "intento_acceso_ia_fuera_flujo");
      throw new Error(
        "BORRADOR_IA_BLOQUEADO: abra el borrador desde el flujo protocolar"
      );
    }
  }
}

export const studyService = new StudyService();
