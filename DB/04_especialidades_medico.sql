-- =========================================================
-- MEDIVOZ - ESPECIALIDADES MULTIPLES Y OPCIONALES POR MEDICO
-- Migracion incremental, idempotente y no destructiva.
-- =========================================================

BEGIN;

ALTER TABLE perfiles_usuario
  ALTER COLUMN especialidad_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS especialidades_usuario (
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  especialidad_id integer NOT NULL REFERENCES catalogo_especialidades(id) ON DELETE CASCADE,
  es_principal boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, especialidad_id)
);

CREATE INDEX IF NOT EXISTS idx_especialidades_usuario_usuario_id
  ON especialidades_usuario (usuario_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_especialidades_usuario_principal
  ON especialidades_usuario (usuario_id)
  WHERE es_principal = true;

INSERT INTO especialidades_usuario (
  usuario_id,
  especialidad_id,
  es_principal
)
SELECT
  usuario_id,
  especialidad_id,
  true
FROM perfiles_usuario
WHERE especialidad_id IS NOT NULL
ON CONFLICT (usuario_id, especialidad_id) DO NOTHING;

ALTER TABLE consultas
  ADD COLUMN IF NOT EXISTS especialidad_id integer
  REFERENCES catalogo_especialidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consultas_especialidad_id
  ON consultas (especialidad_id);

UPDATE consultas c
SET especialidad_id = p.especialidad_id
FROM perfiles_usuario p
WHERE c.doctor_id = p.usuario_id
  AND c.especialidad_id IS NULL
  AND p.especialidad_id IS NOT NULL;

COMMENT ON TABLE especialidades_usuario IS
  'Especialidades clinicas opcionales del medico; admite varias y una principal.';

COMMENT ON COLUMN consultas.especialidad_id IS
  'Especialidad elegida para esta consulta; determina la plantilla de anamnesis.';

COMMIT;
