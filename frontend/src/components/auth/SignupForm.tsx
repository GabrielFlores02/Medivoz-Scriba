import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, RefreshCw, Star, Stethoscope, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell } from "@/components/auth/AuthShell";
import api from "@/lib/api";
import { logger } from "@/utils/logger";

export function SignupForm() {
  const [specialties, setSpecialties] = useState<Array<{ id: number; nombre: string }>>([]);
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<number[]>([]);
  const [primarySpecialtyId, setPrimarySpecialtyId] = useState<number | null>(null);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const loadSpecialties = useCallback(async () => {
    setIsLoadingSpecialties(true);
    setSpecialtiesError(null);

    try {
      const response = await api.get("/auth/specialties");
      const catalog = Array.isArray(response.data) ? response.data : [];
      setSpecialties(catalog);
      if (catalog.length === 0) {
        setSpecialtiesError("No hay especialidades disponibles en este momento.");
      }
    } catch (error) {
      logger.error("Error loading specialties:", error);
      setSpecialtiesError("No se pudieron cargar las especialidades.");
    } finally {
      setIsLoadingSpecialties(false);
    }
  }, []);

  useEffect(() => {
    void loadSpecialties();
  }, [loadSpecialties]);

  const toggleSpecialty = (id: number, checked: boolean) => {
    setSelectedSpecialtyIds((current) => {
      if (checked) {
        const next = current.includes(id) ? current : [...current, id];
        if (primarySpecialtyId === null) setPrimarySpecialtyId(id);
        return next;
      }

      const next = current.filter((specialtyId) => specialtyId !== id);
      if (primarySpecialtyId === id) setPrimarySpecialtyId(next[0] ?? null);
      return next;
    });
  };

  const passwordStatus = useMemo(() => {
    if (!password) {
      return { message: "Usa al menos 8 caracteres para mayor seguridad.", state: "neutral" as const };
    }

    if (password.length < 8) {
      return { message: "La contrasena es corta. Se recomienda minimo 8 caracteres.", state: "weak" as const };
    }

    const hasMix = /[A-Z]/.test(password) && /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (hasMix && hasNumber && hasSymbol) {
      return { message: "Contrasena solida.", state: "strong" as const };
    }

    return { message: "Buen avance. Agrega numeros y simbolos para fortalecerla.", state: "medium" as const };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Las contrasenas no coinciden");
      return;
    }

    if (password.length < 8) {
      toast.error("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/register", {
        email: email.trim().toLowerCase(),
        password,
        nombreCompleto: name.trim(),
        especialidadIds: selectedSpecialtyIds,
        especialidadPrincipalId: primarySpecialtyId || undefined,
      });

      toast.success("Registro completado. Ya puedes iniciar sesion.");
      navigate("/login");
    } catch (err: unknown) {
      logger.error("Error during signup:", err);
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "No se pudo completar el registro";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Crear cuenta profesional"
      subtitle="Activa tu acceso clinico y empieza a documentar consultas con IA."
      footer={
        <>
          Ya tienes una cuenta?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Inicia sesion
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Nombre completo
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              placeholder="Dr. Juan Perez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 pl-10"
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Stethoscope className="h-4 w-4 text-primary" />
              Especialidades
            </Label>
            <span className="text-xs text-muted-foreground">Opcional</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Puedes elegir varias o continuar sin especialidad. Marca la estrella para definir cuál aparecerá seleccionada al grabar.
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/15 p-2">
            {isLoadingSpecialties ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando especialidades...
              </div>
            ) : specialtiesError ? (
              <div className="flex flex-col items-center gap-3 px-3 py-5 text-center">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{specialtiesError}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadSpecialties}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar
                </Button>
              </div>
            ) : (
              specialties.map((specialty) => {
                const selected = selectedSpecialtyIds.includes(specialty.id);
                const primary = primarySpecialtyId === specialty.id;
                return (
                  <div
                    key={specialty.id}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      selected ? "bg-primary/8 text-foreground" : "hover:bg-muted/60",
                    ].join(" ")}
                  >
                    <Checkbox
                      id={`specialty-${specialty.id}`}
                      checked={selected}
                      onCheckedChange={(checked) => toggleSpecialty(specialty.id, checked === true)}
                    />
                    <Label
                      htmlFor={`specialty-${specialty.id}`}
                      className="min-w-0 flex-1 cursor-pointer text-sm font-normal"
                    >
                      {specialty.nombre}
                    </Label>
                    {selected && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={[
                          "h-8 w-8 shrink-0 rounded-full",
                          primary ? "bg-primary/10 text-primary" : "text-muted-foreground",
                        ].join(" ")}
                        onClick={() => setPrimarySpecialtyId(specialty.id)}
                        aria-label={`Usar ${specialty.nombre} como especialidad predeterminada`}
                        title={primary ? "Especialidad predeterminada" : "Definir como predeterminada"}
                      >
                        <Star className={primary ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {selectedSpecialtyIds.length > 0 && (
            <p className="text-xs font-medium text-primary">
              {selectedSpecialtyIds.length} especialidad{selectedSpecialtyIds.length === 1 ? "" : "es"} seleccionada{selectedSpecialtyIds.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Correo
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="doctor@essalud.gob.pe"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Contrasena
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Crea una contrasena segura"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10 pr-12"
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p
            className={[
              "text-xs",
              passwordStatus.state === "strong" ? "text-emerald-600 dark:text-emerald-400" : "",
              passwordStatus.state === "weak" ? "text-amber-600 dark:text-amber-400" : "",
              passwordStatus.state === "medium" ? "text-primary" : "",
              passwordStatus.state === "neutral" ? "text-muted-foreground" : "",
            ].join(" ")}
          >
            {passwordStatus.message}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirmar contrasena
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Repite la contrasena"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 pl-10 pr-12"
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="mt-2 h-12 w-full text-sm font-semibold" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
