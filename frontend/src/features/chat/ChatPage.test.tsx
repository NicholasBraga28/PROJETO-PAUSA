import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Announcer } from "@/shared/a11y/Announcer";
import { expectAccessible } from "@/test/axe";
import { sendChatMessage } from "./api";
import ChatPage from "./ChatPage";

vi.mock("./api", () => ({ sendChatMessage: vi.fn() }));

const ANSWER = {
  answer: "A política oficial explica o cancelamento.",
  topic: "rag" as const,
  sources: ["requisitos.md"],
  suggestions: ["Como faço uma reserva?"],
};

function renderChatPage() {
  return render(
    <Announcer>
      <ChatPage />
    </Announcer>,
  );
}

describe("ChatPage", () => {
  beforeEach(() => {
    vi.mocked(sendChatMessage).mockReset();
  });

  it("TK-15.03 RF-34 RN-04: apresenta o estado vazio com nomes acessíveis e sem violações", async () => {
    renderChatPage();

    expect(screen.getByRole("heading", { level: 1, name: "Assistente de dúvidas" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Conversa" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveAttribute("maxLength", "500");
    expect(screen.getByText(/Não envie dados pessoais/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar pergunta" })).toHaveAttribute("aria-disabled", "true");
    await expectAccessible();
  });

  it("TK-15.03 RF-34 RN-04: envia a pergunta, mostra resposta, fontes e sugestão e anuncia a resposta", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue(ANSWER);
    const user = userEvent.setup();
    renderChatPage();
    const question = screen.getByRole("textbox", { name: "Sua pergunta" });
    await user.type(question, "Como funciona o cancelamento?");
    await user.click(screen.getByRole("button", { name: "Enviar pergunta" }));

    expect(vi.mocked(sendChatMessage)).toHaveBeenCalledWith("Como funciona o cancelamento?");
    const conversation = screen.getByRole("list", { name: "Mensagens da conversa" });
    expect(await within(conversation).findByText(ANSWER.answer)).toBeVisible();
    expect(screen.getByRole("list", { name: "Fontes consultadas" })).toHaveTextContent("requisitos.md");
    expect(screen.getByRole("button", { name: "Como faço uma reserva?" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(ANSWER.answer);
    expect(question).toHaveValue("");
    await expectAccessible();
  });

  it("TK-15.03 RF-34 RN-04: envia a pergunta ao pressionar Enter", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue(ANSWER);
    const user = userEvent.setup();
    renderChatPage();
    const question = screen.getByRole("textbox", { name: "Sua pergunta" });
    await user.type(question, "Como funciona o cancelamento?");
    await user.keyboard("{Enter}");

    expect(sendChatMessage).toHaveBeenCalledWith("Como funciona o cancelamento?");
    const conversation = screen.getByRole("list", { name: "Mensagens da conversa" });
    expect(await within(conversation).findByText(ANSWER.answer)).toBeVisible();
  });

  it("TK-15.03 RF-34 RN-04: mantém uma nova linha ao pressionar Shift+Enter", async () => {
    const user = userEvent.setup();
    renderChatPage();
    const question = screen.getByRole("textbox", { name: "Sua pergunta" });
    await user.type(question, "Primeira linha");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(question, "Segunda linha");

    expect(question).toHaveValue("Primeira linha\nSegunda linha");
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("TK-15.03 RF-34 RN-04: limita a pergunta a 500 caracteres e não envia texto em branco", async () => {
    const user = userEvent.setup();
    renderChatPage();
    const question = screen.getByRole("textbox", { name: "Sua pergunta" });
    await user.type(question, " ");
    expect(screen.getByRole("button", { name: "Enviar pergunta" })).toHaveAttribute("aria-disabled", "true");
    await user.clear(question);
    await user.type(question, "a".repeat(501));

    expect(question).toHaveValue("a".repeat(500));
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("TK-15.03 RF-34 RN-04: repete uma solicitação com falha sem perder a pergunta", async () => {
    vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("Serviço indisponível.")).mockResolvedValueOnce(ANSWER);
    const user = userEvent.setup();
    renderChatPage();
    const question = screen.getByRole("textbox", { name: "Sua pergunta" });
    await user.type(question, "Como funciona o cancelamento?");
    await user.click(screen.getByRole("button", { name: "Enviar pergunta" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Serviço indisponível.");
    expect(question).toHaveValue("Como funciona o cancelamento?");
    await user.click(screen.getByRole("button", { name: "Tentar novamente a pergunta" }));

    expect(
      await within(screen.getByRole("list", { name: "Mensagens da conversa" })).findByText(ANSWER.answer),
    ).toBeVisible();
    expect(sendChatMessage).toHaveBeenNthCalledWith(2, "Como funciona o cancelamento?");
    await waitFor(() => expect(screen.getByRole("button", { name: "Perguntar novamente" })).toHaveFocus());
  });

  it("TK-15.03 RF-34 RN-04: uma sugestão envia outra pergunta sem mover o foco", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue(ANSWER);
    const user = userEvent.setup();
    renderChatPage();
    await user.type(screen.getByRole("textbox", { name: "Sua pergunta" }), "Como funciona o cancelamento?");
    await user.click(screen.getByRole("button", { name: "Enviar pergunta" }));
    const suggestion = await screen.findByRole("button", { name: "Como faço uma reserva?" });
    suggestion.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(sendChatMessage).toHaveBeenNthCalledWith(2, "Como faço uma reserva?"));
    expect(suggestion).toHaveFocus();
    expect(screen.getAllByRole("heading", { name: "Sua pergunta" })).toHaveLength(2);
  });

  it("TK-15.03 RF-34 RNF-04: renderiza conteúdo do modelo como texto, sem interpretar HTML", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({ ...ANSWER, answer: '<img src="x" onerror="alert(1)">' });
    const user = userEvent.setup();
    renderChatPage();
    await user.type(screen.getByRole("textbox", { name: "Sua pergunta" }), "Pergunta de teste");
    await user.click(screen.getByRole("button", { name: "Enviar pergunta" }));

    expect(
      await within(screen.getByRole("list", { name: "Mensagens da conversa" })).findByText(
        '<img src="x" onerror="alert(1)">',
      ),
    ).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("TK-15.03 RF-34 RN-04: mantém o foco no botão de envio durante e após a resposta", async () => {
    let resolveRequest: ((value: typeof ANSWER) => void) | undefined;
    vi.mocked(sendChatMessage).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const user = userEvent.setup();
    renderChatPage();
    await user.type(screen.getByRole("textbox", { name: "Sua pergunta" }), "Pergunta de teste");
    const submit = screen.getByRole("button", { name: "Enviar pergunta" });
    submit.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Enviando sua pergunta ao assistente."));
    expect(submit).toHaveFocus();
    resolveRequest?.(ANSWER);
    await within(screen.getByRole("list", { name: "Mensagens da conversa" })).findByText(ANSWER.answer);
    expect(submit).toHaveFocus();
  });
});
