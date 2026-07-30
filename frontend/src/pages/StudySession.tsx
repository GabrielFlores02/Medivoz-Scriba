import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  Loader2,
  LockKeyhole,
  Mic,
  PauseCircle,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
  Square,
  Timer,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addStudyIncident,
  createStudyConsultation,
  getStudyConsultation,
  listClinicalPatients,
  queueStudyExtraction,
  recordStudyEvent,
  revealAiDraft,
  saveFinalAnamnesis,
  saveIndependentAnamnesis,
  syncHiddenAiDraft,
  transcribeStudyAudio,
} from "@/lib/study-api";
import {
  INCIDENT_TYPES,
  STUDY_SPECIALTIES,
  type StudyConsultation,
  type StudyFlow,
} from "@/types/study";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const stateLabels: Record<string, string> = {
  preparacion: "Preparacion",
  anamnesis: "En anamnesis",
  post_anamnesis: "Borrador oculto",
  correccion: "En correccion",
  completa: "Lista para ESSI",
  excluida: "Excluida",
};

const formatElapsed = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null) return fallback;
  const candidate = error as {
    message?: unknown;
    response?: { data?: { error?: unknown } };
  };
  const apiMessage = candidate.response?.data?.error;
  if (typeof apiMessage === "string" && apiMessage.trim()) return apiMessage;
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }
  return fallback;
};

function useElapsed(startAt?: string | null, stopped = false) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startAt) {
      setElapsed(0);
      return;
    }
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - +new Date(startAt)) / 1000)));
    update();
    if (stopped) return;
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [startAt, stopped]);
  return elapsed;
}

