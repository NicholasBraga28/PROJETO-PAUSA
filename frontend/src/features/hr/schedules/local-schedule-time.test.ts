import { describe, expect, it } from "vitest";
import { localDateTimeToIso, spokenScheduleTime } from "./local-schedule-time";

describe("horários da agenda em America/Sao_Paulo", () => {
  it("TK-12.03 RF-25 RN-08: converte horário local para timestamp UTC da API", () => {
    expect(localDateTimeToIso("2026-11-05", "09:30")).toBe("2026-11-05T12:30:00.000Z");
  });

  it("TK-12.03 RF-25 RN-08: anuncia a data e a hora no fuso da unidade", () => {
    expect(spokenScheduleTime("2026-11-05T12:30:00.000Z")).toBe("quinta-feira, 5 de novembro, às 9h30");
  });
});
