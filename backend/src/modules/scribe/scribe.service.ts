import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { anamnesisTemplateSections, consultations } from "../../db/schema/clinical.js";
import {
  medicalRecords,
  medicalRecordChanges,
  medicalRecordSectionEvidence,
  medicalRecordSections,
  medicalRecordVersions,
} from "../../db/schema/scribe.js";
import { logger } from "../../core/utils/logger.js";

const normalizedEditDistance = (a?: string | null, b?: string | null) => {
  const left = (a || "").trim();
  const right = (b || "").trim();
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return "0";

  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 1; i <= left.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = curr[j];
  }

  return (prev[right.length] / maxLen).toFixed(4);
};

const sectionOrder = [
  "motivo_consulta",
  "tiempo_enfermedad",
  "forma_inicio",
  "curso_enfermedad",
  "historia_cronologica",
  "antecedentes",
  "sintomas_principales",
  "estado_funcional_basal",
  "estudios_previos",
  "notas_adicionales",
];

const compactSummaryParts = (parts: Array<string | null | undefined>) =>
  parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export class ScribeService {
  async getOrCreateRecord(consultaId: string, _data?: { pacienteId?: string; doctorId?: string }) {
    logger.info("[scribe] record:get-or-create:start", { consultaId });
    let [record] = await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.consultaId, consultaId))
      .limit(1);

    if (!record) {
      logger.info("[scribe] record:create:start", { consultaId });
      const consultation = await db.query.consultations.findFirst({
        columns: { plantillaAnamnesisId: true },
        where: eq(consultations.id, consultaId),
      });

      [record] = await db
        .insert(medicalRecords)
        .values({
          consultaId,
          plantillaAnamnesisId: consultation?.plantillaAnamnesisId ?? null,
          estado: "vacia",
        })
        .returning();
      logger.info("[scribe] record:create:done", {
        consultaId,
        fichaId: record.id,
        plantillaAnamnesisId: record.plantillaAnamnesisId,
      });
    } else {
      logger.info("[scribe] record:found", {
        consultaId,
        fichaId: record.id,
        estado: record.estado,
      });
    }

    return record;
  }

  async updateRecordSummary(
    fichaId: string,
    options: {
      resumenSugeridoIa?: string | null;
      resumenActual?: string | null;
      origen?: "ia" | "doctor" | "manual" | "sistema";
    }
  ) {
    const now = new Date();
    const values: Partial<typeof medicalRecords.$inferInsert> = {
      updatedAt: now,
    };

    if (options.resumenSugeridoIa !== undefined) {
      values.resumenSugeridoIa = options.resumenSugeridoIa;
    }
    if (options.resumenActual !== undefined) {
      values.resumenActual = options.resumenActual;
    }

    const [updated] = await db
      .update(medicalRecords)
      .set(values)
      .where(eq(medicalRecords.id, fichaId))
      .returning();

    logger.info("[scribe] record-summary:update", {
      fichaId,
      origin: options.origen || "sistema",
      hasSuggestedSummary: Boolean(updated?.resumenSugeridoIa?.trim()),
      hasCurrentSummary: Boolean(updated?.resumenActual?.trim()),
    });

    return updated;
  }

  async createRecordVersion(
    fichaId: string,
    options: {
      origen: "ia" | "doctor" | "manual" | "sistema";
      userId?: string | null;
      ejecucionAgenteId?: string | null;
      resumenCambios?: string | null;
    }
  ) {
    const [record] = await db.select().from(medicalRecords).where(eq(medicalRecords.id, fichaId)).limit(1);
    if (!record) return null;

    const sections = await db
      .select()
      .from(medicalRecordSections)
      .where(eq(medicalRecordSections.fichaId, fichaId));

    const [{ nextVersion }] = await db
      .select({
        nextVersion: sql<number>`coalesce(max(${medicalRecordVersions.version}), 0) + 1`,
      })
      .from(medicalRecordVersions)
      .where(eq(medicalRecordVersions.fichaId, fichaId));

    const snapshot = {
      ficha: {
        id: record.id,
        consultaId: record.consultaId,
        estado: record.estado,
        resumenSugeridoIa: record.resumenSugeridoIa,
        resumenActual: record.resumenActual,
        estaFinalizada: record.estaFinalizada,
      },
      secciones: sections.map((section) => ({
        id: section.id,
        nombre: section.nombre,
        textoSugeridoIa: section.textoSugeridoIa,
        textoActual: section.textoActual,
        resumenSugeridoIa: section.resumenSugeridoIa,
        resumenActual: section.resumenActual,
        estado: section.estado,
        confianza: section.confianza,
        origenDato: section.origenDato,
        origenActualizacion: section.origenActualizacion,
        revisadaEn: section.revisadaEn,
      })),
    };

    const [version] = await db
      .insert(medicalRecordVersions)
      .values({
        fichaId,
        version: Number(nextVersion || 1),
        origen: options.origen,
        ejecucionAgenteId: options.ejecucionAgenteId ?? null,
        creadoPor: options.userId ?? null,
        contenidoSnapshot: snapshot,
        resumenCambios: options.resumenCambios ?? null,
      })
      .returning();

    logger.info("[scribe] record-version:created", {
      fichaId,
      version: version.version,
      origin: options.origen,
      sectionCount: sections.length,
      summaryChars: options.resumenCambios?.length || 0,
    });

    return version;
  }

  async refreshSuggestedRecordSummary(fichaId: string) {
    const sections = await db
      .select({
        nombre: medicalRecordSections.nombre,
        resumenSugeridoIa: medicalRecordSections.resumenSugeridoIa,
        resumenActual: medicalRecordSections.resumenActual,
        textoSugeridoIa: medicalRecordSections.textoSugeridoIa,
      })
      .from(medicalRecordSections)
      .where(eq(medicalRecordSections.fichaId, fichaId));

    const byName = new Map(sections.map((section) => [String(section.nombre), section]));
    const summary = compactSummaryParts(
      sectionOrder.map((name) => {
        const section = byName.get(name);
        return section?.resumenSugeridoIa || section?.resumenActual || section?.textoSugeridoIa;
      })
    );

    if (!summary) return null;
    return this.updateRecordSummary(fichaId, {
      resumenSugeridoIa: summary,
      origen: "ia",
    });
  }

  async getRecordByConsultationForDoctor(consultaId: string, doctorId: string) {
    const consultation = await db.query.consultations.findFirst({
      where: and(eq(consultations.id, consultaId), eq(consultations.doctorId, doctorId)),
    });

    if (!consultation) {
      logger.warn("[scribe] record:get:not-authorized", { consultaId, doctorId });
      return null;
    }
    return this.getRecordContent(consultaId);
  }

  async updateSection(
    fichaId: string,
    nombre: any,
    contenido: string,
    origen: any = "doctor",
    userId?: string,
    options?: {
      textoSugeridoIa?: string | null;
      resumenSugeridoIa?: string | null;
      resumenActual?: string | null;
      duracionEdicionMs?: number | null;
      confianza?: string | null;
      origenDato?: string | null;
    }
  ) {
    const [existing] = await db
      .select()
      .from(medicalRecordSections)
      .where(
        and(
          eq(medicalRecordSections.fichaId, fichaId),
          eq(medicalRecordSections.nombre, nombre)
        )
      )
      .limit(1);

    const textoSugeridoIa = options?.textoSugeridoIa ?? existing?.textoSugeridoIa ?? null;
    const resumenSugeridoIa = options?.resumenSugeridoIa ?? existing?.resumenSugeridoIa ?? null;
    const resumenActual = options?.resumenActual ?? existing?.resumenActual ?? null;
    const origenDato = options?.origenDato ?? existing?.origenDato ?? null;
    const distanciaEdicion =
      origen === "doctor" || origen === "manual"
        ? normalizedEditDistance(textoSugeridoIa, contenido)
        : null;
    const now = new Date();
    logger.info("[scribe] section:update:start", {
      fichaId,
      section: nombre,
      exists: Boolean(existing),
      origen,
      hasContent: Boolean(contenido?.trim()),
      hasSummary: Boolean(resumenActual?.trim()),
      hasIaSuggestion: Boolean(textoSugeridoIa?.trim()),
      duracionEdicionMs: options?.duracionEdicionMs ?? null,
    });

    if (existing) {
      const [updated] = await db
        .update(medicalRecordSections)
        .set({
          textoActual: contenido,
          textoSugeridoIa,
          resumenSugeridoIa,
          resumenActual,
          updatedAt: now,
          origenActualizacion: origen,
          usuarioId: userId,
          revisadaPor: userId,
          revisadaEn: now,
          estado: "revisada",
          confianza: options?.confianza ?? existing.confianza,
          origenDato,
        })
        .where(eq(medicalRecordSections.id, existing.id))
        .returning();

      await db.insert(medicalRecordChanges).values({
        seccionId: existing.id,
        origen,
        autorId: userId,
        contenidoAnterior: existing.textoActual,
        contenidoNuevo: contenido,
        textoSugeridoIa,
        resumenAnterior: existing.resumenActual,
        resumenNuevo: resumenActual,
        resumenSugeridoIa,
        origenDato,
        distanciaEdicion,
        duracionEdicionMs: options?.duracionEdicionMs ?? null,
        confianza: options?.confianza ?? existing.confianza,
      });

      logger.info("[scribe] section:update:done", {
        fichaId,
        sectionId: updated.id,
        section: nombre,
        estado: updated.estado,
        distanciaEdicion,
        confidence: options?.confianza ?? existing.confianza,
      });
      return [updated];
    }

    const [created] = await db
      .insert(medicalRecordSections)
      .values({
        fichaId,
        nombre,
        textoSugeridoIa,
        textoActual: contenido,
        resumenSugeridoIa,
        resumenActual,
        origenActualizacion: origen,
        usuarioId: userId,
        revisadaPor: userId,
        revisadaEn: now,
        estado: "revisada",
        confianza: options?.confianza ?? null,
        origenDato,
      })
      .returning();

    await db.insert(medicalRecordChanges).values({
      seccionId: created.id,
      origen,
      autorId: userId,
      contenidoAnterior: null,
      contenidoNuevo: contenido,
      textoSugeridoIa,
      resumenAnterior: null,
      resumenNuevo: resumenActual,
      resumenSugeridoIa,
      origenDato,
      distanciaEdicion,
      duracionEdicionMs: options?.duracionEdicionMs ?? null,
      confianza: options?.confianza ?? null,
    });

    logger.info("[scribe] section:create:done", {
      fichaId,
      sectionId: created.id,
      section: nombre,
      estado: created.estado,
      distanciaEdicion,
    });
    return [created];
  }

  async suggestSectionFromIa(
    fichaId: string,
    nombre: any,
    sugerencia: string,
    options?: {
      ejecucionAgenteId?: string | null;
      ultimaEjecucionAgenteId?: string | null;
      confianza?: string | null;
      resumenSugeridoIa?: string | null;
      origenDato?: string | null;
      evidencias?: Array<{ segmentoTranscripcionId?: string | null; textoEvidencia: string; confianza?: string | null }>;
    }
  ) {
    const [existing] = await db
      .select()
      .from(medicalRecordSections)
      .where(
        and(
          eq(medicalRecordSections.fichaId, fichaId),
          eq(medicalRecordSections.nombre, nombre)
        )
      )
      .limit(1);

    if (existing?.estado === "bloqueada" || existing?.estado === "revisada") {
      logger.info("[scribe] ia-suggestion:skip-locked-or-reviewed", {
        fichaId,
        section: nombre,
        sectionId: existing.id,
        estado: existing.estado,
      });
      return existing;
    }

    const values = {
      fichaId,
      nombre,
      textoSugeridoIa: sugerencia,
      resumenSugeridoIa: options?.resumenSugeridoIa ?? existing?.resumenSugeridoIa ?? null,
      origenDato: options?.origenDato ?? existing?.origenDato ?? null,
      estado: "borrador_ia" as const,
      origenActualizacion: "ia" as const,
      ultimaEjecucionAgenteId: options?.ejecucionAgenteId ?? options?.ultimaEjecucionAgenteId ?? null,
      confianza: options?.confianza ?? existing?.confianza ?? null,
      updatedAt: new Date(),
    };

    const [section] = existing
      ? await db
          .update(medicalRecordSections)
          .set(values)
          .where(eq(medicalRecordSections.id, existing.id))
          .returning()
      : await db.insert(medicalRecordSections).values(values).returning();

    logger.info("[scribe] ia-suggestion:stored", {
      fichaId,
      sectionId: section.id,
      section: nombre,
      created: !existing,
      confidence: options?.confianza ?? existing?.confianza ?? null,
      hasSummary: Boolean(options?.resumenSugeridoIa?.trim()),
      executionId: options?.ejecucionAgenteId ?? options?.ultimaEjecucionAgenteId ?? null,
    });

    if (options?.evidencias?.length) {
      const evidenceRows = options.evidencias
        .filter((item) => item.textoEvidencia?.trim())
        .map((item) => ({
          seccionId: section.id,
          segmentoTranscripcionId: item.segmentoTranscripcionId ?? null,
          textoEvidencia: item.textoEvidencia.trim(),
          confianza: item.confianza ?? null,
          origenDato: options.origenDato ?? null,
        }));
      if (evidenceRows.length) {
        await db.insert(medicalRecordSectionEvidence).values(evidenceRows);
        logger.info("[scribe] evidence:stored", {
          sectionId: section.id,
          section: nombre,
          count: evidenceRows.length,
        });
      }
    }

    return section;
  }

  async reviewSection(
    consultaId: string,
    doctorId: string,
    nombre: any,
    action: "accept" | "reject" | "block",
    options?: { contenido?: string | null; resumenActual?: string | null }
  ) {
    const consultation = await db.query.consultations.findFirst({
      where: and(eq(consultations.id, consultaId), eq(consultations.doctorId, doctorId)),
    });
    if (!consultation) {
      logger.warn("[scribe] section:review:not-authorized", { consultaId, doctorId, section: nombre, action });
      return null;
    }

    const record = await this.getOrCreateRecord(consultaId);
    logger.info("[scribe] section:review:start", {
      consultaId,
      fichaId: record.id,
      section: nombre,
      action,
      hasContentPayload: Boolean(options?.contenido?.trim()),
      hasSummaryPayload: Boolean(options?.resumenActual?.trim()),
    });
    const [section] = await db
      .select()
      .from(medicalRecordSections)
      .where(and(eq(medicalRecordSections.fichaId, record.id), eq(medicalRecordSections.nombre, nombre)))
      .limit(1);
    if (!section) {
      if (action === "accept" && !options?.contenido?.trim() && !options?.resumenActual?.trim()) {
        logger.warn("[scribe] section:review:empty-rejected", {
          consultaId,
          fichaId: record.id,
          section: nombre,
          action,
        });
        return null;
      }
      if (action !== "accept" && action !== "block") return null;
      const [created] = await this.updateSection(
        record.id,
        nombre,
        options?.contenido || "",
        "doctor",
        doctorId,
        { resumenActual: options?.resumenActual || null }
      );
      logger.info("[scribe] section:review:create-missing", {
        consultaId,
        fichaId: record.id,
        section: nombre,
        action,
        created: Boolean(created),
      });
      if (created) {
        await this.createRecordVersion(record.id, {
          origen: "doctor",
          userId: doctorId,
          resumenCambios: `Doctor creo y valido seccion ${String(nombre)}`,
        });
      }
      return created || null;
    }

    const now = new Date();
    if (action === "accept") {
      const acceptedText = options?.contenido || section.textoSugeridoIa || section.textoActual || "";
      const acceptedSummary = options?.resumenActual || section.resumenSugeridoIa || section.resumenActual || "";
      if (!acceptedText.trim() && !acceptedSummary.trim()) {
        logger.warn("[scribe] section:review:empty-existing-rejected", {
          consultaId,
          fichaId: record.id,
          sectionId: section.id,
          section: nombre,
        });
        return null;
      }
      const [updated] = await db
        .update(medicalRecordSections)
        .set({
          textoActual: acceptedText,
          textoSugeridoIa: null,
          resumenActual: acceptedSummary,
          resumenSugeridoIa: null,
          estado: "revisada",
          origenDato: section.origenDato,
          revisadaPor: doctorId,
          revisadaEn: now,
          origenActualizacion: "doctor",
          usuarioId: doctorId,
          updatedAt: now,
        })
        .where(eq(medicalRecordSections.id, section.id))
        .returning();
      logger.info("[scribe] section:review:accepted", {
        consultaId,
        fichaId: record.id,
        sectionId: updated.id,
        section: nombre,
          hasSummary: Boolean(acceptedSummary.trim()),
          usedPayloadContent: Boolean(options?.contenido?.trim()),
      });
      await db.insert(medicalRecordChanges).values({
        seccionId: section.id,
        origen: "doctor",
        autorId: doctorId,
        contenidoAnterior: section.textoActual,
        contenidoNuevo: acceptedText,
        textoSugeridoIa: section.textoSugeridoIa,
        resumenAnterior: section.resumenActual,
        resumenNuevo: acceptedSummary,
        resumenSugeridoIa: section.resumenSugeridoIa,
        origenDato: section.origenDato,
        distanciaEdicion: normalizedEditDistance(section.textoSugeridoIa, acceptedText),
        confianza: section.confianza,
      });
      await this.createRecordVersion(record.id, {
        origen: "doctor",
        userId: doctorId,
        resumenCambios: `Doctor valido seccion ${String(nombre)}`,
      });
      return updated;
    }

    if (action === "reject") {
      const [updated] = await db
        .update(medicalRecordSections)
        .set({
          textoSugeridoIa: null,
          resumenSugeridoIa: null,
          estado: section.textoActual ? "revisada" : "vacia",
          origenActualizacion: "doctor",
          usuarioId: doctorId,
          updatedAt: now,
        })
        .where(eq(medicalRecordSections.id, section.id))
        .returning();
      logger.info("[scribe] section:review:rejected", {
        consultaId,
        fichaId: record.id,
        sectionId: updated.id,
        section: nombre,
        nextEstado: updated.estado,
      });
      await db.insert(medicalRecordChanges).values({
        seccionId: section.id,
        origen: "doctor",
        autorId: doctorId,
        contenidoAnterior: section.textoActual,
        contenidoNuevo: section.textoActual,
        textoSugeridoIa: section.textoSugeridoIa,
        resumenAnterior: section.resumenActual,
        resumenNuevo: section.resumenActual,
        resumenSugeridoIa: section.resumenSugeridoIa,
        origenDato: section.origenDato,
        distanciaEdicion: section.textoSugeridoIa
          ? normalizedEditDistance(section.textoSugeridoIa, section.textoActual)
          : null,
        confianza: section.confianza,
      });
      await this.createRecordVersion(record.id, {
        origen: "doctor",
        userId: doctorId,
        resumenCambios: `Doctor rechazo sugerencia IA de seccion ${String(nombre)}`,
      });
      return updated;
    }

    const [updated] = await db
      .update(medicalRecordSections)
      .set({
        estado: "bloqueada",
        bloqueadaPor: doctorId,
        bloqueadaEn: now,
        usuarioId: doctorId,
        updatedAt: now,
      })
      .where(eq(medicalRecordSections.id, section.id))
      .returning();
    logger.info("[scribe] section:review:blocked", {
      consultaId,
      fichaId: record.id,
      sectionId: updated.id,
      section: nombre,
    });
    await db.insert(medicalRecordChanges).values({
      seccionId: section.id,
      origen: "doctor",
      autorId: doctorId,
      contenidoAnterior: section.textoActual,
      contenidoNuevo: section.textoActual,
      textoSugeridoIa: section.textoSugeridoIa,
      resumenAnterior: section.resumenActual,
      resumenNuevo: section.resumenActual,
      resumenSugeridoIa: section.resumenSugeridoIa,
      origenDato: section.origenDato,
      distanciaEdicion: null,
      confianza: section.confianza,
    });
    await this.createRecordVersion(record.id, {
      origen: "doctor",
      userId: doctorId,
      resumenCambios: `Doctor bloqueo seccion ${String(nombre)}`,
    });
    return updated;
  }

  async validateRecord(consultaId: string, doctorId: string) {
    const consultation = await db.query.consultations.findFirst({
      where: and(eq(consultations.id, consultaId), eq(consultations.doctorId, doctorId)),
    });
    if (!consultation) {
      logger.warn("[scribe] validation:not-authorized", { consultaId, doctorId });
      return null;
    }

    const record = await this.getOrCreateRecord(consultaId, {
      pacienteId: consultation.pacienteId,
      doctorId,
    });

    const templateSections = consultation.plantillaAnamnesisId
      ? await db
          .select({
            seccion: anamnesisTemplateSections.seccion,
            etiquetaVisible: anamnesisTemplateSections.etiquetaVisible,
            esObligatoria: anamnesisTemplateSections.esObligatoria,
          })
          .from(anamnesisTemplateSections)
          .where(
            and(
              eq(anamnesisTemplateSections.plantillaAnamnesisId, consultation.plantillaAnamnesisId),
              eq(anamnesisTemplateSections.activa, true)
            )
          )
      : [];

    const sections = await db
      .select({
        nombre: medicalRecordSections.nombre,
        textoActual: medicalRecordSections.textoActual,
        textoSugeridoIa: medicalRecordSections.textoSugeridoIa,
        estado: medicalRecordSections.estado,
      })
      .from(medicalRecordSections)
      .where(eq(medicalRecordSections.fichaId, record.id));

    const sectionMap = new Map(sections.map((section) => [String(section.nombre), section]));
    const missingRequired = templateSections
      .filter((item) => item.esObligatoria)
      .filter((item) => {
        const section = sectionMap.get(String(item.seccion));
        return !(section?.textoActual || section?.textoSugeridoIa || "").trim();
      })
      .map((item) => ({
        seccion: item.seccion,
        etiqueta: item.etiquetaVisible,
        mensaje: `Falta completar ${item.etiquetaVisible}`,
      }));

    const pendingReview = sections
      .filter((section) => section.estado === "borrador_ia")
      .map((section) => ({
        seccion: section.nombre,
        mensaje: "Tiene sugerencia IA pendiente de validar",
      }));

    const result = {
      ok: missingRequired.length === 0 && pendingReview.length === 0,
      missingRequired,
      pendingReview,
    };
    logger.info("[scribe] validation:done", {
      consultaId,
      fichaId: record.id,
      ok: result.ok,
      missingRequired: missingRequired.length,
      pendingReview: pendingReview.length,
      templateSections: templateSections.length,
      currentSections: sections.length,
    });
    return result;
  }

  async getRecordContent(consultaId: string) {
    const record = await db.query.medicalRecords.findFirst({
      where: eq(medicalRecords.consultaId, consultaId),
    });

    if (!record) {
      logger.info("[scribe] record-content:not-found", { consultaId });
      return null;
    }

    const sections = await db
      .select()
      .from(medicalRecordSections)
      .where(eq(medicalRecordSections.fichaId, record.id));

    logger.info("[scribe] record-content:loaded", {
      consultaId,
      fichaId: record.id,
      sectionCount: sections.length,
      pendingCount: sections.filter((section) => section.estado === "borrador_ia").length,
      reviewedCount: sections.filter((section) => section.estado === "revisada").length,
      lockedCount: sections.filter((section) => section.estado === "bloqueada").length,
    });

    return {
      ...record,
      sections,
    };
  }
}

export const scribeService = new ScribeService();
