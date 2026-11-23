import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import BlocksPage from "./BlocksPage";
import { MemoryRouter } from "react-router";

const ACTIVE_THERAPIST = {
  id: "user-therapist-1",
  email: "bruno@example.com",
  name: "Bruno Lima",
  role: "THERAPIST",
  status: "ACTIVE",
  therapistId: "therapist-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const createdBlock = {
  id: "block-1",
  therapistId: "therapist-1",
  startsAt: "2026-11-05T12:00:00.000Z",
  endsAt: "2026-11-05T13:00:00.000Z",
  reason: "Compromisso pessoal",
  createdById: "hr-1",
  createdAt: "2026-11-03T12:00:00.000Z",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockBlockApi(options: { therapists?: unknown[]; conflict?: boolean } = {}) {
  const calls: Array<{ url: URL; method: string; body: unknown }> = [];
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url.pathname === "/api/users") return respond(options.therapists ?? [ACTIVE_THERAPIST]);
    if (url.pathname === "/api/schedule-blocks" && method === "POST") {
      if (options.conflict)
        return respond(
          {
            statusCode: 409,
            error: "Conflict",
            message: "Não é possível bloquear: há 2 atendimentos nesse período.",
            spokenText: "Não é possível bloquear: há 2 atendimentos nesse período.",
            appointments: [
              {
                id: "appointment-1",
                startsAt: "2026-11-05T12:00:00.000Z",
                endsAt: "2026-11-05T12:20:00.000Z",
                employee: { id: "employee-1", name: "Ana Souza" },
              },
              {
                id: "appointment-2",
                startsAt: "2026-11-05T12:20:00.000Z",
                endsAt: "2026-11-05T12:40:00.000Z",
                employee: { id: "employee-2", name: "Caio Lima" },
              },
            ],
          },
          409,
        );
      return respond(createdBlock, 201);
    }
    return respond({ message: "Rota de teste não simulada." }, 404);
  });
  return { calls, fetch };
}

describe("bloqueios do RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.04 RF-23: confirma o bloqueio antes de enviar e anuncia o período criado", async () => {
    const { calls } = mockBlockApi();
    const user = userEvent.setup();
    const { container } = render(<BlocksPage />, { wrapper: MemoryRouter });

    await user.click(await screen.findByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-05T10:00" } });
    await user.type(screen.getByRole("textbox", { name: "Motivo (opcional)" }), "Compromisso pessoal");
    await user.click(screen.getByRole("button", { name: "Revisar período" }));

    const dialog = screen.getByRole("alertdialog", { name: "Marcar período sem atendimento?" });
    expect(within(dialog).getByText(/Bruno Lima/)).toBeVisible();
    expect(within(dialog).getByText(/quinta-feira, 5 de novembro, das 9h às 10h/)).toBeVisible();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar período" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Período sem atendimento registrado para Bruno Lima");
    await waitFor(() =>
      expect(calls.find((call) => call.method === "POST")?.body).toEqual({
        therapistId: "therapist-1",
        startsAt: "2026-11-05T12:00:00.000Z",
        endsAt: "2026-11-05T13:00:00.000Z",
        reason: "Compromisso pessoal",
      }),
    );
    expect(calls.some((call) => call.method === "GET" && call.url.pathname === "/api/schedule-blocks")).toBe(false);
    await expectAccessible(container);
  });

  it("TK-12.04 RF-23 D-04: lista atendimentos conflitantes e não os cancela", async () => {
    const { calls } = mockBlockApi({ conflict: true });
    const user = userEvent.setup();
    render(<BlocksPage />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-05T10:00" } });
    await user.click(screen.getByRole("button", { name: "Revisar período" }));
    await user.click(screen.getByRole("button", { name: "Confirmar período" }));

    const dialog = screen.getByRole("alertdialog", { name: "Marcar período sem atendimento?" });
    expect(await within(dialog).findByText(/Resolva-os antes de salvar o período sem atendimento/i)).toBeVisible();
    expect(within(dialog).getByRole("list")).toHaveTextContent("Ana Souza");
    expect(within(dialog).getByRole("list")).toHaveTextContent("Caio Lima");
    expect(within(dialog).getByText(/não serão cancelados automaticamente/i)).toBeVisible();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(calls.filter((call) => call.url.pathname.includes("appointments"))).toHaveLength(0);
  });

  it("TK-12.04 RF-23 RN-08: associa erro quando o início não antecede o fim", async () => {
    mockBlockApi();
    const user = userEvent.setup();
    render(<BlocksPage />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-11-05T09:00" } });
    await user.click(screen.getByRole("button", { name: "Revisar período" }));

    expect(screen.getByRole("alert")).toHaveTextContent("O fim precisa ser depois do início.");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("TK-12.04 RF-23: explica quando não há massoterapeutas ativos e não oferece outras operações", async () => {
    const { calls } = mockBlockApi({ therapists: [] });
    const { container } = render(<BlocksPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Não há massoterapeutas ativos no momento.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Criar bloqueio/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Consultar bloqueios|Editar bloqueio|Remover bloqueio/i }),
    ).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === "/api/schedule-blocks" && call.method === "GET")).toBe(false);
    await expectAccessible(container);
  });
});
