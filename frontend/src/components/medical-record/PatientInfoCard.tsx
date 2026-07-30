import { memo } from "react";
import { UserRound } from "lucide-react";

interface PatientInfoCardProps {
  name: string;
  age: number | null;
  occupation: string | null;
  location: string | null;
}

const PatientDatum = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {label}
    </dt>
    <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
  </div>
);

export const PatientInfoCard = memo(function PatientInfoCard({
  name,
  age,
  occupation,
  location,
}: PatientInfoCardProps) {
  return (
    <section className="min-w-0 rounded-xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" />
        </span>
        <h4 className="font-semibold text-foreground">Información del paciente</h4>
      </div>

      <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
        <PatientDatum label="Nombre" value={name} />
        <PatientDatum label="Edad" value={age !== null ? `${age} años` : "No especificada"} />
        <PatientDatum label="Ocupación" value={occupation || "No especificada"} />
        <PatientDatum label="Procedencia" value={location || "No especificada"} />
      </dl>
    </section>
  );
});