function SetupConsultation() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState("");
  const [flow, setFlow] = useState<StudyFlow>("asistido");
  const [specialty, setSpecialty] = useState<(typeof STUDY_SPECIALTIES)[number]>("Neurologia");
  const [newPatient, setNewPatient] = useState(true);
  const [complexity, setComplexity] = useState<"baja" | "media" | "alta">("media");
  const [companion, setCompanion] = useState(false);
  const [problemCount, setProblemCount] = useState(1);
  const [noExternalReview, setNoExternalReview] = useState(false);
  const [exclusionReason, setExclusionReason] = useState("");

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["clinical-patients-study"],
    queryFn: listClinicalPatients,
  });

  const createMutation = useMutation({
    mutationFn: createStudyConsultation,
    onSuccess: (consultation) => {
      toast.success(
        consultation.excluida
          ? "Consulta registrada como excluida"
          : "Consulta de estudio preparada"
      );
      navigate(`/study/consultations/${consultation.id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "No se pudo crear la consulta"));
    },
  });

  const eligible = newPatient && complexity === "media";
  const canCreate =
    Boolean(patientId) &&
    noExternalReview &&
    (eligible || exclusionReason.trim().length >= 5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
      <header className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          Nueva consulta protocolar
        </p>
        <h1 className="text-2xl font-bold">Preparar consulta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete solo los controles operativos indispensables antes de iniciar.
        </p>
      </header>

      <Alert className="mb-6 border-primary/20 bg-primary/[0.03]">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Preparacion operativa</AlertTitle>
        <AlertDescription>
          Antes de continuar, verifique fuera de la aplicacion que el circuito institucional
          previo a la consulta se encuentre completo.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consulta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={patientId} onValueChange={setPatientId} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Cargando pacientes..." : "Seleccione paciente"} />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.nombre} · {patient.codigoPaciente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {patients.length === 0 && !isLoading && (
                <p className="text-xs text-amber-700">
                  Registre primero al paciente en la seccion Pacientes.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Flujo asignado</Label>
              <RadioGroup
                value={flow}
                onValueChange={(value) => setFlow(value as StudyFlow)}
                className="grid gap-3 sm:grid-cols-2"
              >
                <Label
                  htmlFor="flow-assisted"
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-colors",
                    flow === "asistido" && "border-primary bg-primary/5"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <RadioGroupItem id="flow-assisted" value="asistido" />
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    <span className="font-semibold">Asistido</span>
                  </div>
                  <p className="pl-6 text-xs font-normal leading-5 text-muted-foreground">
                    Audio solo de anamnesis, IA oculta y correccion medica.
                  </p>
                </Label>
                <Label
                  htmlFor="flow-usual"
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-colors",
                    flow === "habitual" && "border-primary bg-primary/5"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <RadioGroupItem id="flow-usual" value="habitual" />
                    <Timer className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold">Habitual</span>
                  </div>
                  <p className="pl-6 text-xs font-normal leading-5 text-muted-foreground">
                    Solo cronometro e incidencias. Sin audio ni IA.
                  </p>
                </Label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Select
                value={specialty}
                onValueChange={(value) =>
                  setSpecialty(value as (typeof STUDY_SPECIALTIES)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDY_SPECIALTIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elegibilidad y medicion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Label className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={newPatient}
                onCheckedChange={(checked) => setNewPatient(checked === true)}
              />
              <span>
                <span className="block text-sm font-medium">Paciente nuevo</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Requisito de elegibilidad del protocolo.
                </span>
              </span>
            </Label>

            <div className="space-y-2">
              <Label>Complejidad</Label>
              <Select
                value={complexity}
                onValueChange={(value) =>
                  setComplexity(value as "baja" | "media" | "alta")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Label className="flex items-center gap-3">
              <Checkbox
                checked={companion}
                onCheckedChange={(checked) => setCompanion(checked === true)}
              />
              <span className="text-sm font-medium">Acompanante presente</span>
            </Label>

            <div className="space-y-2">
              <Label htmlFor="problem-count">Numero aproximado de problemas</Label>
              <Input
                id="problem-count"
                type="number"
                min={1}
                max={20}
                value={problemCount}
                onChange={(event) => setProblemCount(Number(event.target.value) || 1)}
              />
            </div>

            <Label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <Checkbox
                checked={noExternalReview}
                onCheckedChange={(checked) => setNoExternalReview(checked === true)}
              />
              <span className="text-sm font-medium leading-5">
                No revisar ESSI, examenes ni informacion externa durante la medicion.
              </span>
            </Label>

            {!eligible && (
              <div className="space-y-2">
                <Label htmlFor="exclusion">Motivo de exclusion</Label>
                <Textarea
                  id="exclusion"
                  value={exclusionReason}
                  onChange={(event) => setExclusionReason(event.target.value)}
                  placeholder="Explique por que la consulta no cumple elegibilidad"
                  rows={3}
                />
              </div>
            )}

            <Button
              className="w-full"
              disabled={!canCreate || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  pacienteId: patientId,
                  flujo: flow,
                  especialidad: specialty,
                  esPacienteNuevo: newPatient,
                  complejidad: complexity,
                  acompanantePresente: companion,
                  numeroProblemas: problemCount,
                  confirmoNoRevisionExterna: true,
                  motivoExclusion: eligible ? null : exclusionReason,
                })
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Preparar consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkflowSteps({ consultation }: { consultation: StudyConsultation }) {
  const assistedSteps = [
    ["Preparar", true],
    ["Grabar anamnesis", consultation.eventos.some((event) => event.tipoEvento === "anamnesis_fin")],
    ["Redactar independiente", Boolean(consultation.textos?.independienteGuardadaEn)],
    ["Ver borrador IA", Boolean(consultation.textos?.primeraVisualizacionIaEn)],
    ["Corregir", Boolean(consultation.textos?.correccionFinalizadaEn)],
    ["Validar anamnesis", consultation.estadoProtocolo === "completa"],
  ] as const;
  const usualSteps = [
    ["Preparar", true],
    ["Iniciar tiempo", consultation.eventos.some((event) => event.tipoEvento === "saludo_inicio")],
    ["Documentar", consultation.estadoProtocolo === "anamnesis"],
    ["Cerrar", consultation.estadoProtocolo === "completa"],
  ] as const;
  const steps = consultation.flujo === "asistido" ? assistedSteps : usualSteps;

  return (
    <div className="flex flex-wrap gap-2">
      {steps.map(([label, done], index) => (
        <div
          key={label}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
            done
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-border bg-muted/30 text-muted-foreground"
          )}
        >
          {done ? <Check className="h-3 w-3" /> : <span>{index + 1}</span>}
          {label}
        </div>
      ))}
    </div>
  );
}

function IncidentPanel({
  consultation,
  onSaved,
}: {
  consultation: StudyConsultation;
  onSaved: () => void;
}) {
  const [type, setType] = useState("ruido_ambiental");
  const [severity, setSeverity] = useState("media");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      addStudyIncident(consultation.id, {
        tipo: type,
        severidad: severity,
        descripcion: description,
      }),
    onSuccess: () => {
      setDescription("");
      toast.success("Incidencia registrada");
      onSaved();
    },
    onError: () => toast.error("No se pudo registrar la incidencia"),
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          Incidencias
          {consultation.incidencias.length > 0 && (
            <Badge variant="secondary">{consultation.incidencias.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCIDENT_TYPES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="baja">Baja</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="critica">Critica</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="Detalle breve (opcional)"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Registrar
        </Button>
      </CardContent>
    </Card>
  );
}

function ActiveConsultation({ consultation }: { consultation: StudyConsultation }) {
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [independentText, setIndependentText] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [finalText, setFinalText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refresh = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["study-consultation", consultation.id],
      }),
    [queryClient, consultation.id]
  );
  const aiGenerationFinished = consultation.eventos.some(
    (event) => event.tipoEvento === "ia_generacion_fin"
  );

  useEffect(() => {
    const saved = consultation.textos?.anamnesisIndependiente || "";
    setIndependentText(saved);
    const finalSaved = consultation.textos?.borradorIaCorregido || "";
    if (finalSaved) setFinalText(finalSaved);
  }, [consultation.id, consultation.textos?.anamnesisIndependiente, consultation.textos?.borradorIaCorregido]);

  useEffect(() => {
    const shouldPoll =
      consultation.flujo === "asistido" &&
      ["post_anamnesis", "correccion"].includes(consultation.estadoProtocolo) &&
      !consultation.textos?.borradorDisponible;
    if (!shouldPoll) return;

    let active = true;
    const sync = async () => {
      try {
        const result = await syncHiddenAiDraft(consultation.id);
        if (active && result.available) {
          if (!aiGenerationFinished) {
            await recordStudyEvent(consultation.id, "ia_generacion_fin");
          }
          refresh();
        }
      } catch {
        // The visible state remains "processing"; the doctor can keep writing.
      }
    };
    void sync();
    const interval = window.setInterval(sync, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [
    consultation.id,
    consultation.flujo,
    consultation.estadoProtocolo,
    consultation.textos?.borradorDisponible,
    aiGenerationFinished,
    refresh,
  ]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const greetingEvent = consultation.eventos.find((event) => event.tipoEvento === "saludo_inicio");
  const endEvent = consultation.eventos.find((event) =>
    consultation.flujo === "habitual"
      ? event.tipoEvento === "redaccion_manual_fin"
      : event.tipoEvento === "anamnesis_fin"
  );
  const elapsed = useElapsed(greetingEvent?.ocurridoEn, Boolean(endEvent));

  const startAssisted = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;

      if (!greetingEvent) {
        await recordStudyEvent(consultation.id, "saludo_inicio");
        await recordStudyEvent(consultation.id, "grabacion_inicio");
      }
      recorder.start(1000);
      setRecording(true);
      toast.success("Grabacion de anamnesis iniciada");
      refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "No se pudo acceder al microfono"));
    }
  };

  const stopAssisted = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    setProcessing(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("Fallo la grabacion"));
        recorder.onstop = () =>
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        recorder.stop();
      });
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      setRecording(false);

      await recordStudyEvent(consultation.id, "anamnesis_fin");
      await recordStudyEvent(consultation.id, "ia_generacion_inicio");
      const transcribed = await transcribeStudyAudio(consultation.consultaId, blob);
      if (!transcribed.formattedTranscription?.trim()) {
        throw new Error("La transcripcion no devolvio texto");
      }
      await queueStudyExtraction(
        consultation.consultaId,
        transcribed.formattedTranscription
      );
      toast.success("Anamnesis cerrada. Continue la consulta sin grabar.");
      refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "No se pudo procesar el audio"));
      try {
        await addStudyIncident(consultation.id, {
          tipo: "falla_audio",
          severidad: "alta",
          descripcion: "Fallo automatico al cerrar o procesar la grabacion.",
        });
      } catch {
        // Preserve the original processing error for the doctor.
      }
      refresh();
    } finally {
      setProcessing(false);
    }
  };

  const startUsual = async () => {
    await recordStudyEvent(consultation.id, "saludo_inicio");
    toast.success("Cronometro de documentacion iniciado");
    refresh();
  };

  const finishUsual = async () => {
    await recordStudyEvent(consultation.id, "redaccion_manual_fin");
    toast.success("Consulta habitual completada sin audio ni IA");
    refresh();
  };

  const saveIndependent = async () => {
    try {
      if (!consultation.eventos.some((event) => event.tipoEvento === "redaccion_independiente_inicio")) {
        await recordStudyEvent(consultation.id, "redaccion_independiente_inicio");
      }
      await saveIndependentAnamnesis(consultation.id, independentText);
      toast.success("Anamnesis independiente guardada. La IA ya puede habilitarse.");
      refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "No se pudo guardar el texto independiente"));
    }
  };

  const revealDraft = async () => {
    try {
      const result = await revealAiDraft(consultation.id);
      setAiDraft(result.draft);
      setFinalText(consultation.textos?.borradorIaCorregido || result.draft);
      toast.success("Borrador IA desbloqueado. Revise y corrija antes de guardar.");
      refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "El borrador aun no esta disponible"));
    }
  };

  const saveFinal = async () => {
    try {
      const result = await saveFinalAnamnesis(consultation.id, finalText);
      setFinalText(result.finalText);
      toast.success("Ficha final guardada y lista para ESSI");
      refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "No se pudo guardar la anamnesis final"));
    }
  };

  const assisted = consultation.flujo === "asistido";
  const independentSaved = Boolean(consultation.textos?.independienteGuardadaEn);
  const aiAvailable = Boolean(consultation.textos?.borradorDisponible);
  const firstViewed = Boolean(consultation.textos?.primeraVisualizacionIaEn);
  const completed = consultation.estadoProtocolo === "completa";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {consultation.codigoEstudio}
              </Badge>
              <Badge>{consultation.especialidad}</Badge>
              <Badge variant={assisted ? "secondary" : "outline"}>
                {assisted ? "Flujo asistido" : "Flujo habitual"}
              </Badge>
              <Badge variant={completed ? "secondary" : "outline"}>
                {stateLabels[consultation.estadoProtocolo]}
              </Badge>
            </div>
            <h1 className="text-xl font-bold">{consultation.paciente.nombre}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {consultation.paciente.codigoPaciente} · {consultation.consulta.codigoSesion}
            </p>
          </div>
          <div className="min-w-[220px]">
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-muted-foreground">Completitud operativa</span>
              <span className="font-semibold">{consultation.completitud.percent}%</span>
            </div>
            <Progress value={consultation.completitud.percent} className="h-2" />
          </div>
        </div>
        <div className="mt-5">
          <WorkflowSteps consultation={consultation} />
        </div>
      </header>

      {consultation.excluida ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Consulta excluida</AlertTitle>
          <AlertDescription>{consultation.motivoExclusion}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {!assisted && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-background px-6 py-12 dark:from-blue-950/20">
                    <Badge variant="outline" className="mb-5">
                      Sin audio · Sin transcripcion · Sin IA
                    </Badge>
                    <div className="mb-3 font-mono text-5xl font-bold tabular-nums">
                      {formatElapsed(elapsed)}
                    </div>
                    <p className="mb-7 text-sm text-muted-foreground">
                      Tiempo de documentacion habitual
                    </p>
                    {!greetingEvent ? (
                      <Button size="lg" onClick={startUsual}>
                        <Play className="mr-2 h-5 w-5" />
                        Iniciar documentacion
                      </Button>
                    ) : !completed ? (
                      <Button size="lg" variant="destructive" onClick={finishUsual}>
                        <Square className="mr-2 h-5 w-5" />
                        Finalizar documentacion
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-6 w-6" />
                        <span className="font-semibold">Consulta habitual completada</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {assisted && consultation.estadoProtocolo === "preparacion" && (
              <Card className="overflow-hidden border-rose-200 dark:border-rose-900/50">
                <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <Mic className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold">Grabar solo la anamnesis</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Detenga la grabacion antes del examen fisico, examen mental estructurado,
                    diagnostico, plan, indicaciones o cierre de consulta.
                  </p>
                  <Button size="lg" className="mt-7" onClick={startAssisted}>
                    <Mic className="mr-2 h-5 w-5" />
                    Iniciar anamnesis
                  </Button>
                </CardContent>
              </Card>
            )}

            {assisted && (recording || consultation.estadoProtocolo === "anamnesis") && !endEvent && (
              <Card className="overflow-hidden border-rose-300">
                <CardContent className="flex flex-col items-center bg-rose-50/60 px-6 py-10 text-center dark:bg-rose-950/10">
                  <div className="mb-4 flex items-center gap-2 text-rose-700 dark:text-rose-300">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-rose-600" />
                    <span className="text-sm font-semibold uppercase tracking-[0.14em]">Grabando anamnesis</span>
                  </div>
                  <div className="font-mono text-5xl font-bold tabular-nums">{formatElapsed(elapsed)}</div>
                  {!mediaRecorderRef.current ? (
                    <div className="mt-7 space-y-3">
                      <p className="max-w-md text-xs text-amber-800 dark:text-amber-300">
                        La captura local se interrumpio. Reanudela y registre una incidencia
                        para dejar constancia del audio incompleto.
                      </p>
                      <Button size="lg" variant="outline" onClick={startAssisted}>
                        <Mic className="mr-2 h-5 w-5" />
                        Reanudar captura
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      variant="destructive"
                      className="mt-7"
                      disabled={processing}
                      onClick={stopAssisted}
                    >
                      {processing ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Square className="mr-2 h-5 w-5" />
                      )}
                      Terminar anamnesis
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {assisted && endEvent && !independentSaved && (
              <>
                <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <PauseCircle className="h-4 w-4" />
                  <AlertTitle>La grabacion termino</AlertTitle>
                  <AlertDescription>
                    Continue el resto de la consulta sin grabar. El borrador IA se procesa en
                    segundo plano y permanece oculto.
                  </AlertDescription>
                </Alert>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-primary" />
                      Anamnesis medica independiente
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Redacte su propia anamnesis antes de ver cualquier sugerencia de IA.
                      El texto se conserva solo en memoria hasta que usted lo guarde.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={independentText}
                      onChange={(event) => setIndependentText(event.target.value)}
                      rows={12}
                      placeholder="Redacte la anamnesis independiente..."
                      className="resize-y font-mono text-sm leading-6"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {independentText.length} caracteres
                      </span>
                      <Button
                        disabled={independentText.trim().length < 20}
                        onClick={saveIndependent}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Guardar independiente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {assisted && independentSaved && !firstViewed && (
              <Card className="border-violet-200 dark:border-violet-900/50">
                <CardContent className="flex flex-col items-center px-6 py-10 text-center">
                  {aiAvailable ? (
                    <>
                      <Sparkles className="mb-4 h-9 w-9 text-violet-600" />
                      <h2 className="text-lg font-bold">Borrador IA disponible</h2>
                      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                        Su anamnesis independiente ya quedo guardada. Al abrir el borrador se
                        registrara la primera visualizacion y comenzara el tiempo de correccion.
                      </p>
                      <Button className="mt-6" onClick={revealDraft}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Ver borrador IA
                      </Button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="mb-4 h-9 w-9 animate-spin text-violet-600" />
                      <h2 className="text-lg font-bold">Procesando borrador oculto</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Puede continuar la consulta. Esta pantalla se actualiza automaticamente.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {assisted && firstViewed && !completed && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="min-w-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Texto independiente (bloqueado)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      readOnly
                      value={consultation.textos?.anamnesisIndependiente || ""}
                      rows={16}
                      className="resize-none bg-muted/30 text-sm leading-6"
                    />
                  </CardContent>
                </Card>
                <Card className="min-w-0 border-violet-200 dark:border-violet-900/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                      Corregir borrador IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!aiDraft && !finalText ? (
                      <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                        <LockKeyhole className="mb-3 h-7 w-7 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Abra nuevamente el borrador para continuar.
                        </p>
                        <Button variant="outline" className="mt-4" onClick={revealDraft}>
                          Abrir borrador
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Textarea
                          value={finalText}
                          onChange={(event) => setFinalText(event.target.value)}
                          rows={16}
                          className="resize-y text-sm leading-6"
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            Revision medica obligatoria
                          </span>
                          <Button disabled={finalText.trim().length < 20} onClick={saveFinal}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Validar anamnesis corregida
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {assisted && completed && (
              <Card className="border-emerald-200 dark:border-emerald-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Anamnesis final validada
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Las tres versiones del estudio quedaron preservadas para trazabilidad y evaluación.
                  </p>
                </CardHeader>
                <CardContent>
                  <Textarea
                    readOnly
                    value={consultation.textos?.borradorIaCorregido || finalText}
                    rows={16}
                    className="resize-y bg-background font-mono text-sm leading-6"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="secondary">
                      {consultation.correccionMismoDia ? "Corregida el mismo dia" : "Correccion cerrada"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-5">
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Tiempo activo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {endEvent ? "Fase inicial cerrada" : "En curso"}
                </p>
              </CardContent>
            </Card>

            <IncidentPanel consultation={consultation} onSaved={refresh} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Control de completitud</CardTitle>
              </CardHeader>
              <CardContent>
                {consultation.completitud.missing.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Flujo completo
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {consultation.completitud.missing.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {assisted && (
              <Alert>
                <Headphones className="h-4 w-4" />
                <AlertTitle className="text-sm">Si escucha el audio</AlertTitle>
                <AlertDescription className="text-xs">
                  Registre la incidencia correspondiente antes de cerrar.
                </AlertDescription>
              </Alert>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default function StudySession() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["study-consultation", id],
    queryFn: () => getStudyConsultation(id!),
    enabled: Boolean(id),
    refetchInterval: id ? 15_000 : false,
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="app-content flex-1 overflow-auto">
        {!id ? (
          <SetupConsultation />
        ) : isLoading ? (
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : error || !data ? (
          <div className="mx-auto max-w-3xl px-4 py-12">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No se pudo abrir la consulta</AlertTitle>
              <AlertDescription>
                Verifique que la consulta exista y que tenga acceso.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <ActiveConsultation consultation={data} />
        )}
      </main>
    </div>
  );
}
