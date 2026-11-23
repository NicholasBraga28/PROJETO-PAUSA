import { describe, expect, it } from "vitest";
import { waitlistDateTime, waitlistPeriod } from "./date-time";

describe("TK-10.04 RN-10: horários da lista de espera", () => {
  it("TK-10.04 RN-10: apresenta o prazo em texto no fuso de São Paulo sem contagem regressiva", () => {
    expect(waitlistDateTime("2026-11-09T12:30:00.000Z")).toBe("segunda-feira, 9 de novembro, às 9h30");
  });

  it("TK-10.04 RF-04: apresenta o início e o fim do período desejado", () => {
    expect(waitlistPeriod("2026-11-10T17:00:00.000Z", "2026-11-10T17:20:00.000Z")).toBe(
      "terça-feira, 10 de novembro, das 14h às 14h20",
    );
  });
});
