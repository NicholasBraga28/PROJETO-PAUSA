import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Announcer } from "@/shared/a11y/Announcer";
import { expectAccessible } from "@/test/axe";
import type { TherapistAgenda, TherapistAgendaItem, TherapistNotification } from "@/shared/api/schemas";
import TherapistNotifications from "./TherapistNotifications";
import { getNotifications, markNotificationAsRead } from "./api";

vi.mock("./api", () => ({
  getNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
}));

const notification = (id: string, spokenText: string, appointmentId: string | null = null): TherapistNotification => ({
  id,
  appointmentId,
  kind: "EMPLOYEE_CHECKED_IN" as const,
  status: "SENT" as const,
  scheduledFor: "2026-11-03T12:00:00.000Z",
  readAt: null,
  spokenText,
});

const feed = (items: ReturnType<typeof notification>[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
  spokenText: items.length ? `Você tem ${items.length} avisos.` : "Você não tem avisos.",
});

const agenda: TherapistAgenda = {
  date: "2026-11-03",
  isToday: true,
  current: null,
  next: null,
  remainingCount: 0,
  items: [],
  spokenText: "Você não tem atendimentos hoje.",
};

const api = {
  getNotifications: vi.mocked(getNotifications),
  markNotificationAsRead: vi.mocked(markNotificationAsRead),
};
const renderNotifications = (pollIntervalMs = 5_000, therapistAgenda = agenda) =>
  render(
    <Announcer>
      <TherapistNotifications agenda={therapistAgenda} pollIntervalMs={pollIntervalMs} />
    </Announcer>,
  );

