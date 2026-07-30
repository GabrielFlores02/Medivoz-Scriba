-- =========================================================
-- MEDIVOZ ESCRIBA 2.0 - CAPA DE ESTUDIO/PROTOCOLO
-- Migracion incremental, idempotente y no destructiva.
-- No crea tablas de consentimiento, encuestas ni PDQI-9.
-- =========================================================

-- El rol de coordinación se integra en Administrador; no se crean roles adicionales.

CREATE TABLE IF NOT EXISTS protocolos_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  version varchar(40) NOT NULL,
  sede text NOT NULL,
  estado varchar(24) NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('borrador', 'activo', 'cerrado')),
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  meta_por_flujo_especialidad integer NOT NULL DEFAULT 20
    CHECK (meta_por_flujo_especialidad > 0),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_protocolos_estudio_nombre_version UNIQUE (nombre, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_protocolos_estudio_activo
  ON protocolos_estudio (estado)
  WHERE estado = 'activo';

CREATE TABLE IF NOT EXISTS especialidades_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES protocolos_estudio(id) ON DELETE CASCADE,
  nombre varchar(80) NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  meta_habitual integer NOT NULL DEFAULT 20 CHECK (meta_habitual > 0),
  meta_asistida integer NOT NULL DEFAULT 20 CHECK (meta_asistida > 0),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_especialidades_estudio_protocolo_nombre UNIQUE (protocolo_id, nombre)
);

CREATE TABLE IF NOT EXISTS consultas_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid NOT NULL UNIQUE REFERENCES consultas(id) ON DELETE CASCADE,
  protocolo_id uuid NOT NULL REFERENCES protocolos_estudio(id) ON DELETE RESTRICT,
  codigo_estudio varchar(40) NOT NULL UNIQUE,
  flujo varchar(16) NOT NULL CHECK (flujo IN ('habitual', 'asistido')),
  especialidad varchar(80) NOT NULL CHECK (
    especialidad IN ('Hematologia', 'Neurologia', 'Psiquiatria', 'Reumatologia', 'Endocrinologia')
  ),
  estado_protocolo varchar(32) NOT NULL DEFAULT 'preparacion' CHECK (
    estado_protocolo IN (
      'preparacion', 'anamnesis', 'post_anamnesis',
      'correccion', 'completa', 'excluida'
    )
  ),
  grabacion_alcance varchar(32) NOT NULL DEFAULT 'solo_anamnesis'
    CHECK (grabacion_alcance = 'solo_anamnesis'),
  es_paciente_nuevo boolean NOT NULL,
  complejidad varchar(16) NOT NULL CHECK (complejidad IN ('baja', 'media', 'alta')),
  acompanante_presente boolean NOT NULL DEFAULT false,
  numero_problemas integer NOT NULL DEFAULT 1 CHECK (numero_problemas BETWEEN 1 AND 20),
  confirmo_no_revision_externa boolean NOT NULL DEFAULT false,
  reviso_essi_durante_medicion boolean NOT NULL DEFAULT false,
  requiere_escuchar_audio boolean NOT NULL DEFAULT false,
  excluida boolean NOT NULL DEFAULT false,
  motivo_exclusion text,
  correccion_mismo_dia boolean,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_consulta_estudio_elegibilidad CHECK (
    (es_paciente_nuevo = true AND complejidad = 'media')
    OR (excluida = true AND motivo_exclusion IS NOT NULL)
  ),
  CONSTRAINT chk_flujo_habitual_sin_audio CHECK (
    flujo <> 'habitual' OR grabacion_alcance = 'solo_anamnesis'
  )
);

