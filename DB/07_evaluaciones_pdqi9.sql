-- Módulo de evaluación ciega PDQI-9 para MediVoz 2.0.
-- No almacena PII en los documentos que recibe el evaluador.
CREATE TABLE IF NOT EXISTS asignaciones_pdqi9 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_estudio_id uuid NOT NULL REFERENCES consultas_estudio(id) ON DELETE CASCADE,
  evaluador_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  asignada_por_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  estado varchar(24) NOT NULL DEFAULT 'asignada',
  creado_en timestamptz NOT NULL DEFAULT now(),
  completada_en timestamptz,
  CONSTRAINT uq_pdqi9_consulta_evaluador UNIQUE (consulta_estudio_id, evaluador_id)
);
CREATE INDEX IF NOT EXISTS idx_pdqi9_evaluador_estado ON asignaciones_pdqi9(evaluador_id, estado);

CREATE TABLE IF NOT EXISTS documentos_pdqi9 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES asignaciones_pdqi9(id) ON DELETE CASCADE,
  etiqueta_ciega varchar(24) NOT NULL,
  orden integer NOT NULL,
  texto_pseudonimizado text NOT NULL,
  origen_interno varchar(24) NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pdqi9_documento_etiqueta UNIQUE (asignacion_id, etiqueta_ciega)
);

CREATE TABLE IF NOT EXISTS calificaciones_pdqi9 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES asignaciones_pdqi9(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES documentos_pdqi9(id) ON DELETE CASCADE,
  evaluador_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  puntajes jsonb NOT NULL,
  puntaje_total integer NOT NULL,
  observaciones text,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pdqi9_calificacion_documento UNIQUE (asignacion_id, documento_id)
);
