import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { consultations } from "./clinical.js";
import { users } from "./auth.js";

export const studyProtocols = pgTable("protocolos_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  version: varchar("version", { length: 40 }).notNull(),
  sede: text("sede").notNull(),
  estado: varchar("estado", { length: 24 }).default("activo").notNull(),
  fechaInicio: timestamp("fecha_inicio", { withTimezone: true }),
  fechaFin: timestamp("fecha_fin", { withTimezone: true }),
  metaPorFlujoEspecialidad: integer("meta_por_flujo_especialidad").default(20).notNull(),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
});

export const studySpecialties = pgTable("especialidades_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  protocoloId: uuid("protocolo_id")
    .notNull()
    .references(() => studyProtocols.id, { onDelete: "cascade" }),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  activa: boolean("activa").default(true).notNull(),
  metaHabitual: integer("meta_habitual").default(20).notNull(),
  metaAsistida: integer("meta_asistida").default(20).notNull(),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  protocolSpecialty: uniqueIndex("uq_especialidades_estudio_protocolo_nombre")
    .on(table.protocoloId, table.nombre),
}));

export const studyConsultations = pgTable("consultas_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  consultaId: uuid("consulta_id")
    .notNull()
    .references(() => consultations.id, { onDelete: "cascade" }),
  protocoloId: uuid("protocolo_id")
    .notNull()
    .references(() => studyProtocols.id, { onDelete: "restrict" }),
  codigoEstudio: varchar("codigo_estudio", { length: 40 }).notNull(),
  flujo: varchar("flujo", { length: 16 }).notNull(),
  especialidad: varchar("especialidad", { length: 80 }).notNull(),
  estadoProtocolo: varchar("estado_protocolo", { length: 32 }).default("preparacion").notNull(),
  grabacionAlcance: varchar("grabacion_alcance", { length: 32 }).default("solo_anamnesis").notNull(),
  esPacienteNuevo: boolean("es_paciente_nuevo").notNull(),
  complejidad: varchar("complejidad", { length: 16 }).notNull(),
  acompanantePresente: boolean("acompanante_presente").default(false).notNull(),
  numeroProblemas: integer("numero_problemas").default(1).notNull(),
  confirmoNoRevisionExterna: boolean("confirmo_no_revision_externa").default(false).notNull(),
  revisoEssiDuranteMedicion: boolean("reviso_essi_durante_medicion").default(false).notNull(),
  requiereEscucharAudio: boolean("requiere_escuchar_audio").default(false).notNull(),
  excluida: boolean("excluida").default(false).notNull(),
  motivoExclusion: text("motivo_exclusion"),
  correccionMismoDia: boolean("correccion_mismo_dia"),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  consultationUnique: uniqueIndex("uq_consultas_estudio_consulta").on(table.consultaId),
  codeUnique: uniqueIndex("uq_consultas_estudio_codigo").on(table.codigoEstudio),
  protocolFlow: index("idx_consultas_estudio_protocolo_flujo")
    .on(table.protocoloId, table.flujo),
  specialtyState: index("idx_consultas_estudio_especialidad_estado")
    .on(table.especialidad, table.estadoProtocolo),
}));

export const studyAnamnesisTexts = pgTable("textos_anamnesis_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  consultaEstudioId: uuid("consulta_estudio_id")
    .notNull()
    .references(() => studyConsultations.id, { onDelete: "cascade" }),
  anamnesisIndependiente: text("anamnesis_medica_independiente"),
  borradorIaSinCorregir: text("borrador_ia_sin_corregir"),
  borradorIaCorregido: text("borrador_ia_corregido"),
  versionBorrador: integer("version_borrador").default(1).notNull(),
  independienteIniciadaEn: timestamp("independiente_iniciada_en", { withTimezone: true }),
  independienteGuardadaEn: timestamp("independiente_guardada_en", { withTimezone: true }),
  borradorOcultoDisponibleEn: timestamp("borrador_oculto_disponible_en", { withTimezone: true }),
  primeraVisualizacionIaEn: timestamp("primera_visualizacion_ia_en", { withTimezone: true }),
  correccionIniciadaEn: timestamp("correccion_iniciada_en", { withTimezone: true }),
  correccionFinalizadaEn: timestamp("correccion_finalizada_en", { withTimezone: true }),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studyConsultationUnique: uniqueIndex("uq_textos_anamnesis_consulta_estudio")
    .on(table.consultaEstudioId),
}));