CREATE TABLE IF NOT EXISTS textos_anamnesis_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_estudio_id uuid NOT NULL UNIQUE
    REFERENCES consultas_estudio(id) ON DELETE CASCADE,
  anamnesis_medica_independiente text,
  borrador_ia_sin_corregir text,
  borrador_ia_corregido text,
  version_borrador integer NOT NULL DEFAULT 1 CHECK (version_borrador > 0),
  independiente_iniciada_en timestamptz,
  independiente_guardada_en timestamptz,
  borrador_oculto_disponible_en timestamptz,
  primera_visualizacion_ia_en timestamptz,
  correccion_iniciada_en timestamptz,
  correccion_finalizada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_ia_visible_despues_independiente CHECK (
    primera_visualizacion_ia_en IS NULL
    OR (
      independiente_guardada_en IS NOT NULL
      AND primera_visualizacion_ia_en >= independiente_guardada_en
    )
  ),
  CONSTRAINT chk_correccion_fin_despues_inicio CHECK (
    correccion_finalizada_en IS NULL
    OR correccion_iniciada_en IS NULL
    OR correccion_finalizada_en >= correccion_iniciada_en
  )
);

CREATE TABLE IF NOT EXISTS eventos_tiempo_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_estudio_id uuid NOT NULL REFERENCES consultas_estudio(id) ON DELETE CASCADE,
  tipo_evento varchar(60) NOT NULL CHECK (
    tipo_evento IN (
      'saludo_inicio', 'grabacion_inicio', 'anamnesis_fin',
      'redaccion_manual_fin', 'ia_generacion_inicio', 'ia_generacion_fin',
      'ia_borrador_oculto_disponible', 'redaccion_independiente_inicio',
      'redaccion_independiente_guardada', 'ia_primera_visualizacion',
      'correccion_inicio', 'correccion_fin'
    )
  ),
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidencias_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_estudio_id uuid NOT NULL REFERENCES consultas_estudio(id) ON DELETE CASCADE,
  tipo varchar(80) NOT NULL,
  severidad varchar(16) NOT NULL DEFAULT 'media'
    CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
  descripcion text,
  resuelta boolean NOT NULL DEFAULT false,
  registrada_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria_estudio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_estudio_id uuid REFERENCES consultas_estudio(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  accion varchar(80) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diccionarios_especialidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especialidad varchar(80) NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  estado varchar(20) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'validado', 'desactivado')),
  responsable text,
  aprobado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_diccionarios_especialidad_version UNIQUE (especialidad, version)
);

CREATE TABLE IF NOT EXISTS terminos_especialidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diccionario_id uuid NOT NULL REFERENCES diccionarios_especialidad(id) ON DELETE CASCADE,
  termino_canonico text NOT NULL,
  sinonimos jsonb NOT NULL DEFAULT '[]'::jsonb,
  abreviaturas jsonb NOT NULL DEFAULT '[]'::jsonb,
  tipo varchar(40) NOT NULL DEFAULT 'otro',
  regla_uso text NOT NULL DEFAULT 'Usar solo si fue verbalizado.',
  activa boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plantillas_anamnesis_especialidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especialidad varchar(80) NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  nombre text NOT NULL,
  secciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  formato_essi text NOT NULL,
  estado varchar(20) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'validado', 'desactivado')),
  responsable text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_plantillas_anamnesis_especialidad_version UNIQUE (especialidad, version)
);

CREATE INDEX IF NOT EXISTS idx_consultas_estudio_protocolo_flujo
  ON consultas_estudio (protocolo_id, flujo);
CREATE INDEX IF NOT EXISTS idx_consultas_estudio_especialidad_estado
  ON consultas_estudio (especialidad, estado_protocolo);
CREATE INDEX IF NOT EXISTS idx_eventos_tiempo_estudio_consulta_tipo
  ON eventos_tiempo_estudio (consulta_estudio_id, tipo_evento);
