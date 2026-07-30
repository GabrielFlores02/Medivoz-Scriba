import type { PatientFormValues } from "./PatientDialogTypes";

export const buildPatientPayload = (data: PatientFormValues) => ({
  nombre: data.nombre,
  identificacion: data.dni || undefined,
  edad: data.edad ?? null,
  metadata: {
    ocupacion: data.ocupacion || null,
    procedencia: data.procedencia || null,
    diagnostico: data.diagnostico || null,
  },
});
