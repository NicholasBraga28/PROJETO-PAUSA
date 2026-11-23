import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import { dayOf } from "@/shared/time/local-time";
import { localDateTimeToIso } from "./local-schedule-time";
import SchedulesPage from "./SchedulesPage";
import { MemoryRouter } from "react-router";

const TODAY = dayOf(new Date());
const THERAPIST_ID = "therapist-1";
const ROOM_ID = "room-1";
const slot = {
  id: "schedule-1",
  therapistId: THERAPIST_ID,
  roomId: ROOM_ID,
  startsAt: localDateTimeToIso(TODAY, "09:00"),
  endsAt: localDateTimeToIso(TODAY, "10:00"),
  createdAt: "2026-11-03T12:00:00.000Z",
};

const createdSlot = {
  ...slot,
  id: "schedule-2",
  startsAt: localDateTimeToIso(TODAY, "11:00"),
  endsAt: localDateTimeToIso(TODAY, "12:00"),
};

function respond(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockScheduleApi(options: { empty?: boolean; conflictOnDelete?: boolean; failFirstLoad?: boolean } = {}) {
  const calls: Array<{ url: URL; method: string; body: unknown }> = [];
  let shouldFailFirstLoad = options.failFirstLoad ?? false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });

    if (url.pathname === "/api/schedules" && method === "GET") {
      if (shouldFailFirstLoad) {
        shouldFailFirstLoad = false;
        return respond({ message: "Falha temporária." }, 503);
      }
      return respond(options.empty ? [] : [slot]);
    }
    if (url.pathname === "/api/schedules" && method === "POST") return respond(createdSlot, 201);
    if (url.pathname === "/api/schedules/schedule-1" && method === "PATCH")
      return respond({ ...slot, roomId: "room-2" });
    if (url.pathname === "/api/schedules/schedule-1" && method === "DELETE") {
      if (options.conflictOnDelete) {
        return respond(
          {
            statusCode: 409,
            error: "Conflict",
            message: "Não é possível alterar ou remover este período pois já existem atendimentos agendados nele.",
            appointments: [
              {
                id: "appointment-1",
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                employee: { id: "employee-1", name: "Ana Souza" },
              },
            ],
          },
          409,
        );
      }
      return respond(undefined, 204);
    }
    if (url.pathname === "/api/schedules/copy" && method === "POST") {
      return respond(
        {
          created: [createdSlot],
          skipped: [
            {
              date: "2026-11-08",
              message: "A sala selecionada já está ocupada por outro período neste mesmo horário.",
            },
          ],
        },
        201,
      );
    }
    if (url.pathname === "/api/users") {
      return respond([
        {
          id: "user-1",
          email: "bruno@example.com",
          name: "Bruno Lima",
          role: "THERAPIST",
          status: "ACTIVE",
          therapistId: THERAPIST_ID,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    }
    if (url.pathname === "/api/rooms") {
      return respond([
        {
          id: ROOM_ID,
          name: "Sala 1",
          locationId: "location-1",
          locationCode: "SAO_PAULO",
          active: true,
          checkInToken: "secret",
        },
        {
          id: "room-2",
          name: "Sala 2",
          locationId: "location-1",
          locationCode: "SAO_PAULO",
          active: true,
          checkInToken: "secret-2",
        },
      ]);
    }
    if (url.pathname === "/api/locations/admin") {
      return respond([
        { id: "location-1", code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo", active: true },
      ]);
    }
    return respond({ message: "Rota de teste não simulada." }, 404);
  });
  return { calls, fetch };
}

describe("agenda diária do RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.03 RF-25 RN-08: mostra períodos ordenados com sala, unidade e horário falado", async () => {
    mockScheduleApi();
    const { container } = render(<SchedulesPage />, { wrapper: MemoryRouter });

    expect(await screen.findByRole("table", { name: "Períodos da agenda" })).toBeVisible();
    expect(screen.getByRole("row", { name: /Bruno Lima Sala 1 São Paulo/ })).toHaveTextContent("às 9h até 10h");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("TK-12.03 RF-25 RN-08: cria período somente depois de revisar e confirmar", async () => {
    const { calls } = mockScheduleApi({ empty: true });
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });
    await screen.findByText("Nenhum período encontrado para esta data.");

    await user.click(screen.getByRole("button", { name: "Adicionar período" }));
    const form = screen.getByRole("region", { name: "Adicionar período" });
    await user.click(within(form).getByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    await user.click(within(form).getByRole("button", { name: /Sala/ }));
    await user.click(await screen.findByRole("option", { name: "Sala 1" }));
    await user.type(screen.getByLabelText("Horário inicial"), "09:00");
    await user.type(screen.getByLabelText("Horário final"), "10:00");
    await user.click(within(form).getByRole("button", { name: "Revisar período" }));

    expect(screen.getByRole("alertdialog", { name: "Criar período de trabalho?" })).toBeVisible();
    expect(calls.some((call) => call.method === "POST" && call.url.pathname === "/api/schedules")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Confirmar criação" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.url.pathname === "/api/schedules")).toBe(true),
    );
    expect(calls.find((call) => call.method === "POST" && call.url.pathname === "/api/schedules")?.body).toEqual({
      therapistId: THERAPIST_ID,
      roomId: ROOM_ID,
      startsAt: localDateTimeToIso(TODAY, "09:00"),
      endsAt: localDateTimeToIso(TODAY, "10:00"),
    });
  });

  it("TK-12.03 RF-25 RN-08: edita horário sem enviar massoterapeuta, que não faz parte do PATCH", async () => {
    const { calls } = mockScheduleApi();
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });
    const table = await screen.findByRole("table", { name: "Períodos da agenda" });

    await user.click(within(table).getByRole("button", { name: /Editar período de Bruno Lima/ }));
    await user.clear(screen.getByLabelText("Horário inicial"));
    await user.type(screen.getByLabelText("Horário inicial"), "10:00");
    await user.clear(screen.getByLabelText("Horário final"));
    await user.type(screen.getByLabelText("Horário final"), "11:00");
    await user.click(screen.getByRole("button", { name: "Revisar período" }));
    await user.click(screen.getByRole("button", { name: "Confirmar alteração" }));

    await waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true));
    const update = calls.find((call) => call.method === "PATCH");
    expect(update?.body).toEqual({
      roomId: ROOM_ID,
      startsAt: localDateTimeToIso(TODAY, "10:00"),
      endsAt: localDateTimeToIso(TODAY, "11:00"),
    });
    expect(update?.body).not.toHaveProperty("therapistId");
  });

  it("TK-12.03 RF-25: exige confirmação antes de remover período", async () => {
    const { calls } = mockScheduleApi();
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });
    const table = await screen.findByRole("table", { name: "Períodos da agenda" });

    await user.click(within(table).getByRole("button", { name: /Remover período de Bruno Lima/ }));
    expect(screen.getByRole("alertdialog", { name: "Remover período de trabalho?" })).toBeVisible();
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Confirmar remoção" }));
    await waitFor(() => expect(calls.some((call) => call.method === "DELETE")).toBe(true));
  });

  it("TK-12.03 RF-25: lista os atendimentos do backend quando impedem alteração ou remoção", async () => {
    mockScheduleApi({ conflictOnDelete: true });
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });
    const table = await screen.findByRole("table", { name: "Períodos da agenda" });
    await user.click(within(table).getByRole("button", { name: /Remover período de Bruno Lima/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar remoção" }));

    expect(await screen.findByRole("heading", { name: "Atendimentos que impedem a alteração" })).toBeVisible();
    expect(screen.getByText(/Ana Souza/)).toBeVisible();
    expect(
      screen.getByText("Não é possível alterar ou remover este período pois já existem atendimentos agendados nele."),
    ).toBeVisible();
  });

  it("TK-12.03 RF-26 RN-08: envia destinos escolhidos e mostra cada data ignorada", async () => {
    const { calls } = mockScheduleApi({ empty: true });
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });
    await screen.findByText("Nenhum período encontrado para esta data.");

    await user.type(screen.getByLabelText("Data de destino"), "2026-11-06");
    await user.click(screen.getByRole("button", { name: "Adicionar data" }));
    await user.click(screen.getByRole("button", { name: "Revisar cópia" }));
    expect(screen.getByRole("alertdialog", { name: "Copiar agenda para estas datas?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirmar cópia" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.url.pathname === "/api/schedules/copy")).toBe(true),
    );
    expect(calls.find((call) => call.url.pathname === "/api/schedules/copy")?.body).toEqual({
      sourceDate: TODAY,
      targetDates: ["2026-11-06"],
    });
    expect(await screen.findByRole("region", { name: "Resultado da cópia" })).toHaveTextContent(
      "1 período criado; 1 data ignorada.",
    );
    expect(screen.getByRole("list", { name: "Datas ignoradas pela cópia" })).toHaveTextContent(
      "domingo, 8 de novembro de 2026: A sala selecionada já está ocupada",
    );
  });

  it("TK-12.03 RF-26 RN-08: não envia cópia sem destinos válidos", async () => {
    const { calls } = mockScheduleApi({ empty: true });
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });
    await screen.findByText("Nenhum período encontrado para esta data.");

    await user.click(screen.getByRole("button", { name: "Revisar cópia" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Adicione ao menos uma data de destino.");
    await waitFor(() => expect(error).toHaveFocus());
    expect(calls.some((call) => call.url.pathname === "/api/schedules/copy")).toBe(false);
  });

  it("TK-12.03 RF-25: anuncia erro de consulta, move o foco e permite tentar novamente", async () => {
    const { fetch } = mockScheduleApi({ failFirstLoad: true });
    const user = userEvent.setup();
    render(<SchedulesPage />, { wrapper: MemoryRouter });

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("O servidor não conseguiu atender o pedido.");
    await waitFor(() => expect(error).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("table", { name: "Períodos da agenda" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(8);
  });
});
