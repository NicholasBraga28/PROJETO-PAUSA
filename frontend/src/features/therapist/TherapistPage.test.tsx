import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Announcer } from "@/shared/a11y/Announcer";
import { expectAccessible } from "@/test/axe";
import TherapistPage from "./TherapistPage";
import { getAgenda, getNotifications, markNotificationAsRead } from "./api";

vi.mock("./api", () => ({ getAgenda: vi.fn(), getNotifications: vi.fn(), markNotificationAsRead: vi.fn() }));

const appointment = (id: string, firstName: string, spokenTime: string, roomName: string, spokenStatus: string) => ({
  id,
  startsAt: `2026-11-03T${spokenTime === "às 9h" ? "12:00" : "13:00"}:00.000Z`,
  endsAt: "2026-11-03T13:20:00.000Z",
  spokenTime,
  status: "CONFIRMED" as const,
  spokenStatus,
  employee: { firstName },
  room: { name: roomName },
  checkedInAt: null,
  actions: [],
  spokenText: `${spokenTime}, ${firstName}, ${roomName}, ${spokenStatus}.`,
});

const agenda = {
  date: "2026-11-03",
  isToday: true,
  current: null,
  next: appointment("appointment-1", "Ana", "às 9h", "Sala 2", "confirmada"),
  remainingCount: 2,
  items: [
    appointment("appointment-1", "Ana", "às 9h", "Sala 2", "confirmada"),
    appointment("appointment-2", "Bia", "às 10h", "Sala 1", "chegou"),
  ],
  spokenText: "Hoje, 2 atendimentos. Próximo: Ana, às 9h.",
};

const getAgendaMock = vi.mocked(getAgenda);
const renderTherapistPage = () =>
  render(
    <MemoryRouter>
      <Announcer>
        <TherapistPage />
      </Announcer>
    </MemoryRouter>,
  );

describe("tela do massoterapeuta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getNotifications).mockResolvedValue({ items: [], nextCursor: null, spokenText: "Você não tem avisos." });
    vi.mocked(markNotificationAsRead).mockResolvedValue({
      id: "notice-1",
      readAt: "2026-11-03T12:00:00.000Z",
      spokenText: "Aviso marcado como lido.",
    });
  });

  it("TK-11.01 RF-30 RF-10 RF-11: organiza as regiões, preserva a ordem e apresenta os dados falados da API", async () => {
    getAgendaMock.mockResolvedValue(agenda);
    const { container } = renderTherapistPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Agenda do massoterapeuta" })).toBeVisible();
    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => region.getAttribute("aria-labelledby"))).toEqual([
      "therapist-now-heading",
      "therapist-next-heading",
      "therapist-agenda-heading",
      "therapist-actions-heading",
      "therapist-block-heading",
      "therapist-notifications-heading",
    ]);
    expect(screen.getByRole("link", { name: "Ir para Agora" })).toHaveAttribute("href", "#therapist-now");
    expect(screen.getByRole("link", { name: "Ir para Próximo" })).toHaveAttribute("href", "#therapist-next");
    expect(screen.getByRole("link", { name: "Ir para Agenda de hoje" })).toHaveAttribute("href", "#therapist-agenda");
    expect(screen.getByRole("link", { name: "Ir para Atendimentos" })).toHaveAttribute("href", "#therapist-actions");
    expect(screen.getByRole("link", { name: "Ir para Avisos" })).toHaveAttribute("href", "#therapist-notifications");
    expect(screen.getByRole("link", { name: "Ir para Horários" })).toHaveAttribute("href", "#therapist-block");
    expect(screen.getByText(agenda.spokenText)).toBeVisible();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(agenda.spokenText));
    await userEvent.setup().click(screen.getByRole("link", { name: "Ir para Agenda de hoje" }));
    expect(screen.getByRole("region", { name: "Agenda de hoje" })).toHaveFocus();

    const list = screen.getByRole("list", { name: "Atendimentos de hoje" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const firstAppointment = items.at(0);
    const secondAppointment = items.at(1);
    if (!firstAppointment || !secondAppointment) throw new Error("Dois atendimentos eram esperados.");
    expect(within(firstAppointment).getByText("Horário")).toBeVisible();
    expect(within(firstAppointment).getByText("às 9h")).toBeVisible();
    expect(within(firstAppointment).getByText("Ana")).toBeVisible();
    expect(within(firstAppointment).getByText("Sala 2")).toBeVisible();
    expect(within(firstAppointment).getByText("confirmada")).toBeVisible();
    expect(within(secondAppointment).getByText("às 10h")).toBeVisible();
    expect(within(secondAppointment).getByText("Bia")).toBeVisible();
    expect(within(secondAppointment).getByText("Sala 1")).toBeVisible();
    expect(within(secondAppointment).getByText("chegou")).toBeVisible();
    expect(within(list).queryByText("Ana Souza")).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("TK-11.01 RF-30: mantém as regiões da tela e anuncia o texto de agenda vazia devolvido pela API", async () => {
    getAgendaMock.mockResolvedValue({
      ...agenda,
      current: null,
      next: null,
      remainingCount: 0,
      items: [],
      spokenText: "Você não tem atendimentos hoje.",
    });
    const { container } = renderTherapistPage();

    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(6));
    const agendaRegion = screen.getByRole("region", { name: "Agenda de hoje" });
    expect(await within(agendaRegion).findByText("Você não tem atendimentos hoje.")).toBeVisible();
    expect(screen.getAllByRole("region")).toHaveLength(6);
    expect(screen.getByRole("list", { name: "Atendimentos de hoje" })).toBeEmptyDOMElement();
    await expectAccessible(container);
  });

  it("TK-11.01 RF-30: apresenta orientação compreensível e opção de tentar novamente após erro", async () => {
    getAgendaMock.mockRejectedValueOnce(new Error("A agenda não pôde ser carregada."));
    const user = userEvent.setup();
    renderTherapistPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("A agenda não pôde ser carregada.");
    getAgendaMock.mockResolvedValue(agenda);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await within(screen.getByRole("region", { name: "Agenda de hoje" })).findByText(agenda.spokenText),
    ).toBeVisible();
  });
});
