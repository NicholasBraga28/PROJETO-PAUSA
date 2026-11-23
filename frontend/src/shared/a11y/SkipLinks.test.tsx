import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkipLinks } from "./SkipLinks";
import { expectAccessible } from "@/test/axe";

function Page() {
  return (
    <>
      <SkipLinks
        links={[
          { target: "conteudo", label: "Pular para o conteúdo" },
          { target: "agenda", label: "Ir para Agenda de hoje" },
        ]}
      />
      <nav aria-label="Principal">
        <a href="/">Pausa</a>
      </nav>
      <main id="conteudo">
        <h1>Agora</h1>
        <section id="agenda" aria-labelledby="agenda-t">
          <h2 id="agenda-t">Agenda de hoje</h2>
          <button type="button">Marcar presença</button>
        </section>
      </main>
    </>
  );
}

describe("SkipLinks", () => {
  it("TK-09.05 RNF-01: é o primeiro foco ao apertar Tab na carga da página, sem violações", async () => {
    render(<Page />);
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveFocus();
    await expectAccessible();
  });

  it("TK-09.05 RNF-01: leva o foco ao conteúdo com Enter", async () => {
    render(<Page />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Marcar presença" })).toHaveFocus();
  });

  it("TK-09.05 RNF-01: leva o foco a cada região pelo próprio link", async () => {
    render(<Page />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Ir para Agenda de hoje" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Agenda de hoje" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("link", { name: "Pausa" })).toHaveFocus();
  });
});
