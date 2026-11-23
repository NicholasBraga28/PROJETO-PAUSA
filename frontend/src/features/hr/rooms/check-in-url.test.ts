import { describe, expect, it } from "vitest";
import { checkInUrl } from "./check-in-url";

describe("checkInUrl", () => {
  it("TK-12.02 RF-24 RNF-04: cria o link do check-in na origem atual sem usar serviço externo", () => {
    expect(checkInUrl("room-token", "https://pausa.example.com")).toBe("https://pausa.example.com/check-in/room-token");
  });

  it("TK-12.02 RF-24 RNF-04: codifica o token como segmento único do caminho", () => {
    expect(checkInUrl("room/token", "https://pausa.example.com")).toBe(
      "https://pausa.example.com/check-in/room%2Ftoken",
    );
  });
});
