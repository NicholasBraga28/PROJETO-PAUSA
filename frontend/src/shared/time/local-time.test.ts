import { describe, it, expect } from "vitest";
import { nextDays, hhmm, dayOf, relDay } from "./local-time";

const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 26, h + 3, m)).toISOString();

describe("local-time: datas e horas no fuso da unidade (TK-09.01; 2026-10-26, segunda-feira, São Paulo em UTC-3)", () => {
  it("usa o dia no fuso da unidade, não em UTC", () => {
    expect(dayOf(at(23, 30))).toBe("2026-10-26");
  });

  it("transforma minutos em horário", () => {
    expect(hhmm(820)).toBe("13:40");
  });

  it("conta os dias a partir de hoje no fuso", () => {
    expect(nextDays(3, new Date(at(22, 0)))).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
  });

  it("chama o dia seguinte de amanhã", () => {
    expect(relDay("2026-10-27", new Date(at(10, 0)))).toBe("amanhã");
  });
});
