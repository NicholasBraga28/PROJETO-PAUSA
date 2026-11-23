import { describe, expect, it } from "vitest";
import {
  currentMonthRange,
  formatMonthLabel,
  formatReportCompactDate,
  formatReportDate,
  formatReportTime,
  labelForShift,
  labelForWeekday,
  shiftMonthRange,
} from "./report-format";

describe("formatação de KPIs para leitura", () => {
  it("TK-12.07 RF-21 D-08: traduz turnos e dias da semana mantendo valores zero", () => {
    expect(labelForShift("MORNING")).toBe("Manhã");
    expect(labelForShift("AFTERNOON")).toBe("Tarde");
    expect(labelForWeekday("SUNDAY")).toBe("Domingo");
  });

  it("TK-12.07 RF-21 RNF-05: apresenta datas do relatório sem deslocamento de fuso", () => {
    expect(formatReportDate("2026-10-01")).toBe("1 de outubro de 2026");
    expect(formatReportCompactDate("2026-10-01")).toBe("1/10");
    expect(formatReportTime("09:00")).toBe("9h");
    expect(formatReportTime("09:20")).toBe("9h20");
  });

  it("TK-12.07 RF-21 RNF-05: pré-seleciona o mês corrente no fuso de São Paulo", () => {
    expect(currentMonthRange(new Date("2026-11-03T12:00:00.000Z"))).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(currentMonthRange(new Date("2026-11-01T02:30:00.000Z"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("TK-12.07 RF-21 RNF-05: navega entre meses, incluindo virada de ano e ano bissexto", () => {
    expect(shiftMonthRange("2026-11-01", -1)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(shiftMonthRange("2026-12-01", 1)).toEqual({ from: "2027-01-01", to: "2027-01-31" });
    expect(shiftMonthRange("2024-03-01", -1)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(formatMonthLabel("2026-11-01")).toBe("novembro de 2026");
  });
});
