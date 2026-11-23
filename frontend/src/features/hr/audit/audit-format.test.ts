import { describe, expect, it } from "vitest";
import { nextDate, rangeToUtc, startOfLocalDateUtc } from "./audit-format";

describe("datas civis da auditoria", () => {
  it("TK-12.08 RF-22 RNF-05: converte o mês local em limites UTC e inclui o último dia", () => {
    expect(rangeToUtc("2026-11-01", "2026-11-30")).toEqual({
      from: "2026-11-01T03:00:00.000Z",
      to: "2026-12-01T03:00:00.000Z",
    });
  });

  it("TK-12.08 RF-22 RNF-05: calcula o limite seguinte em virada de ano", () => {
    expect(rangeToUtc("2026-12-01", "2026-12-31").to).toBe("2027-01-01T03:00:00.000Z");
  });

  it("TK-12.08 RF-22 RNF-05: mantém cada limite opcional como data civil local", () => {
    expect(startOfLocalDateUtc("2026-11-03")).toBe("2026-11-03T03:00:00.000Z");
    expect(startOfLocalDateUtc(nextDate("2026-11-30"))).toBe("2026-12-01T03:00:00.000Z");
  });
});
