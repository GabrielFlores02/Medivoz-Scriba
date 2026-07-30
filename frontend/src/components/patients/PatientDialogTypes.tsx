
import * as z from "zod";

// Define form validation schema
export const patientFormSchema = z.object({
  nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  dni: z.string().trim().regex(/^\d{8}$/, { message: "Ingrese un DNI válido de 8 dígitos" }),
  edad: z.coerce.number().int().min(0, { message: "Ingrese una edad válida" }),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export interface Patient {
  id: string;
  nombre: string;
  dni: string | null;
  codigoPaciente?: string | null;
  edad: number | null;
  ocupacion: string | null;
  procedencia: string | null;
  diagnostico: string | null;
  ultima_visita?: string | null; // Added to fix type compatibility
}

export type PatientDialogMode = 'create' | 'edit';
