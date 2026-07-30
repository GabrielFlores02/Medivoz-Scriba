import assert from "node:assert/strict";
import test from "node:test";
import {
  assertEligibility,
  assertStudySpecialty,
  buildCompleteness,
  sanitizePlainText,
} from "./study.policy.js";

test("acepta solo las cinco especialidades del protocolo", () => {
  assert.doesNotThrow(() => assertStudySpecialty("Neurologia"));
  assert.throws(() => assertStudySpecialty("Cardiologia"), /fuera del protocolo/);
});

test("exige motivo cuando la consulta no es elegible", () => {
  assert.equal(
    assertEligibility({ esPacienteNuevo: true, complejidad: "media" }),
    true
  );
  assert.throws(
    () => assertEligibility({ esPacienteNuevo: false, complejidad: "media" }),
    /motivo de exclusion/
  );
  assert.equal(
    assertEligibility({
      esPacienteNuevo: false,
      complejidad: "media",
      motivoExclusion: "Paciente de control",
    }),
    false
  );
});

test("la completitud asistida exige bloqueo y secuencia metodologica", () => {
  const incomplete = buildCompleteness({
    flujo: "asistido",
    estado: "post_anamnesis",
    excluida: false,
    confirmoNoRevisionExterna: true,
    eventTypes: ["saludo_inicio", "grabacion_inicio", "anamnesis_fin"],
    independentSaved: false,
    aiDraftAvailable: true,
    aiFirstViewed: false,
    finalSaved: false,
  });
  assert.equal(incomplete.complete, false);
  assert.ok(incomplete.missing.includes("Anamnesis independiente"));
  assert.ok(incomplete.missing.includes("Primera visualizacion IA"));

  const complete = buildCompleteness({
    flujo: "asistido",
    estado: "completa",
    excluida: false,
    confirmoNoRevisionExterna: true,
    eventTypes: [
      "saludo_inicio",
      "grabacion_inicio",
      "anamnesis_fin",
      "correccion_fin",
    ],
    independentSaved: true,
    aiDraftAvailable: true,
    aiFirstViewed: true,
    finalSaved: true,
  });
  assert.equal(complete.complete, true);
  assert.equal(complete.percent, 100);
});

test("limpia HTML y markdown antes de copiar a ESSI", () => {
  assert.equal(
    sanitizePlainText("## ANAMNESIS\n\n**Motivo:** <b>cefalea</b>"),
    "ANAMNESIS\n\nMotivo: cefalea"
  );
});
