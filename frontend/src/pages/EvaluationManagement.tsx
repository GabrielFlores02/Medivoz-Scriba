import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardPlus, ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";

type Evaluator = { id: string; email: string };
type Eligible = { id: string; codigoEstudio: string; especialidad: string; flujo: string; listo: boolean };

export default function EvaluationManagement() {
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [consultations, setConsultations] = useState<Eligible[]>([]);
  const [evaluatorId, setEvaluatorId] = useState("");
  const [consultationId, setConsultationId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const [users, cases] = await Promise.all([api.get("/evaluations/admin/evaluators"), api.get("/evaluations/admin/assignable-consultations")]);
      setEvaluators(users.data); setConsultations(cases.data);
    } catch { toast.error("No se pudo cargar la información de asignación"); }
  })(); }, []);

  const assign = async () => {
    if (!evaluatorId || !consultationId) return toast.warning("Seleccione un evaluador y una consulta completa.");
    setSaving(true);
    try {
      await api.post("/evaluations/admin/assignments", { evaluadorId, consultaEstudioId: consultationId });
      toast.success("Asignación PDQI-9 creada. El evaluador ya puede calificar los tres documentos.");
      setConsultationId("");
    } catch (error: any) { toast.error(error?.response?.data?.error || "No se pudo crear la asignación"); }
    finally { setSaving(false); }
  };

  return <div className="flex min-h-screen bg-background"><Sidebar /><main className="app-content flex-1 overflow-auto"><div className="mx-auto max-w-3xl px-4 py-7 md:px-8">
    <header className="mb-7 rounded-2xl border bg-card p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">Administración del estudio</p><h1 className="mt-2 text-2xl font-bold">Asignaciones PDQI-9</h1><p className="mt-2 text-sm text-muted-foreground">La ficha clínica normal no es elegible. Solo se asignan consultas del flujo asistido de Estudio 2.0 que ya conservaron las tres versiones: independiente, borrador IA sin corrección y versión final validada.</p></header>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardPlus className="h-5 w-5 text-primary" />Nueva asignación</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="space-y-2"><Label>Evaluador</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={evaluatorId} onChange={(e) => setEvaluatorId(e.target.value)}><option value="">Seleccione un evaluador</option>{evaluators.map((item) => <option key={item.id} value={item.id}>{item.email}</option>)}</select></div>
      <div className="space-y-2"><Label>Consulta de estudio completa</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={consultationId} onChange={(e) => setConsultationId(e.target.value)}><option value="">Seleccione una consulta</option>{consultations.map((item) => <option key={item.id} value={item.id} disabled={!item.listo}>{item.codigoEstudio} · {item.especialidad} · {item.flujo}{item.listo ? "" : " (faltan documentos)"}</option>)}</select></div>
      <Button onClick={assign} disabled={saving || !evaluatorId || !consultationId}>{saving ? "Asignando..." : "Asignar documentos A, B y C"}</Button>
    </CardContent></Card>
    <Card className="mt-5 border-primary/20"><CardContent className="flex gap-3 p-5 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />La asignación se bloquea si falta cualquiera de los tres documentos: anamnesis independiente, borrador IA sin corrección y versión final.</CardContent></Card>
  </div></main></div>;
}
