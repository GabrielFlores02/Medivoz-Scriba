import { memo, useState } from "react";
import {
  Accessibility,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  ListChecks,
  Lock,
  RefreshCw,
  ScrollText,
  Shuffle,
  Sparkles,
  Stethoscope,
  StickyNote,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MedicalRecordFormData,
  RecordSummaryData,
  SectionMetaMap,
} from "@/hooks/medical-record/types";
import { cn } from "@/lib/utils";

interface MedicalRecordFormProps {
  formData: MedicalRecordFormData;
  sectionMeta?: SectionMetaMap;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
  onAcceptSuggestion?: (field: keyof MedicalRecordFormData) => Promise<boolean>;
  onRejectSuggestion?: (field: keyof MedicalRecordFormData) => Promise<boolean>;
  onBlockSection?: (field: keyof MedicalRecordFormData) => Promise<boolean>;
  onRetrySection?: (field: keyof MedicalRecordFormData) => Promise<boolean>;
  onRefineSection?: (field: keyof MedicalRecordFormData) => Promise<boolean>;
  recordSummary?: RecordSummaryData;
  onRecordSummaryChange?: (value: string) => void;
  validationWarnings?: string[];
}

type FieldConfig = {
  field: keyof MedicalRecordFormData;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  rows?: number;
  alwaysVisible?: boolean;
};

const fields: FieldConfig[] = [
  {
    field: "motivo_consulta",
    label: "Motivo de consulta",
    placeholder: "Describa el motivo principal de la consulta",
    icon: <FileText className="h-4 w-4" />,
    alwaysVisible: true,
  },
  {
    field: "tiempo_enfermedad",
    label: "Tiempo de enfermedad",
    placeholder: "Ej.: 1 año de evolución",
    icon: <Clock className="h-4 w-4" />,
    alwaysVisible: true,
  },
  {
    field: "forma_inicio",
    label: "Forma de inicio",
    placeholder: "Ej.: insidioso, súbito",
    icon: <Shuffle className="h-4 w-4" />,
  },
  {
    field: "curso_enfermedad",
    label: "Curso de la enfermedad",
    placeholder: "Ej.: progresivo, fluctuante",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    field: "historia_cronologica",
    label: "Historia cronológica",
    placeholder: "Evolución ordenada y síntomas actuales del paciente",
    icon: <ScrollText className="h-4 w-4" />,
    rows: 5,
    alwaysVisible: true,
  },
  {
    field: "sintomas_principales",
    label: "Síntomas principales",
    placeholder: "Síntomas relevantes mencionados durante la consulta",
    icon: <ClipboardList className="h-4 w-4" />,
    rows: 4,
  },
  {
    field: "antecedentes",
    label: "Antecedentes",
    placeholder: "Antecedentes personales, familiares y RAM relevantes",
    icon: <ListChecks className="h-4 w-4" />,
    rows: 4,
  },
  {
    field: "estado_funcional_basal",
    label: "Estado funcional basal",
    placeholder: "Ej.: autosuficiente, Barthel 100 puntos",
    icon: <Accessibility className="h-4 w-4" />,
    rows: 3,
  },
  {
    field: "estudios_previos",
    label: "Estudios previos",
    placeholder: "Estudios complementarios mencionados",
    icon: <FlaskConical className="h-4 w-4" />,
    rows: 3,
  },
  {
    field: "notas_adicionales",
    label: "Notas adicionales",
    placeholder: "Observaciones adicionales relevantes",
    icon: <StickyNote className="h-4 w-4" />,
    rows: 4,
  },
];

const originLabels: Record<string, string> = {
  referido_paciente: "Paciente",
  dicho_familiar: "Familiar",
  indicado_medico: "Médico",
  no_determinado: "Origen no claro",
};

