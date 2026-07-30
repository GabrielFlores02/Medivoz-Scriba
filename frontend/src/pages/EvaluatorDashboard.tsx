import { ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EvaluatorDashboard() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="app-content flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
          <header className="mb-7 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Evaluación documental independiente
            </p>
            <h1 className="text-2xl font-bold">Panel del Evaluador</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Solo se mostrarán documentos pseudonimizados asignados para evaluación PDQI-9.
            </p>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-5 w-5 text-primary" />Asignaciones</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">No hay evaluaciones asignadas todavía.</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-primary" />PDQI-9</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">La calificación se habilitará solo cuando el administrador asigne documentos A, B y C.</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary" />Confidencialidad</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">No se exponen pacientes, DNI, médicos tratantes, audios ni transcripciones originales.</CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