CREATE INDEX IF NOT EXISTS idx_incidencias_estudio_consulta
  ON incidencias_estudio (consulta_estudio_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_estudio_consulta_accion
  ON auditoria_estudio (consulta_estudio_id, accion);
CREATE INDEX IF NOT EXISTS idx_terminos_especialidad_diccionario
  ON terminos_especialidad (diccionario_id);

DROP TRIGGER IF EXISTS trg_protocolos_estudio_set_actualizado_en ON protocolos_estudio;
CREATE TRIGGER trg_protocolos_estudio_set_actualizado_en
BEFORE UPDATE ON protocolos_estudio
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

DROP TRIGGER IF EXISTS trg_consultas_estudio_set_actualizado_en ON consultas_estudio;
CREATE TRIGGER trg_consultas_estudio_set_actualizado_en
BEFORE UPDATE ON consultas_estudio
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

DROP TRIGGER IF EXISTS trg_textos_anamnesis_estudio_set_actualizado_en ON textos_anamnesis_estudio;
CREATE TRIGGER trg_textos_anamnesis_estudio_set_actualizado_en
BEFORE UPDATE ON textos_anamnesis_estudio
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

INSERT INTO protocolos_estudio (
  nombre, version, sede, estado, fecha_inicio, meta_por_flujo_especialidad
) VALUES (
  'MediVoz Escriba 2.0',
  '2.0-protocolo-final',
  'Hospital Nacional Edgardo Rebagliati Martins',
  'activo',
  CURRENT_DATE,
  20
)
ON CONFLICT (nombre, version) DO NOTHING;

INSERT INTO especialidades_estudio (
  protocolo_id, nombre, activa, meta_habitual, meta_asistida
)
SELECT p.id, specialty.nombre, true, 20, 20
FROM protocolos_estudio p
CROSS JOIN (
  VALUES
    ('Hematologia'),
    ('Neurologia'),
    ('Psiquiatria'),
    ('Reumatologia'),
    ('Endocrinologia')
) AS specialty(nombre)
WHERE p.nombre = 'MediVoz Escriba 2.0'
  AND p.version = '2.0-protocolo-final'
ON CONFLICT (protocolo_id, nombre) DO UPDATE
SET activa = true, meta_habitual = 20, meta_asistida = 20;

INSERT INTO diccionarios_especialidad (especialidad, version, estado, responsable)
SELECT nombre, 1, 'borrador', 'Pendiente de validacion por responsable clinico'
FROM (
  VALUES
    ('Hematologia'),
    ('Neurologia'),
    ('Psiquiatria'),
    ('Reumatologia'),
    ('Endocrinologia')
) AS specialty(nombre)
ON CONFLICT (especialidad, version) DO NOTHING;

INSERT INTO terminos_especialidad (
  diccionario_id, termino_canonico, sinonimos, abreviaturas, tipo, regla_uso
)
SELECT d.id, seed.termino, seed.sinonimos::jsonb, seed.abreviaturas::jsonb, seed.tipo,
       'Reconocer y normalizar solo cuando el termino haya sido verbalizado.'
FROM diccionarios_especialidad d
JOIN (
  VALUES
    ('Hematologia', 'trombosis', '["coagulo"]', '[]', 'sintoma'),
    ('Hematologia', 'sangrado', '["hemorragia"]', '[]', 'sintoma'),
    ('Neurologia', 'cefalea', '["dolor de cabeza"]', '[]', 'sintoma'),
    ('Neurologia', 'crisis epileptica', '["convulsion"]', '[]', 'evento'),
    ('Psiquiatria', 'anhedonia', '["perdida de interes"]', '[]', 'sintoma'),
    ('Psiquiatria', 'ideacion suicida', '["ideas de muerte"]', '["IS"]', 'sintoma'),
    ('Reumatologia', 'rigidez matutina', '["rigidez al despertar"]', '[]', 'sintoma'),
    ('Reumatologia', 'artralgia', '["dolor articular"]', '[]', 'sintoma'),
    ('Endocrinologia', 'poliuria', '["orina frecuente"]', '[]', 'sintoma'),
    ('Endocrinologia', 'polidipsia', '["mucha sed"]', '[]', 'sintoma')
) AS seed(especialidad, termino, sinonimos, abreviaturas, tipo)
  ON seed.especialidad = d.especialidad
WHERE d.version = 1
  AND NOT EXISTS (
    SELECT 1 FROM terminos_especialidad t
    WHERE t.diccionario_id = d.id AND t.termino_canonico = seed.termino
  );

INSERT INTO plantillas_anamnesis_especialidad (
  especialidad, version, nombre, secciones, formato_essi, estado, responsable
)
SELECT
  seed.especialidad,
  1,
  'Anamnesis ' || seed.especialidad || ' - protocolo MediVoz 2.0',
  seed.secciones::jsonb,
  seed.formato_essi,
  'borrador',
  'Pendiente de validacion por responsable clinico'
FROM (
  VALUES
    (
      'Hematologia',
      '["Motivo de consulta","Enfermedad actual","Sintomas constitucionales","Sangrado o trombosis referidos","Antecedentes hematologicos","Medicacion habitual referida","Alergias referidas"]',
      E'ANAMNESIS\n\nMotivo de consulta:\n\nEnfermedad actual:\n\nSintomas constitucionales:\n\nSangrado o trombosis referidos:\n\nAntecedentes hematologicos:\n\nMedicacion habitual referida:\n\nAlergias referidas:'
    ),
    (
      'Neurologia',
      '["Motivo de consulta","Inicio y evolucion","Sintomas neurologicos referidos","Crisis o eventos referidos","Antecedentes neurologicos","Medicacion habitual referida","Alergias referidas"]',
      E'ANAMNESIS\n\nMotivo de consulta:\n\nInicio y evolucion:\n\nSintomas neurologicos referidos:\n\nCrisis o eventos referidos:\n\nAntecedentes neurologicos:\n\nMedicacion habitual referida:\n\nAlergias referidas:'
    ),
    (
      'Psiquiatria',
      '["Motivo de consulta","Relato subjetivo","Sintomas afectivos, ansiosos o psicoticos referidos","Antecedentes","Medicacion habitual referida","Consumo referido","Contexto psicosocial verbalizado"]',
      E'ANAMNESIS\n\nMotivo de consulta:\n\nRelato subjetivo:\n\nSintomas referidos:\n\nAntecedentes:\n\nMedicacion habitual referida:\n\nConsumo referido:\n\nContexto psicosocial verbalizado:'
    ),
    (
      'Reumatologia',
      '["Motivo de consulta","Enfermedad actual","Dolor o inflamacion referida","Rigidez","Compromiso articular o sistemico referido","Antecedentes","Medicacion habitual referida","Alergias referidas"]',
      E'ANAMNESIS\n\nMotivo de consulta:\n\nEnfermedad actual:\n\nDolor o inflamacion referida:\n\nRigidez:\n\nCompromiso articular o sistemico referido:\n\nAntecedentes:\n\nMedicacion habitual referida:\n\nAlergias referidas:'
    ),
    (
      'Endocrinologia',
      '["Motivo de consulta","Enfermedad actual","Sintomas metabolicos o endocrinos referidos","Antecedentes","Medicacion habitual referida","Controles referidos","Alergias referidas","Habitos relevantes verbalizados"]',
      E'ANAMNESIS\n\nMotivo de consulta:\n\nEnfermedad actual:\n\nSintomas metabolicos o endocrinos referidos:\n\nAntecedentes:\n\nMedicacion habitual referida:\n\nControles referidos:\n\nAlergias referidas:\n\nHabitos relevantes verbalizados:'
    )
) AS seed(especialidad, secciones, formato_essi)
ON CONFLICT (especialidad, version) DO NOTHING;

COMMENT ON TABLE consultas_estudio IS
'Extension protocolar de consultas. Consentimiento, encuestas y PDQI-9 permanecen fuera de MediVoz.';
COMMENT ON TABLE textos_anamnesis_estudio IS
'Mantiene separados el texto medico independiente, el borrador IA oculto y la version final corregida.';
COMMENT ON TABLE auditoria_estudio IS
'Auditoria operativa sin duplicar contenido clinico en metadata.';
