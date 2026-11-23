import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copySchedules,
  createSchedule,
  deleteSchedule,
  getRooms,
  getSchedules,
  getTherapists,
  updateSchedule,
} from "./api";

const slot = {
  id: "slot-1",
  therapistId: "therapist-1",
  roomId: "room-1",
  startsAt: "2026-11-05T12:00:00.000Z",
  endsAt: "2026-11-05T13:00:00.000Z",
  createdAt: "2026-11-03T12:00:00.000Z",
};

function respond(data: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("API da agenda do RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.03 RF-25 RN-08: consulta a data e filtros opcionais da agenda", async () => {
    const fetch = respond([slot]);
    await expect(
      getSchedules({ date: "2026-11-05", locationCode: "SAO_PAULO", therapistId: "therapist-1", roomId: "room-1" }),
    ).resolves.toEqual([slot]);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "/api/schedules?date=2026-11-05&locationCode=SAO_PAULO&therapistId=therapist-1&roomId=room-1",
    );
  });

  it("TK-12.03 RF-25: carrega apenas massoterapeutas ativos com perfil", async () => {
    const fetch = respond([
      {
        id: "user-1",
        email: "a@example.com",
        name: "Ana Silva",
        role: "THERAPIST",
        status: "ACTIVE",
        therapistId: "therapist-1",
        createdAt: "2026-01-01",
      },
      {
        id: "user-2",
        email: "b@example.com",
        name: "Bia Lima",
        role: "THERAPIST",
        status: "ACTIVE",
        therapistId: null,
        createdAt: "2026-01-01",
      },
    ]);
    await expect(getTherapists()).resolves.toEqual([{ id: "therapist-1", name: "Ana Silva" }]);
    expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/users?role=THERAPIST&status=ACTIVE");
  });

  it("TK-12.03 RF-25: carrega salas ativas sem manter tokens de check-in no cliente", async () => {
    respond([
      {
        id: "room-1",
        name: "Sala 1",
        locationId: "location-1",
        locationCode: "SAO_PAULO",
        active: true,
        checkInToken: "secret",
      },
    ]);
    await expect(getRooms()).resolves.toEqual([
      { id: "room-1", name: "Sala 1", locationId: "location-1", locationCode: "SAO_PAULO", active: true },
    ]);
  });

  it("TK-12.03 RF-25 RN-08: cria um período com timestamps ISO", async () => {
    const fetch = respond(slot, 201);
    await createSchedule({
      therapistId: "therapist-1",
      roomId: "room-1",
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
    expect(fetch).toHaveBeenCalledWith("/api/schedules", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      therapistId: "therapist-1",
      roomId: "room-1",
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
  });

  it("TK-12.03 RF-25 RN-08: edita apenas sala e horários do período", async () => {
    const fetch = respond({ ...slot, roomId: "room-2" });
    await updateSchedule("slot-1", { roomId: "room-2", startsAt: slot.startsAt, endsAt: slot.endsAt });
    expect(fetch).toHaveBeenCalledWith("/api/schedules/slot-1", expect.objectContaining({ method: "PATCH" }));
  });

  it("TK-12.03 RF-25: remove um período pelo identificador e aceita HTTP 204", async () => {
    const fetch = respond(undefined, 204);
    await expect(deleteSchedule("slot-1")).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/api/schedules/slot-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("TK-12.03 RF-26 RN-08: envia datas de destino explícitas e o massoterapeuta opcional", async () => {
    const response = { created: [slot], skipped: [{ date: "2026-11-07", message: "Conflito de agenda." }] };
    const fetch = respond(response, 201);
    await expect(
      copySchedules({
        sourceDate: "2026-11-05",
        targetDates: ["2026-11-06", "2026-11-07"],
        therapistId: "therapist-1",
      }),
    ).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith(
      "/api/schedules/copy",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sourceDate: "2026-11-05",
          targetDates: ["2026-11-06", "2026-11-07"],
          therapistId: "therapist-1",
        }),
      }),
    );
  });
});
