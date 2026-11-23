import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuditEvents } from "./api";

const payload = {
  items: [
    {
      id: "00000000-0000-4000-8000-000000000011",
      actorId: null,
      action: "APPOINTMENT_CREATED",
      entityType: "Appointment",
      entityId: "00000000-0000-4000-8000-000000000012",
      createdAt: "2026-11-03T12:00:00.000Z",
      data: { status: "BOOKED" },
      spokenText: "Evento do sistema: Agendamento criado, registrado em 3 de novembro às 9h.",
    },
  ],
  nextCursor: null,
  spokenText: "1 evento de auditoria no período consultado.",
};

describe("cliente da auditoria", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.08 RF-22: envia os filtros e cursor sem perder o intervalo UTC", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    await getAuditEvents({
      from: "2026-11-01T03:00:00.000Z",
      to: "2026-12-01T03:00:00.000Z",
      appointmentId: "00000000-0000-4000-8000-000000000012",
      actorId: "00000000-0000-4000-8000-000000000013",
      action: "APPOINTMENT_CREATED",
      cursor: "00000000-0000-4000-8000-000000000014",
    });

    const url = new URL(String(fetch.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/audit-events");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: "2026-11-01T03:00:00.000Z",
      to: "2026-12-01T03:00:00.000Z",
      appointmentId: "00000000-0000-4000-8000-000000000012",
      actorId: "00000000-0000-4000-8000-000000000013",
      action: "APPOINTMENT_CREATED",
      cursor: "00000000-0000-4000-8000-000000000014",
    });
  });

  it("TK-12.08 RNF-04: rejeita campos não previstos no contrato da resposta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...payload, items: [{ ...payload.items[0], data: { email: "pessoa@example.com" } }] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(getAuditEvents({})).rejects.toThrow();
  });
});
