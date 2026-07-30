import { describe, expect, it } from "vitest";
import { buildPatientPayload } from "./patientPayload";

describe("buildPatientPayload", () => {
  it("incluye la edad al crear o actualizar un paciente", () => {
    expect(
      buildPatientPayload({
        nombre: "Gabriel Flores",
        dni: "75068923",
        edad: 35,
        ocupacion: "Ingeniero",
        procedencia: "Lima",
        diagnostico: "",
      })
    ).toEqual({
      nombre: "Gabriel Flores",
      identificacion: "75068923",
      edad: 35,
      metadata: {
        ocupacion: "Ingeniero",
        procedencia: "Lima",
        diagnostico: null,
      },
    });
  });

  it("envía null cuando la edad se deja vacía", () => {
    expect(
      buildPatientPayload({
        nombre: "Paciente sin edad",
        dni: "",
        edad: null,
        ocupacion: "",
        procedencia: "",
        diagnostico: "",
      }).edad
    ).toBeNull();
  });
});
