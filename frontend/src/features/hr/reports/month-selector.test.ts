import { describe, expect, it } from "vitest";
import { formatMonthLabel, shiftMonthRange } from "./report-format";

describe("seletor mensal do relatório", () => {
  it("TK-12.07 RF-21 RNF-05: navega entre meses, incluindo virada de ano e ano bissexto", () => {
    expect(shiftMonthRange("2026-11-01", -1)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(shiftMonthRange("2026-12-01", 1)).toEqual({ from: "2027-01-01", to: "2027-01-31" });
    expect(shiftMonthRange("2024-03-01", -1)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(formatMonthLabel("2026-11-01")).toBe("novembro de 2026");
  });
});
