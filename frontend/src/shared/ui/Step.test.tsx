import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Step } from "./Step";
import { expectAccessible } from "@/test/axe";

describe("Step", () => {
  it("TK-09.05 RN-04: é uma região nomeada pelo título, com o número escondido do leitor de tela, sem violações", async () => {
    render(
      <main>
        <h1>Reservar</h1>
        <h2>Etapas</h2>
        <Step n={1} title="Unidade" id="unidade" aside="Escolha uma">
          <p>São Paulo</p>
        </Step>
      </main>,
    );
    expect(screen.getByRole("region", { name: "Unidade" })).toBeInTheDocument();
    expect(screen.getByText("01")).toHaveAttribute("aria-hidden", "true");
    await expectAccessible();
  });
});
