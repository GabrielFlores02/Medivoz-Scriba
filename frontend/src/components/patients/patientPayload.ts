import type { PatientFormValues } from "./PatientDialogTypes";

export const buildPatientPayload = (data: PatientFormValues) => ({
  nombre: data.nombre,
  dni: data.dni,
  edad: data.edad,
});
