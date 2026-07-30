import { describe, expect, it } from "vitest";
import { buildPatientPayload } from "./patientPayload";

describe("buildPatientPayload", () => {
  it("envía exclusivamente nombre, DNI y edad", () => {
    expect(
      buildPatientPayload({
        nombre: "Gabriel Flores",
        dni: "75068923",
        edad: 35,
      })
    ).toEqual({
      nombre: "Gabriel Flores",
      dni: "75068923",
      edad: 35,
    });
  });
});