describe("avisos do massoterapeuta", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.setSystemTime(new Date("2026-11-03T12:00:00.000Z"));
    vi.resetAllMocks();
  });

  it("TK-11.03 RF-31: carrega e apresenta o histórico como lista com estado lido e texto falado da API", async () => {
    const arrival = notification("notice-1", "Ana chegou para o atendimento de hoje, às 9h.");
    api.getNotifications.mockResolvedValue(feed([arrival]));
    const { container } = renderNotifications();

    expect(await screen.findByRole("region", { name: "Avisos" })).toBeVisible();
    const list = await screen.findByRole("list", { name: "Histórico de avisos" });
    expect(within(list).getByText(arrival.spokenText)).toBeVisible();
    expect(within(list).getByText(/Não lido/)).toBeVisible();
    await waitFor(() => expect(container.querySelector('[role="status"]')).toHaveTextContent("Você tem 1 avisos."));
    await expectAccessible(container);
  });

  it("TK-11.03 RF-31 D-07: consulta periodicamente, anuncia aviso novo uma vez e não duplica IDs repetidos", async () => {
    const first = notification("notice-1", "Ana chegou às 9h.");
    const second = notification("notice-2", "Bia chegou às 10h.");
    api.getNotifications
      .mockResolvedValueOnce(feed([first]))
      .mockResolvedValueOnce(feed([first, second]))
      .mockResolvedValueOnce(feed([first, second]));
    vi.useFakeTimers();
    const { container } = renderNotifications(5_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText(first.spokenText)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_020);
    });
    expect(
      within(screen.getByRole("list", { name: "Histórico de avisos" })).getByText(second.spokenText),
    ).toBeVisible();
    expect(document.querySelector('[role="status"]')).toHaveTextContent(second.spokenText);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(within(screen.getByRole("list", { name: "Histórico de avisos" })).getAllByRole("listitem")).toHaveLength(2);
    expect(api.getNotifications).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[aria-live="assertive"]')).toBeEmptyDOMElement();
  });

  it("TK-11.03 RF-31: anuncia como urgente somente aviso ligado ao atendimento atual ou próximo", async () => {
    const urgent = {
      ...notification("notice-urgent", "Possível ausência no atendimento de Ana.", "appointment-current"),
      kind: "POSSIBLE_NO_SHOW" as const,
    };
    api.getNotifications.mockResolvedValueOnce(feed([])).mockResolvedValue(feed([urgent]));
    vi.useFakeTimers();
    renderNotifications(5_000, {
      ...agenda,
      current: {
        id: "appointment-current",
        startsAt: "2026-11-03T12:00:00.000Z",
        endsAt: "2026-11-03T12:20:00.000Z",
        spokenTime: "às 9h",
        status: "IN_PROGRESS",
        spokenStatus: "em andamento",
        employee: { firstName: "Ana" },
        room: { name: "Sala 2" },
        checkedInAt: "2026-11-03T12:00:00.000Z",
        actions: [],
        spokenText: "Ana, às 9h, em andamento.",
      } satisfies TherapistAgendaItem,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_020);
    });

    expect(within(screen.getByRole("region", { name: "Avisos" })).getByText(urgent.spokenText)).toBeVisible();
    expect(document.querySelector('[aria-live="assertive"]')).toHaveTextContent(urgent.spokenText);
    expect(document.querySelector('[aria-live="polite"]')).not.toHaveTextContent(urgent.spokenText);
  });

  it("TK-11.03 RF-31: marca aviso como lido sem removê-lo nem mover o foco", async () => {
    const arrival = notification("notice-1", "Ana chegou às 9h.");
    api.getNotifications.mockResolvedValue(feed([arrival]));
    api.markNotificationAsRead.mockResolvedValue({
      id: arrival.id,
      readAt: "2026-11-03T12:01:00.000Z",
      spokenText: "Aviso marcado como lido.",
    });
    const user = userEvent.setup();
    renderNotifications();
    const markAsRead = await screen.findByRole("button", { name: `Marcar como lido: ${arrival.spokenText}` });
    await user.click(markAsRead);

    expect(api.markNotificationAsRead).toHaveBeenCalledWith(arrival.id);
    expect(await screen.findByRole("button", { name: "Lido. Aviso: " + arrival.spokenText })).toBeVisible();
    expect(screen.getByText(arrival.spokenText)).toBeVisible();
    expect(screen.getByRole("button", { name: "Lido. Aviso: " + arrival.spokenText })).toHaveFocus();
    await waitFor(() =>
      expect(document.querySelector('[role="status"]')).toHaveTextContent("Aviso marcado como lido."),
    );
  });

  it("TK-11.03 RF-31: permite carregar a próxima página sem duplicar avisos já recebidos", async () => {
    const first = notification("notice-1", "Ana chegou às 9h.");
    const second = notification("notice-2", "Bia chegou às 10h.");
    api.getNotifications.mockResolvedValueOnce(feed([first], "notice-1")).mockResolvedValueOnce(feed([first, second]));
    const user = userEvent.setup();
    renderNotifications();
    await screen.findByText(first.spokenText);
    await user.click(screen.getByRole("button", { name: "Carregar mais avisos" }));

    const list = screen.getByRole("list", { name: "Histórico de avisos" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText(second.spokenText)).toBeVisible();
  });

  it("TK-11.03 RF-31: mantém histórico durante falha periódica e não repete anúncio de erro", async () => {
    const arrival = notification("notice-1", "Ana chegou às 9h.");
    api.getNotifications
      .mockResolvedValueOnce(feed([arrival]))
      .mockRejectedValue(new Error("Sem conexão com a internet."));
    vi.useFakeTimers();
    renderNotifications(5_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText(arrival.spokenText)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_020);
    });

    expect(screen.getByText(arrival.spokenText)).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Avisos" })).getByText("Sem conexão com a internet."),
    ).toBeVisible();
    expect(document.querySelector('[role="status"]')?.textContent?.match(/Sem conexão/g)).toHaveLength(1);
    expect(api.getNotifications).toHaveBeenCalledTimes(3);
  });

  it("TK-11.03 RF-31: mostra erro inicial e permite tentar novamente sem anunciar lista vazia", async () => {
    api.getNotifications
      .mockRejectedValueOnce(new Error("Não foi possível carregar os avisos."))
      .mockResolvedValue(feed([]));
    const user = userEvent.setup();
    renderNotifications();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os avisos.");
    await user.click(screen.getByRole("button", { name: "Tentar atualizar avisos" }));

    expect(
      await within(screen.getByRole("region", { name: "Avisos" })).findByText("Você não tem avisos."),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
