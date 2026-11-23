import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { identify } from "@/shared/api/client";
import {
  cancelAppointment,
  createScheduleBlock,
  finishAppointment,
  getNotifications,
  markNotificationAsRead,
  markNoShow,
  previewScheduleBlock,
  startAppointment,
} from "./api";

const blockInput = { startsAt: "2026-11-03T12:00:00.000Z", endsAt: "2026-11-03T13:00:00.000Z", reason: "Pausa" };

describe("API de ações do massoterapeuta", () => {
  beforeEach(() => {
    identify("therapist-demo");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const path = String(input);
        const body = path.endsWith("/cancel")
          ? { appointmentId: "appointment-1", status: "CANCELLED", spokenText: "Atendimento cancelado." }
          : path.endsWith("/preview")
            ? { confirmationText: "Bloquear das 9h às 10h. Confirma?" }
            : path.endsWith("/schedule-blocks")
              ? { id: "block-1", ...blockInput, reason: "Pausa", spokenText: "Horário bloqueado." }
              : { spokenText: "Ação concluída." };
        return new Response(JSON.stringify(body), {
          status: path.endsWith("/schedule-blocks") ? 201 : 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    identify(null);
    vi.unstubAllGlobals();
  });

  it("TK-11.02 RF-12 RF-13 RF-14 RF-32 RF-33: envia as mutações ao endpoint do massoterapeuta com cabeçalho e corpo corretos", async () => {
    await startAppointment("appointment/1");
    await finishAppointment("appointment-1");
    await cancelAppointment("appointment-1");
    await markNoShow("appointment-1");
    await previewScheduleBlock(blockInput);
    await createScheduleBlock(blockInput);

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([input]) => String(input))).toEqual([
      "/api/therapists/me/appointments/appointment%2F1/start",
      "/api/therapists/me/appointments/appointment-1/finish",
      "/api/therapists/me/appointments/appointment-1/cancel",
      "/api/therapists/me/appointments/appointment-1/no-show",
      "/api/therapists/me/schedule-blocks/preview",
      "/api/therapists/me/schedule-blocks",
    ]);
    expect(calls.every(([, init]) => init?.method === "POST")).toBe(true);
    expect(calls[0]?.[1]?.headers).toEqual({ "x-user-id": "therapist-demo" });
    expect(JSON.parse(String(calls[4]?.[1]?.body))).toEqual(blockInput);
    expect(JSON.parse(String(calls[5]?.[1]?.body))).toEqual(blockInput);
  });

  it("TK-11.03 RF-31: consulta avisos com paginação e valida o contrato do feed", async () => {
    const response = {
      items: [
        {
          id: "notification-1",
          appointmentId: "appointment-1",
          kind: "EMPLOYEE_CHECKED_IN",
          status: "SENT",
          scheduledFor: "2026-11-03T12:00:00.000Z",
          readAt: null,
          spokenText: "Ana chegou.",
        },
      ],
      nextCursor: "cursor/1",
      spokenText: "Você tem 1 aviso.",
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      getNotifications({ since: "2026-11-03T12:00:00.000Z", cursor: "cursor/1", limit: 25 }),
    ).resolves.toEqual(response);
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe(
      "/api/notifications?since=2026-11-03T12%3A00%3A00.000Z&cursor=cursor%2F1&limit=25",
    );
  });

  it("TK-11.03 RF-31: marca aviso como lido no endpoint codificado e retorna o texto falado", async () => {
    const response = {
      id: "notification/1",
      readAt: "2026-11-03T12:01:00.000Z",
      spokenText: "Aviso marcado como lido.",
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(markNotificationAsRead("notification/1")).resolves.toEqual(response);
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe("/api/notifications/notification%2F1/read");
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.method).toBe("POST");
  });
});
