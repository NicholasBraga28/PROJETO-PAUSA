import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VisuallyHidden } from "./VisuallyHidden";
import { expectAccessible } from "@/test/axe";

describe("VisuallyHidden", () => {
  it("TK-09.05 RN-04: completa o nome acessível sem aparecer na tela, sem violações", async () => {
    render(
      <main>
        <a href="/">
          Pausa<VisuallyHidden>, página inicial</VisuallyHidden>
        </a>
      </main>,
    );
    expect(screen.getByRole("link", { name: "Pausa, página inicial" })).toBeInTheDocument();
    expect(screen.getByText(", página inicial")).toHaveClass("sr-only");
    await expectAccessible();
  });
});
