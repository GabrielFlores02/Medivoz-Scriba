import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  FlaskConical,
  Loader2,
  LockKeyhole,
  Mic2,
  Plus,
  Timer,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  downloadOperationalExport,
  getStudyDashboard,
} from "@/lib/study-api";
import { toast } from "sonner";

const stateLabels: Record<string, string> = {
  preparacion: "Preparacion",
  anamnesis: "En anamnesis",
  post_anamnesis: "Post-anamnesis",
  correccion: "En correccion",
  completa: "Completa",
  excluida: "Excluida",
};

const formatDuration = (milliseconds: number | null) => {
  if (!milliseconds) return "Sin datos";
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
};

export default function StudyDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["study-dashboard"],
    queryFn: getStudyDashboard,
    refetchInterval: 30_000,
  });

  const handleExport = async () => {
    try {
      await downloadOperationalExport();
      toast.success("Exporte operativo generado");
    } catch {
      toast.error("No se pudo generar el exporte operativo");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="app-content flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-7 md:px-8">
          <header className="mb-7 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <FlaskConical className="h-4 w-4" />
                Protocolo activo
              </div>
              <h1 className="text-2xl font-bold tracking-tight">MediVoz Escriba 2.0</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Avance operativo, correcciones pendientes y control de los dos flujos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button asChild>
                <Link to="/study/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva consulta
                </Link>
              </Button>
            </div>
          </header>

          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : error || !data ? (
            <Card className="border-destructive/30">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
                <AlertTriangle className="h-5 w-5" />
                No se pudo cargar el tablero. Verifique que la migracion 03 este aplicada.
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  { label: "Consultas", value: data.total, icon: FlaskConical, tone: "text-slate-600" },
                  { label: "Habituales", value: data.habitual, icon: Timer, tone: "text-blue-600" },
                  { label: "Asistidas", value: data.asistido, icon: Bot, tone: "text-violet-600" },
                  { label: "Completas", value: data.completas, icon: CheckCircle2, tone: "text-emerald-600" },
                  { label: "Por corregir", value: data.pendientesCorreccion, icon: Clock3, tone: "text-amber-600" },
                  { label: "IA bloqueada", value: data.borradoresBloqueados, icon: LockKeyhole, tone: "text-rose-600" },
                ].map((item) => (
                  <Card key={item.label} className="border-border/60 shadow-sm">
                    <CardContent className="p-4">
                      <item.icon className={`mb-3 h-5 w-5 ${item.tone}`} />
                      <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Avance por especialidad</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Meta: 20 habituales y 20 asistidas por servicio.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {data.progresoEspecialidad.map((item) => (
                      <div key={item.especialidad} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.especialidad}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {item.habitual + item.asistido}/{item.metaHabitual + item.metaAsistida}
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                              <span>Habitual</span>
                              <span>{item.habitual}/{item.metaHabitual}</span>
                            </div>
                            <Progress value={(item.habitual / item.metaHabitual) * 100} className="h-2" />
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                              <span>Asistido</span>
                              <span>{item.asistido}/{item.metaAsistida}</span>
                            </div>
                            <Progress value={(item.asistido / item.metaAsistida) * 100} className="h-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="border-border/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock3 className="h-4 w-4 text-primary" />
                        Resumen operativo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tiempo promedio</span>
                        <span className="font-semibold">{formatDuration(data.tiempoPromedioMs)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Consultas excluidas</span>
                        <Badge variant={data.excluidas ? "destructive" : "secondary"}>
                          {data.excluidas}
                        </Badge>
                      </div>
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/study/pending">
                          Ver correcciones de hoy
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20 bg-primary/[0.03]">
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center gap-2 font-semibold">
                        <Mic2 className="h-5 w-5 text-primary" />
                        Alcance clinico
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        La grabacion se limita a la anamnesis. Examen, diagnostico,
                        tratamiento e indicaciones continuan fuera de la grabacion.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </section>

              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold">Consultas recientes</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/study/pending">Ver pendientes</Link>
                  </Button>
                </div>
                <div className="grid gap-3">
                  {data.recientes.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Aun no hay consultas del protocolo.
                      </CardContent>
                    </Card>
                  ) : (
                    data.recientes.map((item) => (
                      <Link key={item.id} to={`/study/consultations/${item.id}`}>
                        <Card className="border-border/50 transition-colors hover:border-primary/30">
                          <CardContent className="flex flex-wrap items-center gap-3 p-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{item.paciente.nombre}</span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {item.codigoEstudio}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.especialidad} · {item.flujo === "asistido" ? "Asistida" : "Habitual"}
                              </p>
                            </div>
                            <Badge variant={item.estadoProtocolo === "completa" ? "secondary" : "outline"}>
                              {stateLabels[item.estadoProtocolo] || item.estadoProtocolo}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
