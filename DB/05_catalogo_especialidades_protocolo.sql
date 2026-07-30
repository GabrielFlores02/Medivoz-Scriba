BEGIN;

-- Completa el catálogo clínico con las cinco especialidades admitidas
-- por el protocolo Medivoz Escriba 2.0.
INSERT INTO catalogo_especialidades (
  nombre_especialidad,
  activa,
  es_administrativa
)
VALUES
  ('Hematologia', true, false),
  ('Reumatologia', true, false)
ON CONFLICT (nombre_especialidad) DO UPDATE
SET
  activa = EXCLUDED.activa,
  es_administrativa = EXCLUDED.es_administrativa,
  actualizado_en = now();

-- Crea la plantilla base que requieren las especialidades recién agregadas.
INSERT INTO plantillas_anamnesis (
  especialidad_id,
  nombre_plantilla,
  numero_version,
  descripcion,
  es_activa
)
SELECT
  e.id,
  'Anamnesis base - ' || e.nombre_especialidad,
  1,
  'Plantilla inicial de anamnesis para primera consulta. Misma estructura base en fase 1.',
  true
FROM catalogo_especialidades e
WHERE e.nombre_especialidad IN ('Hematologia', 'Reumatologia')
ON CONFLICT (especialidad_id, numero_version) DO UPDATE
SET
  es_activa = true,
  actualizado_en = now();

INSERT INTO secciones_plantilla_anamnesis (
  plantilla_anamnesis_id,
  seccion,
  etiqueta_visible,
  descripcion_ia,
  orden,
  es_obligatoria,
  activa
)
SELECT
  p.id,
  s.seccion::nombre_seccion,
  s.etiqueta_visible,
  s.descripcion_ia,
  s.orden,
  s.es_obligatoria,
  true
FROM plantillas_anamnesis p
INNER JOIN catalogo_especialidades e ON e.id = p.especialidad_id
CROSS JOIN (
  VALUES
    ('motivo_consulta', 'Motivo de consulta', 'Motivo principal expresado por el paciente, idealmente en una frase.', 1, true),
    ('tiempo_enfermedad', 'Tiempo de enfermedad', 'Tiempo de evolucion o duracion desde el inicio de sintomas.', 2, true),
    ('forma_inicio', 'Forma de inicio', 'Modo de inicio del problema: subito, gradual, insidioso u otro.', 3, false),
    ('curso_enfermedad', 'Curso de la enfermedad', 'Evolucion del cuadro: progresivo, estacionario, fluctuante, regresivo u otro.', 4, false),
    ('historia_cronologica', 'Historia cronologica', 'Narrativa clinica ordenada de la enfermedad actual con sintomas relevantes.', 5, true),
    ('sintomas_principales', 'Sintomas principales', 'Sintomas destacados mencionados durante la consulta.', 6, false),
    ('antecedentes', 'Antecedentes', 'Antecedentes personales, familiares o datos previos relevantes mencionados en la consulta.', 7, false),
    ('estado_funcional_basal', 'Estado funcional basal', 'Nivel funcional previo referido durante la consulta.', 8, false),
    ('estudios_previos', 'Estudios previos mencionados', 'Examenes o estudios mencionados por el paciente o medico.', 9, false),
    ('notas_adicionales', 'Notas adicionales', 'Informacion complementaria que no encaja en las secciones anteriores.', 10, false)
) AS s(seccion, etiqueta_visible, descripcion_ia, orden, es_obligatoria)
WHERE e.nombre_especialidad IN ('Hematologia', 'Reumatologia')
ON CONFLICT (plantilla_anamnesis_id, seccion) DO NOTHING;

COMMIT;
