import { toast } from "sonner";
import api from "@/lib/api";
import { MedicalRecordFormData, SectionMetaMap } from "./types";
import { logger } from "@/utils/logger";

const EMPTY_FORM: MedicalRecordFormData = {
  motivo_consulta: "",
  tiempo_enfermedad: "",
  forma_inicio: "",
  curso_enfermedad: "",
  historia_cronologica: "",
  antecedentes: "",
  sintomas_principales: "",
  estado_funcional_basal: "",
  estudios_previos: "",
  notas_adicionales: "",
};

const mapSectionsToForm = (
  sections: Array<{
    nombre: string;
    textoActual?: string | null;
    textoSugeridoIa?: string | null;
    resumenActual?: string | null;
    resumenSugeridoIa?: string | null;
    origenDato?: string | null;
  }>
) => {
  const form = { ...EMPTY_FORM };
  for (const section of sections) {
    if (section.nombre in form) {
      (form as any)[section.nombre] = section.textoActual || section.textoSugeridoIa || "";
    }
  }
  return form;
};

const mapSectionsToMeta = (
  sections: Array<{
    nombre: string;
    textoActual?: string | null;
    textoSugeridoIa?: string | null;
    resumenActual?: string | null;
    resumenSugeridoIa?: string | null;
    estado?: "vacia" | "borrador_ia" | "revisada" | "bloqueada";
    confianza?: string | null;
    origenDato?: string | null;
  }>
): SectionMetaMap => {
  const meta: SectionMetaMap = {};
  for (const section of sections) {
    if (section.nombre in EMPTY_FORM) {
      const name = section.nombre as keyof MedicalRecordFormData;
      meta[name] = {
        nombre: name,
        textoActual: section.textoActual ?? null,
        textoSugeridoIa: section.textoSugeridoIa ?? null,
        resumenActual: section.resumenActual ?? null,
        resumenSugeridoIa: section.resumenSugeridoIa ?? null,
        estado: section.estado || "vacia",
        confianza: section.confianza ?? null,
        origenDato: section.origenDato ?? null,
      };
    }
  }
  return meta;
};

export const fetchRecordValidation = async (sessionId: string) => {
  const response = await api.get(`/scribe/record/${sessionId}/validation`);
  return response.data as {
    ok: boolean;
    missingRequired: Array<{ seccion: string; etiqueta: string; mensaje: string }>;
    pendingReview: Array<{ seccion: string; mensaje: string }>;
  };
};

export const checkRecordExists = async (sessionId: string, _patientId: string) => {
  try {
    await api.get(`/scribe/record/${sessionId}`);
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) return false;
    logger.error("Error checking if record exists:", error);
    return false;
  }
};

export const fetchExistingRecord = async (sessionId: string, _patientId: string) => {
  try {
    const response = await api.get(`/scribe/record/${sessionId}`);
    const data = response.data;
    const sections = data?.sections || [];
    const formData = mapSectionsToForm(sections);
    const sectionMeta = mapSectionsToMeta(sections);
    const composedSummary = sections
      .map((section: any) => section.resumenActual || section.resumenSugeridoIa || "")
      .filter((value: string) => value.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const recordSummary = {
      resumenSugeridoIa: data?.resumenSugeridoIa || composedSummary || "",
      resumenActual: data?.resumenActual || data?.resumenSugeridoIa || composedSummary || "",
    };
    toast.info("Ficha medica existente cargada");
    return { formData, sectionMeta, recordSummary };
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    logger.error("Error fetching existing record:", error);
    return null;
  }
};

export const reviewMedicalRecordSection = async (
  sessionId: string,
  section: keyof MedicalRecordFormData,
  action: "accept" | "reject" | "block",
  payload?: { contenido?: string; resumenActual?: string }
) => {
  const response = await api.post(`/scribe/record/${sessionId}/sections/${String(section)}/review`, {
    action,
    ...payload,
  });
  return response.data;
};

export const retryMedicalRecordSection = async (
  sessionId: string,
  section: keyof MedicalRecordFormData
) => {
  const response = await api.post(`/scribe/record/${sessionId}/sections/${String(section)}/retry`);
  return response.data;
};

export const refineMedicalRecordSection = async (
  sessionId: string,
  section: keyof MedicalRecordFormData,
  action: "resumir" | "expandir" | "corregir_estilo" | "extraer_negativos" | "formato_institucional" = "corregir_estilo"
) => {
  const response = await api.post(`/scribe/record/${sessionId}/sections/${String(section)}/refine`, {
    action,
  });
  return response.data as { suggestion: string; action: string };
};
