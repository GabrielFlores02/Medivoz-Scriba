export const STUDY_SPECIALTIES = [
  "Hematologia",
  "Neurologia",
  "Psiquiatria",
  "Reumatologia",
  "Endocrinologia",
] as const;

export const STUDY_FLOWS = ["habitual", "asistido"] as const;

export const STUDY_TIMING_EVENTS = [
  "saludo_inicio",
  "grabacion_inicio",
  "anamnesis_fin",
  "redaccion_manual_fin",
  "ia_generacion_inicio",
  "ia_generacion_fin",
  "ia_borrador_oculto_disponible",
  "redaccion_independiente_inicio",
  "redaccion_independiente_guardada",
  "ia_primera_visualizacion",
  "correccion_inicio",
  "correccion_fin",
] as const;

export const INCIDENT_TYPES = [
  "ruido_ambiental",
  "acompanante_presente",
  "acompanante_participa",
  "interrupciones",
  "falla_internet",
  "falla_audio",
  "falla_ia",
  "repeticion_grabacion",
  "complejidad_no_esperada",
  "revision_externa_anticipada",
  "problema_administrativo",
  "escuchar_audio_para_corregir",
  "grabacion_fuera_anamnesis",
  "otra",
] as const;

export type StudyFlow = (typeof STUDY_FLOWS)[number];
export type TimingEvent = (typeof STUDY_TIMING_EVENTS)[number];

export function assertStudySpecialty(value: string) {
  if (!STUDY_SPECIALTIES.includes(value as any)) {
    throw new Error("Especialidad fuera del protocolo activo");
  }
}

export function assertEligibility(input: {
  esPacienteNuevo: boolean;
  complejidad: string;
  motivoExclusion?: string | null;
}) {
  const eligible = input.esPacienteNuevo && input.complejidad === "media";
  if (!eligible && !input.motivoExclusion?.trim()) {
    throw new Error("Las consultas no elegibles requieren motivo de exclusion");
  }
  return eligible;
}

export function sanitizePlainText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function calculateDurationMs(start?: Date | null, end?: Date | null) {
  if (!start || !end) return null;
  return Math.max(0, end.getTime() - start.getTime());
}

export function buildCompleteness(input: {
  flujo: string;
  estado: string;
  excluida: boolean;
  confirmoNoRevisionExterna: boolean;
  eventTypes: string[];
  independentSaved: boolean;
  aiDraftAvailable: boolean;
  aiFirstViewed: boolean;
  finalSaved: boolean;
}) {
  if (input.excluida) {
    return { complete: true, percent: 100, missing: [], excluded: true };
  }

  const checks =
    input.flujo === "habitual"
      ? [
          ["Confirmacion de no revision externa", input.confirmoNoRevisionExterna],
          ["Inicio de documentacion", input.eventTypes.includes("saludo_inicio")],
          ["Fin de documentacion manual", input.eventTypes.includes("redaccion_manual_fin")],
          ["Cierre de consulta", input.estado === "completa"],
        ]
      : [
          ["Confirmacion de no revision externa", input.confirmoNoRevisionExterna],
          ["Inicio de atencion", input.eventTypes.includes("saludo_inicio")],
          ["Inicio de grabacion", input.eventTypes.includes("grabacion_inicio")],
          ["Fin de anamnesis", input.eventTypes.includes("anamnesis_fin")],
          ["Anamnesis independiente", input.independentSaved],
          ["Borrador IA oculto generado", input.aiDraftAvailable],
          ["Primera visualizacion IA", input.aiFirstViewed],
          ["Ficha final corregida", input.finalSaved],
          ["Fin de correccion", input.eventTypes.includes("correccion_fin")],
          ["Cierre de consulta", input.estado === "completa"],
        ];

  const missing = checks.filter(([, ok]) => !ok).map(([label]) => String(label));
  const completed = checks.length - missing.length;
  return {
    complete: missing.length === 0,
    percent: Math.round((completed / checks.length) * 100),
    missing,
    excluded: false,
  };
}
