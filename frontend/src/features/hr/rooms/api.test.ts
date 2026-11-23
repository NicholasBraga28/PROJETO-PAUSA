import { describe, expect, it, vi } from "vitest";
import { createRoom, getAdminLocations, getRooms, regenerateRoomToken } from "./api";

describe("API das salas do RH", () => {
  it("TK-12.02 RF-24: consulta as salas com filtros de unidade e status", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "room-1",
            name: "Sala 1",
            locationId: "location-1",
            locationCode: "SAO_PAULO",
            active: true,
            checkInToken: "secret-token",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getRooms({ locationCode: "SAO_PAULO", active: true })).resolves.toEqual([
      {
        id: "room-1",
        name: "Sala 1",
        locationId: "location-1",
        locationCode: "SAO_PAULO",
        active: true,
        checkInToken: "secret-token",
      },
    ]);

    const url = new URL(String(fetch.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/rooms");
    expect(url.searchParams.get("locationCode")).toBe("SAO_PAULO");
    expect(url.searchParams.get("active")).toBe("true");
  });

  it("TK-12.02 RF-24: consulta unidades administrativas com IDs e status", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "location-1",
            code: "SAO_PAULO",
            name: "São Paulo",
            timezone: "America/Sao_Paulo",
            active: true,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getAdminLocations()).resolves.toMatchObject([{ id: "location-1", active: true }]);
    expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/locations/admin");
  });

  it("TK-12.02 RF-24: cria uma sala somente com o nome e o ID de unidade recebidos", async () => {
    const room = {
      id: "room-1",
      name: "Sala 3",
      locationId: "location-1",
      locationCode: "SAO_PAULO",
      active: true,
      checkInToken: "secret-token",
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(room), { status: 201, headers: { "Content-Type": "application/json" } }),
      );

    await expect(createRoom({ name: "Sala 3", locationId: "location-1" })).resolves.toEqual(room);
    expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/rooms");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ name: "Sala 3", locationId: "location-1" });
  });

  it("TK-12.02 RF-24: regenera token pelo ID da sala e recebe somente o token novo", async () => {
    const result = {
      id: "room/one",
      name: "Sala 1",
      checkInToken: "new-token",
      updatedAt: "2026-11-03T12:00:00.000Z",
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    await expect(regenerateRoomToken("room/one")).resolves.toEqual(result);
    expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/rooms/room%2Fone/regenerate-token");
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("POST");
  });
});
