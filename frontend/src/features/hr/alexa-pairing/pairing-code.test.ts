import { describe, expect, it } from "vitest";
import { spokenPairingExpiry, spacedPairingDigits } from "./pairing-code";

describe("apresentação acessível do código de pareamento", () => {
  it("TK-12.06 RF-17 D-18: separa dígitos sem remover zeros iniciais", () => {
    expect(spacedPairingDigits("004821")).toBe("0, 0, 4, 8, 2, 1");
  });

  it("TK-12.06 RF-17 D-18: apresenta validade no horário de São Paulo", () => {
    expect(spokenPairingExpiry("2026-11-03T18:00:00.000Z")).toBe("terça-feira, 3 de novembro de 2026, às 15h");
  });
});
