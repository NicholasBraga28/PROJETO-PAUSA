import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduleBlock, getActiveTherapists } from "./api";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/client", () => ({ request }));

describe("API de bloqueios do RH", () => {
  beforeEach(() => request.mockReset());

  it("TK-12.04 RF-23: carrega massoterapeutas ativos com perfil", async () => {
    request.mockResolvedValue([
      { id: "user-1", name: "Bruno Lima", role: "THERAPIST", status: "ACTIVE", therapistId: "therapist-1" },
      { id: "user-2", name: "Beatriz Lima", role: "EMPLOYEE", status: "ACTIVE", therapistId: null },
      { id: "user-3", name: "Elisa Rocha", role: "THERAPIST", status: "ACTIVE", therapistId: "therapist-2" },
    ]);

    await expect(getActiveTherapists()).resolves.toEqual([
      { id: "therapist-1", name: "Bruno Lima" },
      { id: "therapist-2", name: "Elisa Rocha" },
    ]);
    expect(request).toHaveBeenCalledWith("/users?role=THERAPIST&status=ACTIVE", expect.anything());
  });

  it("TK-12.04 RF-23 RN-08: cria bloqueio com massoterapeuta, período e motivo opcionais", async () => {
    const input = {
      therapistId: "therapist-1",
      startsAt: "2026-11-05T12:00:00.000Z",
      endsAt: "2026-11-05T13:00:00.000Z",
      reason: "Compromisso pessoal",
    };
    const created = {
      id: "block-1",
      ...input,
      createdById: "hr-1",
      createdAt: "2026-11-03T12:00:00.000Z",
    };
    request.mockResolvedValue(created);

    await expect(createScheduleBlock(input)).resolves.toEqual(created);
    expect(request).toHaveBeenCalledWith("/schedule-blocks", expect.anything(), {
      method: "POST",
      body: input,
    });
  });
});
