import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Navbar } from "./Navbar";
import { expectAccessible } from "@/test/axe";

const PROFILE = { name: "Beatriz Lima", firstName: "Beatriz", roleLabel: "Colaborador" };

describe("Navbar", () => {
  it("TK-09.05 RN-04: nomeia a navegação, o link da página inicial e a troca de usuário, sem violações", async () => {
    const onSwitch = vi.fn();
    render(
      <MemoryRouter>
        <Navbar profile={PROFILE} onSwitch={onSwitch} links={[["#agenda", "Horários"]]} cta={["#agenda", "Reservar"]} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(screen.getByRole("link", { name: "Pausa, página inicial" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Beatriz Lima, Colaborador. Trocar de usuário" }));
    expect(onSwitch).toHaveBeenCalledOnce();
    await expectAccessible(nav);
  });

  it("TK-09.10 RN-04: o primeiro link da navegação é Início, mesmo sem usuário e sem atalhos", async () => {
    render(
      <MemoryRouter>
        <Navbar profile={null} onSwitch={vi.fn()} cta={null} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Principal" });
    const [first] = within(nav).getAllByRole("link");
    expect(first).toHaveAccessibleName("Início");
    expect(first).toHaveAttribute("href", "/");
    await expectAccessible(nav);
  });

  it("TK-09.10 RN-04: marca o link Acessibilidade como página atual quando ela está aberta", () => {
    render(
      <MemoryRouter initialEntries={["/accessibility"]}>
        <Navbar profile={null} onSwitch={vi.fn()} cta={null} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Acessibilidade" })).toHaveAttribute("aria-current", "page");
  });
});
