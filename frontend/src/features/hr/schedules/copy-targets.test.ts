import { describe, expect, it } from "vitest";
import { validateCopyTargets } from "./copy-targets";

describe("validação das datas de cópia da agenda", () => {
  it("TK-12.03 RF-26 RN-08: exige pelo menos uma data de destino", () => {
    expect(validateCopyTargets("2026-11-05", [], "2026-11-03")).toBe("Adicione ao menos uma data de destino.");
  });

  it("TK-12.03 RF-26 RN-08: aceita até 31 datas futuras distintas", () => {
    expect(validateCopyTargets("2026-11-05", ["2026-11-06", "2026-11-07"], "2026-11-03")).toBeNull();
  });

  it("TK-12.03 RF-26 RN-08: rejeita data passada ou igual a hoje", () => {
    expect(validateCopyTargets("2026-11-05", ["2026-11-03"], "2026-11-03")).toBe("Escolha somente datas futuras.");
  });

  it("TK-12.03 RF-26 RN-08: rejeita data de origem e destinos repetidos", () => {
    expect(validateCopyTargets("2026-11-05", ["2026-11-05"], "2026-11-03")).toBe(
      "As datas de destino devem ser únicas e diferentes da origem.",
    );
    expect(validateCopyTargets("2026-11-05", ["2026-11-06", "2026-11-06"], "2026-11-03")).toBe(
      "As datas de destino devem ser únicas e diferentes da origem.",
    );
  });

  it("TK-12.03 RF-26 RN-08: limita a cópia a 31 datas", () => {
    const targets = Array.from({ length: 32 }, (_, index) => `2026-12-${String(index + 1).padStart(2, "0")}`);
    expect(validateCopyTargets("2026-11-05", targets, "2026-11-03")).toBe("Escolha no máximo 31 datas.");
  });
});
