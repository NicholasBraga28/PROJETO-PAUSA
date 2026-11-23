import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import AlexaPairingPage from "./AlexaPairingPage";
import { MemoryRouter } from "react-router";

const therapist = {
  id: "therapist-user-1",
  email: "bruno@example.com",
  name: "Bruno Lima",
  role: "THERAPIST",
  status: "ACTIVE",
  therapistId: "therapist-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const codes = [
  { code: "004821", therapistId: "therapist-1", expiresAt: "2026-11-03T18:00:00.000Z" },
  { code: "930042", therapistId: "therapist-1", expiresAt: "2026-11-03T18:05:00.000Z" },
];

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockPairingApi(options: { users?: unknown[]; failGenerate?: boolean } = {}) {
  const calls: Array<{ url: URL; method: string }> = [];
  let codeIndex = 0;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.pathname === "/api/users") return respond(options.users ?? [therapist]);
    if (url.pathname === "/api/therapists/therapist-1/alexa-pairing-code" && method === "POST") {
      if (options.failGenerate) return respond({ message: "O massoterapeuta está inativo." }, 400);
      const code = codes[Math.min(codeIndex, codes.length - 1)];
      codeIndex += 1;
      return respond(code, 201);
    }
    return respond({ message: "Rota de teste não simulada." }, 404);
  });
  return { calls, fetch };
}

describe("pareamento da Alexa pelo RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.06 RF-17 D-18: confirma antes de gerar, mostra seis dígitos separados e validade local", async () => {
    const { calls } = mockPairingApi();
    const user = userEvent.setup();
    const { container } = render(<AlexaPairingPage />, { wrapper: MemoryRouter });

    await user.click(await screen.findByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    await user.click(screen.getByRole("button", { name: "Gerar código de conexão" }));
    const dialog = screen.getByRole("alertdialog", { name: "Gerar código de conexão?" });
    expect(within(dialog).getByText(/Bruno Lima/)).toBeVisible();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar geração" }));

    expect(await screen.findByRole("list", { name: "Dígitos do código de conexão" })).toHaveTextContent("004821");
    expect(screen.getByText("terça-feira, 3 de novembro de 2026, às 15h")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(/0, 0, 4, 8, 2, 1/);
    expect(localStorage.getItem("alexaPairingCode")).toBeNull();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    await expectAccessible(container);
  });

  it("TK-12.06 RF-17 D-18: nova geração substitui o código mostrado e invalida a apresentação anterior", async () => {
    mockPairingApi();
    const user = userEvent.setup();
    render(<AlexaPairingPage />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    await user.click(screen.getByRole("button", { name: "Gerar código de conexão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar geração" }));
    expect(await screen.findByRole("list", { name: "Dígitos do código de conexão" })).toHaveTextContent("004821");
    await user.click(screen.getByRole("button", { name: "Gerar código de conexão" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/o código atual deixará de funcionar/i);
    await user.click(screen.getByRole("button", { name: "Confirmar geração" }));

    expect(await screen.findByRole("list", { name: "Dígitos do código de conexão" })).toHaveTextContent("930042");
    expect(screen.getByText("terça-feira, 3 de novembro de 2026, às 15h05")).toBeVisible();
    expect(screen.queryByText("terça-feira, 3 de novembro de 2026, às 15h")).not.toBeInTheDocument();
  });

  it("TK-12.06 RF-17: erro do catálogo não exibe código", async () => {
    mockPairingApi({ failGenerate: true });
    const user = userEvent.setup();
    render(<AlexaPairingPage />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    await user.click(screen.getByRole("button", { name: "Gerar código de conexão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar geração" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("O massoterapeuta está inativo.");
    expect(screen.queryByRole("list", { name: "Dígitos do código de conexão" })).not.toBeInTheDocument();
    expect(screen.queryByText("004821")).not.toBeInTheDocument();
  });

  it("TK-12.06 RF-17: explica quando não há massoterapeutas ativos", async () => {
    const { calls } = mockPairingApi({ users: [] });
    render(<AlexaPairingPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Não há massoterapeutas ativos para conectar à Alexa.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Gerar código de conexão" })).not.toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });
});
