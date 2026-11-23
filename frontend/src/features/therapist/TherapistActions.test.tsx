import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Announcer } from "@/shared/a11y/Announcer";
import { expectAccessible } from "@/test/axe";
import type { TherapistAgenda } from "@/shared/api/schemas";
import TherapistActions from "./TherapistActions";
import {
  cancelAppointment,
  createScheduleBlock,
  finishAppointment,
  getAgenda,
  markNoShow,
  previewScheduleBlock,
  startAppointment,
} from "./api";

vi.mock("./api", () => ({
  cancelAppointment: vi.fn(),
  createScheduleBlock: vi.fn(),
  finishAppointment: vi.fn(),
  getAgenda: vi.fn(),
  markNoShow: vi.fn(),
  previewScheduleBlock: vi.fn(),
  startAppointment: vi.fn(),
}));

const item = {
  id: "appointment-1",
  startsAt: "2026-11-03T12:00:00.000Z",
  endsAt: "2026-11-03T12:20:00.000Z",
  spokenTime: "às 9h",
  status: "CONFIRMED" as const,
  spokenStatus: "confirmada",
  employee: { firstName: "Ana" },
  room: { name: "Sala 2" },
  checkedInAt: null,
  actions: [
    { kind: "START" as const },
    { kind: "CANCEL" as const, confirmationText: "Cancelar o atendimento de Ana às 9h. Confirma?" },
  ],
  spokenText: "às 9h, Ana, Sala 2, confirmada.",
};

const agenda = {
  date: "2026-11-03",
  isToday: true,
  current: null,
  next: item,
  remainingCount: 1,
  items: [item],
  spokenText: "Hoje, 1 atendimento.",
} satisfies TherapistAgenda;
const api = {
  cancelAppointment: vi.mocked(cancelAppointment),
  createScheduleBlock: vi.mocked(createScheduleBlock),
  finishAppointment: vi.mocked(finishAppointment),
  getAgenda: vi.mocked(getAgenda),
  markNoShow: vi.mocked(markNoShow),
  previewScheduleBlock: vi.mocked(previewScheduleBlock),
  startAppointment: vi.mocked(startAppointment),
};
const renderActions = () =>
  render(
    <Announcer>
      <TherapistActions agenda={agenda} onAgendaRefresh={vi.fn()} />
    </Announcer>,
  );

