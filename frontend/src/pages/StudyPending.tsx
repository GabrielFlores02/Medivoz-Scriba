import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listStudyConsultations } from "@/lib/study-api";

export default function StudyPending() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["study-pending-today"],
    queryFn: () => listStudyConsultations(true),
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="app-content flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
          <header className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Clock3 className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Mismo dia</span>
            </div>
            <h1 className="text-2xl font-bold">Correcciones pendientes de hoy</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consultas asistidas que aun no han cerrado la ficha final.
            </p>
          </header>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : data.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <p className="font-medium">No hay correcciones pendientes hoy.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Las nuevas consultas asistidas apareceran aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.map((item) => (
                <Link key={item.id} to={`/study/consultations/${item.id}`}>
                  <Card className="mb-3 border-border/50 transition-colors hover:border-primary/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.paciente.nombre}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.codigoEstudio}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.especialidad} · {item.estadoProtocolo.replace("_", " ")}
                        </p>
                      </div>
                      {!item.independienteGuardada && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Falta texto independiente
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