export const studyTimingEvents = pgTable("eventos_tiempo_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  consultaEstudioId: uuid("consulta_estudio_id")
    .notNull()
    .references(() => studyConsultations.id, { onDelete: "cascade" }),
  tipoEvento: varchar("tipo_evento", { length: 60 }).notNull(),
  ocurridoEn: timestamp("ocurrido_en", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  consultationEvent: index("idx_eventos_tiempo_estudio_consulta_tipo")
    .on(table.consultaEstudioId, table.tipoEvento),
}));

export const studyIncidents = pgTable("incidencias_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  consultaEstudioId: uuid("consulta_estudio_id")
    .notNull()
    .references(() => studyConsultations.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 80 }).notNull(),
  severidad: varchar("severidad", { length: 16 }).default("media").notNull(),
  descripcion: text("descripcion"),
  resuelta: boolean("resuelta").default(false).notNull(),
  registradaPor: uuid("registrada_por").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  consultationIncident: index("idx_incidencias_estudio_consulta")
    .on(table.consultaEstudioId),
}));

export const studyAuditEvents = pgTable("auditoria_estudio", {
  id: uuid("id").primaryKey().defaultRandom(),
  consultaEstudioId: uuid("consulta_estudio_id")
    .references(() => studyConsultations.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").references(() => users.id, { onDelete: "set null" }),
  accion: varchar("accion", { length: 80 }).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  consultationAudit: index("idx_auditoria_estudio_consulta_accion")
    .on(table.consultaEstudioId, table.accion),
}));

export const specialtyDictionaries = pgTable("diccionarios_especialidad", {
  id: uuid("id").primaryKey().defaultRandom(),
  especialidad: varchar("especialidad", { length: 80 }).notNull(),
  version: integer("version").default(1).notNull(),
  estado: varchar("estado", { length: 20 }).default("borrador").notNull(),
  responsable: text("responsable"),
  aprobadoEn: timestamp("aprobado_en", { withTimezone: true }),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  specialtyVersion: uniqueIndex("uq_diccionarios_especialidad_version")
    .on(table.especialidad, table.version),
}));

export const specialtyTerms = pgTable("terminos_especialidad", {
  id: uuid("id").primaryKey().defaultRandom(),
  diccionarioId: uuid("diccionario_id")
    .notNull()
    .references(() => specialtyDictionaries.id, { onDelete: "cascade" }),
  terminoCanonico: text("termino_canonico").notNull(),
  sinonimos: jsonb("sinonimos").default([]).notNull(),
  abreviaturas: jsonb("abreviaturas").default([]).notNull(),
  tipo: varchar("tipo", { length: 40 }).default("otro").notNull(),
  reglaUso: text("regla_uso").default("Usar solo si fue verbalizado.").notNull(),
  activa: boolean("activa").default(true).notNull(),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dictionaryTerm: index("idx_terminos_especialidad_diccionario")
    .on(table.diccionarioId),
}));

export const specialtyAnamnesisTemplates = pgTable("plantillas_anamnesis_especialidad", {
  id: uuid("id").primaryKey().defaultRandom(),
  especialidad: varchar("especialidad", { length: 80 }).notNull(),
  version: integer("version").default(1).notNull(),
  nombre: text("nombre").notNull(),
  secciones: jsonb("secciones").default([]).notNull(),
  formatoEssi: text("formato_essi").notNull(),
  estado: varchar("estado", { length: 20 }).default("borrador").notNull(),
  responsable: text("responsable"),
  createdAt: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  specialtyTemplateVersion: uniqueIndex("uq_plantillas_anamnesis_especialidad_version")
    .on(table.especialidad, table.version),
}));
