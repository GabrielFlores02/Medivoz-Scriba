import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  profiles,
  specialities,
  userSpecialities,
} from "../../db/schema/auth.js";
import { anamnesisTemplates, consultations, patients } from "../../db/schema/clinical.js";

const buildConsultationCode = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MED-${Date.now().toString(36).toUpperCase()}-${random}`.slice(0, 40);
};

const normalizeQueryText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const buildPatientCode = () => {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `PAC-${random}`.slice(0, 40);
};

export class ClinicalService {
  async listPatients(doctorId: string, query?: unknown) {
    const trimmedQuery = normalizeQueryText(query);
    const conditions = [eq(patients.doctorId, doctorId)];

    if (trimmedQuery) {
      conditions.push(
        or(
          ilike(patients.nombre, `%${trimmedQuery}%`),
          ilike(patients.dni, `%${trimmedQuery}%`),
          ilike(patients.codigoPaciente, `%${trimmedQuery}%`)
        )!
      );
    }

    return await db.query.patients.findMany({
      where: and(...conditions),
      orderBy: [desc(patients.createdAt)],
    });
  }

  async getPatientById(id: string, doctorId: string) {
    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, id), eq(patients.doctorId, doctorId)),
    });

    if (!patient) throw new Error("Paciente no encontrado");
    return patient;
  }

  async createPatient(doctorId: string, data: any) {
    const dni = normalizeQueryText(data.dni) || null;
    const codigoPaciente = normalizeQueryText(data.codigoPaciente) || buildPatientCode();

    const [newPatient] = await db
      .insert(patients)
      .values({
        doctorId,
        codigoPaciente,
        nombre: data.nombre,
        dni,
        edad: data.edad ?? null,
        ocupacion: null,
        procedencia: null,
        diagnostico: null,
      })
      .returning();

    return newPatient;
  }

  async updatePatient(id: string, doctorId: string, data: any) {
    const updateValues: any = {
      updatedAt: new Date(),
    };

    if (data.nombre !== undefined) updateValues.nombre = data.nombre;
    if (data.dni !== undefined) {
      updateValues.dni = normalizeQueryText(data.dni) || null;
    }
    if (data.codigoPaciente !== undefined) {
      updateValues.codigoPaciente = normalizeQueryText(data.codigoPaciente) || buildPatientCode();
    }
    if (data.edad !== undefined) updateValues.edad = data.edad;

    const [updated] = await db
      .update(patients)
      .set(updateValues)
      .where(and(eq(patients.id, id), eq(patients.doctorId, doctorId)))
      .returning();

    if (!updated) throw new Error("Paciente no encontrado o no autorizado");
    return updated;
  }

  async deletePatient(id: string, doctorId: string) {
    const [deleted] = await db
      .delete(patients)
      .where(and(eq(patients.id, id), eq(patients.doctorId, doctorId)))
      .returning();

    if (!deleted) throw new Error("Paciente no encontrado o no autorizado");
    return deleted;
  }

  async listConsultations(doctorId: string, pacienteId?: unknown) {
    const conditions = [eq(consultations.doctorId, doctorId)];
    const safePacienteId = normalizeQueryText(pacienteId);
    if (safePacienteId) conditions.push(eq(consultations.pacienteId, safePacienteId));

    return await db.query.consultations.findMany({
      where: and(...conditions),
      orderBy: [desc(consultations.fecha)],
    });
  }

  async getConsultationById(id: string, doctorId: string) {
    const consultation = await db.query.consultations.findFirst({
      where: and(eq(consultations.id, id), eq(consultations.doctorId, doctorId)),
    });

    if (!consultation) throw new Error("Consulta no encontrada");
    return consultation;
  }

  async createConsultation(doctorId: string, data: any) {
    await this.getPatientById(data.pacienteId, doctorId);
    const especialidadId = await this.resolveConsultationSpecialityId(
      doctorId,
      data.especialidadId
    );
    const plantillaAnamnesisId =
      data.plantillaAnamnesisId ??
      (await this.getDefaultAnamnesisTemplateId(especialidadId));

    const [newConsultation] = await db
      .insert(consultations)
      .values({
        doctorId,
        pacienteId: data.pacienteId,
        especialidadId,
        plantillaAnamnesisId,
        codigoSesion: buildConsultationCode(),
        tipoConsulta: data.tipoConsulta ?? "primera_consulta",
        estado: data.estado ?? "en_espera",
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
      })
      .returning();

    return {
      ...newConsultation,
      codigoSesion: newConsultation.codigoSesion,
    };
  }

  async updateConsultation(id: string, doctorId: string, data: any) {
    const updateValues: any = {
      updatedAt: new Date(),
    };

    if (data.estado !== undefined) updateValues.estado = data.estado;
    if (data.plantillaAnamnesisId !== undefined) {
      updateValues.plantillaAnamnesisId = data.plantillaAnamnesisId || null;
    }
    if (data.tipoConsulta !== undefined) updateValues.tipoConsulta = data.tipoConsulta;
    if (data.fecha !== undefined) updateValues.fecha = data.fecha ? new Date(data.fecha) : null;
    if (data.inicioReal !== undefined) {
      updateValues.inicioReal = data.inicioReal ? new Date(data.inicioReal) : null;
    }
    if (data.finReal !== undefined) {
      updateValues.finReal = data.finReal ? new Date(data.finReal) : null;
    }
    if (data.transcripcionCompleta !== undefined) {
      updateValues.transcripcion = data.transcripcionCompleta;
    }

    const [updated] = await db
      .update(consultations)
      .set(updateValues)
      .where(and(eq(consultations.id, id), eq(consultations.doctorId, doctorId)))
      .returning();

    if (!updated) throw new Error("Consulta no encontrada o no autorizada");

    if (data.estado === "finalizada") {
      await db
        .update(patients)
        .set({ ultimaVisita: new Date() })
        .where(eq(patients.id, updated.pacienteId));
    }

    return updated;
  }

  async resolveConsultationSpecialityId(
    doctorId: string,
    requestedSpecialityId?: number | null
  ) {
    if (requestedSpecialityId) {
      const assigned = await db
        .select({ id: userSpecialities.especialidadId })
        .from(userSpecialities)
        .innerJoin(
          specialities,
          eq(userSpecialities.especialidadId, specialities.id)
        )
        .where(
          and(
            eq(userSpecialities.userId, doctorId),
            eq(userSpecialities.especialidadId, requestedSpecialityId),
            eq(specialities.activa, true),
            eq(specialities.esAdministrativa, false)
          )
        )
        .limit(1);

      if (!assigned[0]) {
        throw new Error("La especialidad seleccionada no pertenece al perfil del médico");
      }
      return requestedSpecialityId;
    }

    const primary = await db
      .select({ id: userSpecialities.especialidadId })
      .from(userSpecialities)
      .innerJoin(
        specialities,
        eq(userSpecialities.especialidadId, specialities.id)
      )
      .where(
        and(
          eq(userSpecialities.userId, doctorId),
          eq(userSpecialities.esPrincipal, true),
          eq(specialities.activa, true),
          eq(specialities.esAdministrativa, false)
        )
      )
      .limit(1);

    if (primary[0]) return primary[0].id;

    const profile = await db.query.profiles.findFirst({
      columns: { especialidadId: true },
      where: eq(profiles.userId, doctorId),
    });
    return profile?.especialidadId ?? null;
  }

  async getDefaultAnamnesisTemplateId(especialidadId: number | null) {
    if (!especialidadId) return null;

    const template = await db.query.anamnesisTemplates.findFirst({
      columns: { id: true },
      where: and(
        eq(anamnesisTemplates.especialidadId, especialidadId),
        eq(anamnesisTemplates.esActiva, true)
      ),
      orderBy: [desc(anamnesisTemplates.numeroVersion)],
    });

    return template?.id ?? null;
  }
}

export const clinicalService = new ClinicalService();
