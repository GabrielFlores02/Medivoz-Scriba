import api from "@/lib/api";
import type {
  ClinicalPatient,
  StudyConsultation,
  StudyDashboardData,
  StudyFlow,
  StudyListItem,
} from "@/types/study";

export const getStudyDashboard = async () => {
  const response = await api.get<StudyDashboardData>("/study/dashboard");
  return response.data;
};

export const listStudyConsultations = async (pendingToday = false) => {
  const response = await api.get<StudyListItem[]>("/study/consultations", {
    params: pendingToday ? { pendingToday: true } : undefined,
  });
  return response.data;
};

export const getStudyConsultation = async (id: string) => {
  const response = await api.get<StudyConsultation>(`/study/consultations/${id}`);
  return response.data;
};

export const listClinicalPatients = async () => {
  const response = await api.get<ClinicalPatient[]>("/clinical/patients");
  return response.data;
};

export const createStudyConsultation = async (input: {
  pacienteId: string;
  flujo: StudyFlow;
  especialidad: string;
  esPacienteNuevo: boolean;
  complejidad: "baja" | "media" | "alta";
  acompanantePresente: boolean;
  numeroProblemas: number;
  confirmoNoRevisionExterna: true;
  motivoExclusion?: string | null;
}) => {
  const consultationResponse = await api.post("/clinical/consultations", {
    pacienteId: input.pacienteId,
    tipoConsulta: "primera_consulta",
    estado: "en_espera",
    fecha: new Date().toISOString(),
  });

  const response = await api.post<StudyConsultation>("/study/consultations", {
    consultaId: consultationResponse.data.id,
    flujo: input.flujo,
    especialidad: input.especialidad,
    esPacienteNuevo: input.esPacienteNuevo,
    complejidad: input.complejidad,
    acompanantePresente: input.acompanantePresente,
    numeroProblemas: input.numeroProblemas,
    confirmoNoRevisionExterna: input.confirmoNoRevisionExterna,
    motivoExclusion: input.motivoExclusion || null,
  });
  return response.data;
};

export const recordStudyEvent = async (
  id: string,
  tipoEvento: string,
  metadata: Record<string, unknown> = {}
) => {
  const response = await api.post<StudyConsultation>(
    `/study/consultations/${id}/timing-events`,
    { tipoEvento, metadata }
  );
  return response.data;
};

export const saveIndependentAnamnesis = async (id: string, text: string) => {
  const response = await api.post(
    `/study/consultations/${id}/independent-anamnesis`,
    { text }
  );
  return response.data;
};

export const syncHiddenAiDraft = async (id: string) => {
  const response = await api.post<{ available: boolean; status?: string }>(
    `/study/consultations/${id}/ai-draft/sync`
  );
  return response.data;
};

export const revealAiDraft = async (id: string) => {
  const response = await api.get<{ draft: string; firstViewedAt: string }>(
    `/study/consultations/${id}/ai-draft`
  );
  return response.data;
};

export const saveFinalAnamnesis = async (id: string, text: string) => {
  const response = await api.post(
    `/study/consultations/${id}/final-anamnesis`,
    { text }
  );
  return response.data as { saved: true; finalText: string; completedAt: string };
};

export const registerCopyEvent = async (id: string) => {
  await api.post(`/study/consultations/${id}/copy-events`);
};

export const addStudyIncident = async (
  id: string,
  input: { tipo: string; severidad: string; descripcion?: string }
) => {
  const response = await api.post(`/study/consultations/${id}/incidents`, input);
  return response.data;
};

export const transcribeStudyAudio = async (
  consultaId: string,
  blob: Blob
) => {
  const response = await api.post("/scribe/transcribe-audio-binary", blob, {
    headers: {
      "Content-Type": blob.type || "audio/webm",
      "X-Audio-Mime": blob.type || "audio/webm",
      "X-Audio-Filename": "anamnesis.webm",
      "X-Consulta-Id": consultaId,
    },
    timeout: 120_000,
  });
  return response.data as { formattedTranscription: string };
};

export const queueStudyExtraction = async (
  consultaId: string,
  transcription: string
) => {
  await api.post(
    "/scribe/auto-fill",
    { consultaId, transcription },
    { timeout: 120_000 }
  );
};

export const downloadOperationalExport = async () => {
  const response = await api.get("/study/exports/operational", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `consultas_estudio_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};