describe("ações da agenda do massoterapeuta", () => {
  beforeEach(() => vi.resetAllMocks());

  it("TK-11.02 RF-32 RF-14: inicia sem confirmação, anuncia o resultado e atualiza a agenda", async () => {
    api.startAppointment.mockResolvedValue({ spokenText: "Sessão com Ana iniciada." });
    api.getAgenda.mockResolvedValue(agenda);
    const user = userEvent.setup();
    const onAgendaRefresh = vi.fn();
    render(
      <Announcer>
        <TherapistActions agenda={agenda} onAgendaRefresh={onAgendaRefresh} />
      </Announcer>,
    );

    await user.click(screen.getByRole("button", { name: "Iniciar atendimento de Ana, às 9h" }));

    expect(api.startAppointment).toHaveBeenCalledWith("appointment-1");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sessão com Ana iniciada."));
    expect(onAgendaRefresh).toHaveBeenCalledWith(agenda);
  });

  it("TK-11.02 RF-32: anuncia progresso e evita envio duplicado sem perder o foco do botão", async () => {
    let resolveAction: (result: { spokenText: string }) => void = () => {};
    api.startAppointment.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    api.getAgenda.mockResolvedValue(agenda);
    const user = userEvent.setup();
    renderActions();
    const start = screen.getByRole("button", { name: "Iniciar atendimento de Ana, às 9h" });
    await user.click(start);

    expect(await screen.findByRole("status")).toHaveTextContent("Iniciando atendimento de Ana, às 9h.");
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(start).toHaveFocus();
    await user.click(start);
    expect(api.startAppointment).toHaveBeenCalledOnce();
    resolveAction({ spokenText: "Sessão com Ana iniciada." });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sessão com Ana iniciada."));
  });

  it("TK-11.02 RF-32 RF-14: finaliza sem confirmação e anuncia o resultado", async () => {
    api.finishAppointment.mockResolvedValue({ spokenText: "Sessão finalizada." });
    api.getAgenda.mockResolvedValue(agenda);
    const user = userEvent.setup();
    const currentAppointment = { ...item, actions: [{ kind: "FINISH" as const }] };
    render(
      <Announcer>
        <TherapistActions
          agenda={{ ...agenda, current: currentAppointment, items: [currentAppointment] }}
          onAgendaRefresh={vi.fn()}
        />
      </Announcer>,
    );

    await user.click(screen.getByRole("button", { name: "Finalizar atendimento de Ana, às 9h" }));

    expect(api.finishAppointment).toHaveBeenCalledWith(item.id);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sessão finalizada."));
  });

  it("TK-11.02 RF-33 RN-13: confirma ausência e move o foco para Atendimentos após a resposta", async () => {
    api.markNoShow.mockResolvedValue({ spokenText: "Ausência registrada." });
    api.getAgenda.mockResolvedValue(agenda);
    const possibleNoShow = {
      ...item,
      status: "POSSIBLE_NO_SHOW" as const,
      actions: [{ kind: "MARK_NO_SHOW" as const, confirmationText: "Marcar Ana como ausente às 9h. Confirma?" }],
    };
    const user = userEvent.setup();
    render(
      <Announcer>
        <TherapistActions agenda={{ ...agenda, items: [possibleNoShow] }} onAgendaRefresh={vi.fn()} />
      </Announcer>,
    );
    await user.click(screen.getByRole("button", { name: "Marcar ausência de Ana, às 9h" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Marcar Ana como ausente às 9h. Confirma?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar ausência" }));

    expect(api.markNoShow).toHaveBeenCalledWith(item.id);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Ausência registrada."));
    await waitFor(() => expect(screen.getByRole("region", { name: "Atendimentos" })).toHaveFocus());
  });

  it("TK-11.02 RF-12 RN-13: pede confirmação para cancelar e Voltar restaura o foco sem enviar ação", async () => {
    const user = userEvent.setup();
    renderActions();
    const cancel = screen.getByRole("button", { name: "Cancelar atendimento de Ana, às 9h" });
    await user.click(cancel);

    const dialog = await screen.findByRole("alertdialog", { name: "Cancelar o atendimento de Ana às 9h. Confirma?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(api.cancelAppointment).not.toHaveBeenCalled();
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it("TK-11.02 RF-12 RN-13: confirma cancelamento, anuncia a resposta e recarrega a agenda", async () => {
    api.cancelAppointment.mockResolvedValue({
      appointmentId: item.id,
      status: "CANCELLED",
      spokenText: "Atendimento cancelado.",
    });
    api.getAgenda.mockResolvedValue(agenda);
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole("button", { name: "Cancelar atendimento de Ana, às 9h" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar cancelamento" }));

    expect(api.cancelAppointment).toHaveBeenCalledWith(item.id);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Atendimento cancelado."));
    expect(api.getAgenda).toHaveBeenCalledOnce();
  });

  it("TK-11.02 RN-13: mantém o diálogo e não repete cancelamento quando a API recusa a ação", async () => {
    api.cancelAppointment.mockRejectedValue(new Error("O atendimento já mudou de situação."));
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole("button", { name: "Cancelar atendimento de Ana, às 9h" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O atendimento já mudou de situação.");
    expect(api.cancelAppointment).toHaveBeenCalledOnce();
    expect(api.getAgenda).not.toHaveBeenCalled();
    await expectAccessible(document.body);
  });

  it("TK-11.02 RF-13 RN-13: solicita prévia do bloqueio e só cria após confirmação", async () => {
    api.previewScheduleBlock.mockResolvedValue({ confirmationText: "Bloquear das 9h às 10h. Confirma?" });
    api.createScheduleBlock.mockResolvedValue({
      id: "block-1",
      startsAt: "2026-11-03T12:00:00.000Z",
      endsAt: "2026-11-03T13:00:00.000Z",
      reason: "Pausa",
      spokenText: "Horário bloqueado.",
    });
    api.getAgenda.mockResolvedValue(agenda);
    const user = userEvent.setup();
    renderActions();
    await user.type(screen.getByRole("textbox", { name: "Motivo (opcional)" }), "Pausa");
    await user.type(screen.getByLabelText("Início"), "2026-11-03T09:00");
    await user.type(screen.getByLabelText("Fim"), "2026-11-03T10:00");
    await user.click(screen.getByRole("button", { name: "Revisar período" }));

    expect(api.previewScheduleBlock).toHaveBeenCalledWith({
      startsAt: "2026-11-03T12:00:00.000Z",
      endsAt: "2026-11-03T13:00:00.000Z",
      reason: "Pausa",
    });
    expect(api.createScheduleBlock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", { name: "Bloquear das 9h às 10h. Confirma?" });
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await expectAccessible(document.body);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar período" }));

    expect(api.createScheduleBlock).toHaveBeenCalledWith({
      startsAt: "2026-11-03T12:00:00.000Z",
      endsAt: "2026-11-03T13:00:00.000Z",
      reason: "Pausa",
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Horário bloqueado."));
  });

  it("TK-11.02 RF-13: informa conflito na prévia e não cria bloqueio", async () => {
    api.previewScheduleBlock.mockRejectedValue(new Error("Há atendimentos nesse período."));
    const user = userEvent.setup();
    renderActions();
    await user.type(screen.getByLabelText("Início"), "2026-11-03T09:00");
    await user.type(screen.getByLabelText("Fim"), "2026-11-03T10:00");
    await user.click(screen.getByRole("button", { name: "Revisar período" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Há atendimentos nesse período.");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(api.createScheduleBlock).not.toHaveBeenCalled();
    await expectAccessible(document.body);
  });

  it("TK-11.02 RF-13 RN-13: mantém a confirmação quando o bloqueio conflita após a prévia", async () => {
    api.previewScheduleBlock.mockResolvedValue({ confirmationText: "Bloquear das 9h às 10h. Confirma?" });
    api.createScheduleBlock.mockRejectedValue(new Error("O período deixou de estar disponível."));
    const user = userEvent.setup();
    renderActions();
    await user.type(screen.getByLabelText("Início"), "2026-11-03T09:00");
    await user.type(screen.getByLabelText("Fim"), "2026-11-03T10:00");
    await user.click(screen.getByRole("button", { name: "Revisar período" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar período" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O período deixou de estar disponível.");
    expect(api.createScheduleBlock).toHaveBeenCalledOnce();
    expect(api.getAgenda).not.toHaveBeenCalled();
  });
});
