import { describe, expect, it, vi } from "vitest";
import { getAvailability, getLocations } from "./api";

const respond = (data: unknown) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

describe("API da reserva", () => {
  it("TK-10.02 RF-01: lê as unidades ativas com nome e fuso", async () => {
    const fetch = respond([{ code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" }]);
    await expect(getLocations()).resolves.toEqual([
      { code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" },
    ]);
    expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/locations");
  });

  it("TK-10.02 RF-01 RN-05: consulta a duração vigente sem parâmetro de tentativa", async () => {
    const fetch = respond({
      therapists: [],
      slots: [],
      waitlistSlots: [],
      sessionDurationMinutes: 35,
      spokenText: "Sem horários.",
    });
    const from = new Date("2026-11-03T15:00:00.000Z");
    const to = new Date("2026-11-24T15:00:00.000Z");
    await expect(getAvailability(from, to)).resolves.toMatchObject({ sessionDurationMinutes: 35 });
    const url = new URL(String(fetch.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/booking/availability");
    expect(url.searchParams.get("from")).toBe(from.toISOString());
    expect(url.searchParams.get("to")).toBe(to.toISOString());
    expect(url.searchParams.has("durationMinutes")).toBe(false);
  });
});
