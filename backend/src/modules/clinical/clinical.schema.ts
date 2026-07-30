import { z } from "zod";

export const createPatientSchema = z.object({
  nombre: z.string().min(1),
  dni: z.string().regex(/^\d{8}$/),
  codigoPaciente: z.string().optional(),
  edad: z.number().int().nonnegative(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const createConsultationSchema = z.object({
  pacienteId: z.string().uuid(),
  especialidadId: z.number().int().min(1).nullable().optional(),
  plantillaAnamnesisId: z.string().uuid().nullable().optional(),
  tipoConsulta: z.enum(["primera_consulta", "control", "seguimiento", "interconsulta", "emergencia"]).optional(),
  estado: z.enum(["en_espera", "en_curso", "pausada", "finalizada", "cancelada"]).optional(),
  fecha: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateConsultationSchema = z.object({
  plantillaAnamnesisId: z.string().uuid().nullable().optional(),
  tipoConsulta: z.enum(["primera_consulta", "control", "seguimiento", "interconsulta", "emergencia"]).optional(),
  estado: z.enum(["en_espera", "en_curso", "pausada", "finalizada", "cancelada"]).optional(),
  fecha: z.string().optional(),
  inicioReal: z.string().optional(),
  finReal: z.string().optional(),
  transcripcionCompleta: z.string().optional(),
});
