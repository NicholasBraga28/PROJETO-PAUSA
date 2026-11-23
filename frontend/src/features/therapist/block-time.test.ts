import { describe, expect, it } from "vitest";
import { localBlockDateTimeToIso } from "./block-time";

describe("horário local do bloqueio", () => {
  it("TK-11.02 RF-13: converte horário de São Paulo para instante ISO sem depender do fuso do navegador", () => {
    expect(localBlockDateTimeToIso("2026-11-03T09:00")).toBe("2026-11-03T12:00:00.000Z");
  });

  it("TK-11.02 RF-13: rejeita entrada que não seja data e hora locais completas", () => {
    expect(() => localBlockDateTimeToIso("")).toThrow("Informe data e horário válidos.");
  });
});
