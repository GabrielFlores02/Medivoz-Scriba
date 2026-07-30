# MediVoz Escriba 2.0

Esta version agrega una capa de estudio/protocolo sobre el nucleo existente de
pacientes, consultas, transcripcion y ficha medica.

## Alcance implementado

- Cinco especialidades: Hematologia, Neurologia, Psiquiatria, Reumatologia y
  Endocrinologia.
- Flujo habitual con cronometro e incidencias, sin audio ni IA.
- Flujo asistido con grabacion limitada a anamnesis.
- Borrador IA generado en segundo plano y oculto.
- Anamnesis medica independiente obligatoria antes de ver IA.
- Primera visualizacion IA y tiempo de correccion auditados.
- Texto independiente, borrador IA original y texto final corregido separados.
- Copia de texto plano para ESSI.
- Completitud, correcciones pendientes, avance 20 + 20 por especialidad y CSV.
- Incidencias del protocolo.
- Diccionarios y plantillas iniciales por especialidad en estado `borrador`.
- Rol `coordinador`.

No se implementan consentimiento informado, encuestas ni PDQI-9. Esos procesos
permanecen fuera de MediVoz.

## Migracion

1. Crear un backup validado.
2. Aplicar primero el esquema base si la base es nueva.
3. Aplicar [`DB/03_medivoz_escriba_2_0.sql`](DB/03_medivoz_escriba_2_0.sql).
4. Aplicar [`DB/04_especialidades_medico.sql`](DB/04_especialidades_medico.sql).
5. Aplicar [`DB/05_catalogo_especialidades_protocolo.sql`](DB/05_catalogo_especialidades_protocolo.sql).
6. Verificar el catálogo clínico, las especialidades asignadas a cada médico y las plantillas activas.
7. Reiniciar API y worker.

Las migraciones 03, 04 y 05 son incrementales: no eliminan tablas ni datos existentes.

## Rutas principales

- `/study`: tablero del protocolo.
- `/study/new`: preparar consulta.
- `/study/consultations/:id`: flujo clinico guiado.
- `/study/pending`: correcciones pendientes del dia.

La API se publica bajo `/api/v1/study`.

## Validacion local

```powershell
cd backend
npm run build
npm run test

cd ../frontend
npm run build
npm run test
```

Vite 7 requiere Node 20.19 o posterior. En el entorno de desarrollo actual las
pruebas frontend se validaron con Node 24 incluido en el runtime de Codex.

En Windows, si la red institucional intercepta HTTPS con un certificado
instalado en el sistema, iniciar la API y el worker con los certificados de
Windows:

```powershell
cd backend
npm run start:local
npm run worker:local
```

## Uso medico resumido

### Flujo habitual

1. Elegir paciente, especialidad y flujo habitual.
2. Confirmar elegibilidad y no revision de informacion externa.
3. Iniciar el cronometro.
4. Documentar de forma habitual fuera de MediVoz.
5. Finalizar el cronometro y registrar incidencias.

No aparece ningun control de audio o IA.

### Flujo asistido

1. Preparar consulta y leer el aviso `Solo anamnesis`.
2. Iniciar grabacion al comenzar la anamnesis.
3. Detenerla antes de examen, diagnostico, tratamiento o indicaciones.
4. Continuar el resto de la consulta sin grabar.
5. Redactar y guardar anamnesis medica independiente.
6. Abrir el borrador IA cuando quede disponible.
7. Corregir y guardar la ficha final.
8. Usar `Copiar para ESSI`.
9. Registrar cualquier desviacion o falla como incidencia.

## Operacion

Las herramientas saneadas estan en [`ops/medivoz`](ops/medivoz). No ejecutar
los scripts heredados de `vps_tools` contra produccion. Antes de un despliegue:

1. Auditar el VPS.
2. Crear backup.
3. Probar la migracion en staging.
4. Construir backend y frontend.
5. Ejecutar deploy en modo dry-run.
6. Desplegar release versionado.
7. Ejecutar smoke test y revisar logs.
