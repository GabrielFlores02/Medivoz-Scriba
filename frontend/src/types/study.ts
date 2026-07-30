export const STUDY_SPECIALTIES = [
  "Hematologia",
  "Neurologia",
  "Psiquiatria",
  "Reumatologia",
  "Endocrinologia",
] as const;

export const INCIDENT_TYPES = [
  ["ruido_ambiental", "Ruido ambiental"],
  ["acompanante_presente", "Acompanante presente"],
  ["acompanante_participa", "Acompanante participa activamente"],
  ["interrupciones", "Interrupciones"],
  ["falla_internet", "Falla de internet"],
  ["falla_audio", "Falla de audio"],
  ["falla_ia", "Falla de transcripcion o IA"],
  ["repeticion_grabacion", "Necesidad de repetir grabacion"],
  ["complejidad_no_esperada", "Complejidad clinica no esperada"],
  ["revision_externa_anticipada", "Revision anticipada de ESSI o examenes"],
  ["problema_administrativo", "Problema administrativo"],
  ["escuchar_audio_para_corregir", "Necesidad de escuchar audio"],
  ["grabacion_fuera_anamnesis", "Grabacion fuera de anamnesis"],
  ["otra", "Otra desviacion"],
] as const;

export type StudyFlow = "habitual" | "asistido";
export type StudyState =
  | "preparacion"
  | "anamnesis"
  | "post_anamnesis"
  | "correccion"
  | "completa"
  | "excluida";

export interface StudyEvent {
  id: string;
  tipoEvento: string;
  ocurridoEn: string;
}

export interface StudyIncident {
  id: string;
  tipo: string;
  severidad: string;
  descripcion: string | null;
  createdAt: string;
}

export interface StudyConsultation {
  id: string;
  consultaId: string;
  codigoEstudio: string;
  flujo: StudyFlow;
  especialidad: string;
  estadoProtocolo: StudyState;
  esPacienteNuevo: boolean;
  complejidad: string;
  acompanantePresente: boolean;
  numeroProblemas: number;
  confirmoNoRevisionExterna: boolean;
  excluida: boolean;
  motivoExclusion: string | null;
  correccionMismoDia: boolean | null;
  createdAt: string;
  paciente: {
    id: string;
    nombre: string;
    codigoPaciente: string;
    edad?: number | null;
  };
  consulta: {
    id: string;
    codigoSesion: string;
    doctorId?: string;
    transcripcion?: string | null;
  };
  textos: {
    anamnesisIndependiente: string | null;
    independienteIniciadaEn: string | null;
    independienteGuardadaEn: string | null;
    borradorDisponible: boolean;
    borradorOcultoDisponibleEn: string | null;
    primeraVisualizacionIaEn: string | null;
    borradorIaCorregido: string | null;
    correccionIniciadaEn: string | null;
    correccionFinalizadaEn: string | null;
  } | null;
  eventos: StudyEvent[];
  incidencias: StudyIncident[];
  completitud: {
    complete: boolean;
    percent: number;
    missing: string[];
    excluded: boolean;
  };
}

export interface StudyListItem {
  id: string;
  consultaId: string;
  codigoEstudio: string;
  flujo: StudyFlow;
  especialidad: string;
  estadoProtocolo: StudyState;
  excluida: boolean;
  createdAt: string;
  paciente: {
    id: string;
    nombre: string;
    codigoPaciente: string;
  };
  consulta: {
    id: string;
    codigoSesion: string;
    doctorId: string;
  };
  borradorDisponible: boolean;
  independienteGuardada: boolean;
  primeraVisualizacionIa: string | null;
}

export interface StudyDashboardData {
  total: number;
  habitual: number;
  asistido: number;
  completas: number;
  pendientesCorreccion: number;
  borradoresBloqueados: number;
  excluidas: number;
  tiempoPromedioMs: number | null;
  progresoEspecialidad: Array<{
    especialidad: string;
    habitual: number;
    asistido: number;
    metaHabitual: number;
    metaAsistida: number;
  }>;
  recientes: StudyListItem[];
}

export interface ClinicalPatient {
  id: string;
  nombre: string;
  codigoPaciente: string;
  dni: string | null;
  edad: number | null;
}