export const MedicalRecordForm = memo(function MedicalRecordForm({
  formData,
  sectionMeta = {},
  onChange,
  onAcceptSuggestion,
  onRejectSuggestion,
  onBlockSection,
  onRetrySection,
  onRefineSection,
  recordSummary = { resumenSugeridoIa: "", resumenActual: "" },
  onRecordSummaryChange,
  validationWarnings = [],
}: MedicalRecordFormProps) {
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const isLocked = (field: keyof MedicalRecordFormData) =>
    sectionMeta[field]?.estado === "bloqueada";
  const isReviewed = (field: keyof MedicalRecordFormData) =>
    sectionMeta[field]?.estado === "revisada";
  const hasPending = (field: keyof MedicalRecordFormData) => {
    const meta = sectionMeta[field];
    return Boolean(
      meta?.estado === "borrador_ia" &&
        meta.textoSugeridoIa?.trim() &&
        meta.textoSugeridoIa !== meta.textoActual
    );
  };
  const hasDoctorEdit = (field: keyof MedicalRecordFormData) => {
    const suggestion = sectionMeta[field]?.textoSugeridoIa?.trim();
    const current = formData[field]?.trim();
    return Boolean(suggestion && current && current !== suggestion);
  };
  const hasContent = (field: keyof MedicalRecordFormData) =>
    Boolean(formData[field]?.trim() || sectionMeta[field]?.textoSugeridoIa?.trim());

  const reviewedCount = fields.filter(({ field }) => isReviewed(field)).length;
  const emptyOptionalFields = fields.filter(
    ({ field, alwaysVisible }) =>
      !alwaysVisible &&
      !hasContent(field) &&
      !isReviewed(field) &&
      !isLocked(field)
  );
  const hiddenFields = new Set(emptyOptionalFields.map(({ field }) => field));
  const visibleFields = showEmptyFields
    ? fields
    : fields.filter(({ field }) => !hiddenFields.has(field));
  const pendingCount = fields.filter(({ field }) => hasPending(field)).length;
  const hasWarnings = Array.from(new Set(validationWarnings.filter(Boolean))).length > 0;
  const summaryValue =
    recordSummary.resumenActual || recordSummary.resumenSugeridoIa || "";
  const summaryWasGenerated = Boolean(recordSummary.resumenSugeridoIa?.trim());
  const summaryWasEdited = Boolean(
    recordSummary.resumenActual?.trim() &&
      recordSummary.resumenActual.trim() !== recordSummary.resumenSugeridoIa?.trim()
  );

  const renderField = ({ field, label, placeholder, icon, rows }: FieldConfig) => {
    const meta = sectionMeta[field];
    const locked = isLocked(field);
    const reviewed = isReviewed(field);
    const pending = hasPending(field);
    const edited = pending && hasDoctorEdit(field);
    const canValidate = hasContent(field) && !locked;

    return (
      <section
        key={field}
        className={cn(
          "min-w-0 space-y-3 overflow-hidden rounded-xl border bg-background p-4 shadow-sm",
          pending && "border-l-4 border-l-amber-400",
          reviewed && "border-l-4 border-l-emerald-500",
          locked && "bg-muted/30"
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <Label htmlFor={field} className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="shrink-0 text-primary">{icon}</span>
            <span>{label}</span>
          </Label>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {pending && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[11px] text-amber-700"
              >
                {edited ? "Editado" : "IA pendiente"}
              </Badge>
            )}
            {reviewed && (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
              >
                Revisado
              </Badge>
            )}
            {meta?.origenDato && (
              <Badge variant="outline" className="bg-background text-[11px]">
                {originLabels[meta.origenDato] || meta.origenDato}
              </Badge>
            )}
            {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {rows ? (
          <Textarea
            id={field}
            name={field}
            value={formData[field]}
            onChange={onChange}
            disabled={locked}
            rows={rows}
            placeholder={placeholder}
            className="min-w-0 resize-y bg-background leading-relaxed"
          />
        ) : (
          <Input
            id={field}
            name={field}
            value={formData[field]}
            onChange={onChange}
            disabled={locked}
            placeholder={placeholder}
            className="min-w-0 bg-background"
          />
        )}

        {edited && meta?.textoSugeridoIa && (
          <details className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Ver sugerencia original de IA
            </summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{meta.textoSugeridoIa}</p>
          </details>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant={reviewed ? "secondary" : "default"}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onAcceptSuggestion?.(field)}
            disabled={!canValidate}
          >
            {reviewed ? (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            {reviewed ? "Validada" : edited ? "Validar edición" : "Validar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onRetrySection?.(field)}
            disabled={locked}
            title="Reintentar IA solo para esta sección"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Reintentar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onRefineSection?.(field)}
            disabled={locked || !formData[field]?.trim()}
            title="Crear una versión breve para la plataforma institucional"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Resumir
          </Button>
          {pending && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => onRejectSuggestion?.(field)}
              >
                Rechazar IA
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => onBlockSection?.(field)}
              >
                Bloquear
              </Button>
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Stethoscope className="h-5 w-5 text-primary" />
            Anamnesis clínica
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Revise únicamente los campos con información y valide el contenido útil.
          </p>
        </div>
        <Badge variant="outline" className="bg-background">
          {reviewedCount}/{fields.length} validadas
        </Badge>
      </div>

      {(hasWarnings || pendingCount > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
          <p className="font-semibold">Revisión clínica pendiente</p>
          <p className="mt-1 text-xs">
            {pendingCount > 0
              ? `${pendingCount} secciones contienen sugerencias de IA por validar.`
              : "Revise los campos obligatorios antes de finalizar la ficha."}
          </p>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3">
        {visibleFields.map(renderField)}
      </div>

      {emptyOptionalFields.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center border-dashed text-muted-foreground"
          onClick={() => setShowEmptyFields((current) => !current)}
        >
          {showEmptyFields
            ? "Ocultar campos sin información"
            : `Mostrar ${emptyOptionalFields.length} campos sin información`}
        </Button>
      )}

      <section className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              Resumen narrativo final
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Texto breve preparado para copiar al sistema institucional.
            </p>
          </div>
          <div className="flex gap-2">
            {summaryWasGenerated && (
              <Badge variant="outline" className="bg-background text-[11px]">
                IA
              </Badge>
            )}
            {summaryWasEdited && (
              <Badge variant="secondary" className="text-[11px]">
                Editado
              </Badge>
            )}
          </div>
        </div>

        <Textarea
          value={summaryValue}
          onChange={(event) => onRecordSummaryChange?.(event.target.value)}
          rows={5}
          placeholder="Resumen narrativo de la anamnesis..."
          className="min-w-0 resize-y bg-background leading-relaxed"
        />
      </section>
    </div>
  );
});
