import { describe, expect, it } from "vitest";
import { localBlockDateTimeToIso, spokenBlockPeriod } from "./block-time";

describe("data e hora local dos bloqueios", () => {
  it("TK-12.04 RF-23 RN-08: converte data/hora local de São Paulo para ISO UTC", () => {
    expect(localBlockDateTimeToIso("2026-11-05T09:00")).toBe("2026-11-05T12:00:00.000Z");
  });

  it("TK-12.04 RF-23 RN-08: apresenta período na data e horário falados de São Paulo", () => {
    expect(spokenBlockPeriod("2026-11-05T12:00:00.000Z", "2026-11-05T13:00:00.000Z")).toBe(
      "quinta-feira, 5 de novembro, das 9h às 10h",
    );
  });
});
