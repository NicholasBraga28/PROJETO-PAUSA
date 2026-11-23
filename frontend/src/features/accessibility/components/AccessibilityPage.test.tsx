import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AccessibilityPage from "./AccessibilityPage";
import { expectAccessible } from "@/test/axe";

const headingLevels = () => screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));

describe("AccessibilityPage", () => {
  it("TK-09.10 RN-04: tem um único h1, focável pelo roteamento, sem violações", async () => {
    render(<AccessibilityPage />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "conteudo");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Acessibilidade" })).toHaveAttribute("tabindex", "-1");
    await expectAccessible();
  });

  it("TK-09.10 RN-04: a hierarquia de cabeçalhos não pula níveis", () => {
    render(<AccessibilityPage />);
    const levels = headingLevels();
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, index) => expect(level - (levels[index] ?? 0)).toBeLessThanOrEqual(1));
  });

  it.each([
    "Recursos",
    "Temas de cor",
    "Atalhos de região",
    "Reduzir movimento",
    "Zoom e tamanho do texto",
    "Normas seguidas",
    "Leitores de tela testados",
  ])("TK-09.10 RN-04: tem a seção %s, com cabeçalho que nomeia a região", (name) => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name });
    expect(within(section).getAllByRole("heading")[0]).toHaveAccessibleName(name);
  });

  it("TK-09.10 RN-04: descreve os temas, o atalho de pulo, o movimento reduzido e o zoom", () => {
    render(<AccessibilityPage />);
    const themes = screen.getByRole("region", { name: "Temas de cor" });
    ["Automático", "Claro", "Escuro", "Alto contraste"].forEach((theme) =>
      expect(within(themes).getByText(new RegExp(theme))).toBeInTheDocument(),
    );
    expect(screen.getByRole("region", { name: "Atalhos de região" })).toHaveTextContent("Pular para o conteúdo");
    expect(screen.getByRole("region", { name: "Reduzir movimento" })).toHaveTextContent("Pausar animação");
    expect(screen.getByRole("region", { name: "Zoom e tamanho do texto" })).toHaveTextContent("400%");
  });

  it("TK-09.10 RN-04: lista as normas seguidas e os leitores de tela testados", () => {
    render(<AccessibilityPage />);
    const standards = within(screen.getByRole("region", { name: "Normas seguidas" })).getAllByRole("listitem");
    const standardsText = standards.map((item) => item.textContent).join(" ");
    ["WCAG 2.2", "ABNT NBR 17225:2025", "eMAG 3.1", "Lei Brasileira de Inclusão", "WAI-ARIA 1.2"].forEach((name) =>
      expect(standardsText).toContain(name),
    );
    const screenReaders = screen.getByRole("region", { name: "Leitores de tela testados" });
    expect(screenReaders).toHaveTextContent(/NVDA/);
    expect(screenReaders).toHaveTextContent(/Chrome/);
    expect(screenReaders).toHaveTextContent(/Firefox/);
  });
});
