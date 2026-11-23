import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAlexaPairingCode, getActiveTherapists } from "./api";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/client", () => ({ request }));

describe("API de pareamento da Alexa", () => {
  beforeEach(() => request.mockReset());

  it("TK-12.06 RF-17: carrega apenas massoterapeutas ativos com perfil", async () => {
    request.mockResolvedValue([
      {
        id: "user-1",
        email: "bruno@example.com",
        name: "Bruno Lima",
        role: "THERAPIST",
        status: "ACTIVE",
        therapistId: "therapist-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "user-2",
        email: "ana@example.com",
        name: "Ana Souza",
        role: "EMPLOYEE",
        status: "ACTIVE",
        therapistId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(getActiveTherapists()).resolves.toEqual([{ id: "therapist-1", name: "Bruno Lima" }]);
    expect(request).toHaveBeenCalledWith("/users?role=THERAPIST&status=ACTIVE", expect.anything());
  });

  it("TK-12.06 RF-17 D-18: gera código pelo massoterapeuta escolhido e valida seis dígitos e validade", async () => {
    const response = { code: "004821", therapistId: "therapist-1", expiresAt: "2026-11-03T18:00:00.000Z" };
    request.mockResolvedValue(response);

    await expect(generateAlexaPairingCode("therapist-1")).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith("/therapists/therapist-1/alexa-pairing-code", expect.anything(), {
      method: "POST",
    });
  });

  it("TK-12.06 RF-17 D-18: rejeita resposta sem código numérico de seis dígitos", async () => {
    request.mockResolvedValue({ code: "4821", therapistId: "therapist-1", expiresAt: "2026-11-03T18:00:00.000Z" });

    await expect(generateAlexaPairingCode("therapist-1")).rejects.toThrow();
  });
});
