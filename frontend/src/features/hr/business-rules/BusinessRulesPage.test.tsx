import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import BusinessRulesPage from "./BusinessRulesPage";
import { MemoryRouter } from "react-router";

const rules = [
  {
    key: "SESSION_DURATION_MINUTES",
    value: "20",
    type: "MINUTES",
    description: "Duração de cada sessão, em minutos.",
  },
  {
    key: "WORK_START",
    value: "08:00",
    type: "TIME_OF_DAY",
    description: "Horário de início do atendimento, no formato HH:MM.",
  },
];

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockRulesApi(options: { failUpdate?: boolean; failLoad?: boolean } = {}) {
  const calls: Array<{ url: URL; method: string; body: unknown }> = [];
  let shouldFailLoad = options.failLoad ?? false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url.pathname === "/api/business-rules" && method === "GET") {
      if (shouldFailLoad) {
        shouldFailLoad = false;
        return respond({ message: "Não foi possível carregar as regras." }, 503);
      }
      return respond(rules);
    }
    if (url.pathname === "/api/business-rules/SESSION_DURATION_MINUTES" && method === "PATCH") {
      if (options.failUpdate) return respond({ message: "A duração deve ficar entre 10 e 120 minutos." }, 400);
      return respond({ ...rules[0], value: String(body.value) });
    }
    if (url.pathname === "/api/business-rules/WORK_START" && method === "PATCH")
      return respond({ ...rules[1], value: String(body.value) });
    return respond({ message: "Rota de teste não simulada." }, 404);
  });
  return { calls, fetch };
}

describe("parâmetros das regras do RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.05 RF-27: mostra nomes comerciais e valores da API sem expor identificadores internos", async () => {
    mockRulesApi();
    const { container } = render(<BusinessRulesPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("20 minutos")).toBeVisible();
    expect(screen.getByText("Duração de cada sessão, em minutos.")).toBeVisible();
    expect(screen.getByText("08:00 horário local")).toBeVisible();
    expect(screen.queryByText("SESSION_DURATION_MINUTES")).not.toBeInTheDocument();
    expect(screen.queryByText("MINUTES — minutos")).not.toBeInTheDocument();
    expect(screen.queryByText("TIME_OF_DAY — horário do dia")).not.toBeInTheDocument();
    expect(screen.getByText(/configurações ainda estão em revisão/i)).toBeVisible();
    await expectAccessible(container);
  });

  it("TK-12.05 RF-27: seleciona controle de horário, confirma valores atual e proposto e atualiza pela resposta", async () => {
    const { calls } = mockRulesApi();
    const user = userEvent.setup();
    render(<BusinessRulesPage />, { wrapper: MemoryRouter });
    const rule = await screen.findByRole("region", { name: /Duração da sessão/ });
    await user.click(within(rule).getByRole("button", { name: "Editar Duração da sessão" }));
    const input = screen.getByRole("spinbutton", { name: /Duração da sessão/ });
    expect(input).toHaveAttribute("type", "number");
    fireEvent.change(input, { target: { value: "30" } });
    await user.click(screen.getByRole("button", { name: "Revisar alteração" }));
    const dialog = screen.getByRole("alertdialog", { name: "Confirmar alteração de Duração da sessão?" });
    expect(within(dialog).getByText(/Valor configurado: 20 minutos/)).toBeVisible();
    expect(within(dialog).getByText(/Novo valor: 30 minutos/)).toBeVisible();
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar alteração" }));

    expect(await screen.findByText("30 minutos")).toBeVisible();
    expect(screen.queryByText("20 minutos")).not.toBeInTheDocument();
    expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({ value: "30" });
  });

  it("TK-12.05 RF-27: associa erro de validação ao campo, foca resumo e mantém valor persistido após rejeição", async () => {
    mockRulesApi({ failUpdate: true });
    const user = userEvent.setup();
    render(<BusinessRulesPage />, { wrapper: MemoryRouter });
    const rule = await screen.findByRole("region", { name: /Duração da sessão/ });
    await user.click(within(rule).getByRole("button", { name: "Editar Duração da sessão" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Duração da sessão/ }), { target: { value: "999" } });
    await user.click(screen.getByRole("button", { name: "Revisar alteração" }));
    await user.click(screen.getByRole("button", { name: "Confirmar alteração" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("A duração deve ficar entre 10 e 120 minutos.");
    expect(error).toHaveFocus();
    expect(screen.getByText("20 minutos")).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: /Duração da sessão/ }).getAttribute("aria-describedby")).toContain(
      "rule-error",
    );
  });

  it("TK-12.05 RF-27: informa erro de carregamento com ação de nova tentativa", async () => {
    const { calls } = mockRulesApi({ failLoad: true });
    const user = userEvent.setup();
    render(<BusinessRulesPage />, { wrapper: MemoryRouter });
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("O servidor não conseguiu atender o pedido.");
    await user.click(within(error).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("20 minutos")).toBeVisible();
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });
});
