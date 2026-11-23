import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Swap } from "./Swap";
import { expectAccessible } from "@/test/axe";

describe("Swap", () => {
  it("TK-09.05 RN-04: troca o texto mostrado quando o valor muda, sem violações", async () => {
    const { rerender } = render(
      <main>
        <p>
          <Swap k="10:00">10:00</Swap>
        </p>
      </main>,
    );
    expect(screen.getByText("10:00")).toBeInTheDocument();
    rerender(
      <main>
        <p>
          <Swap k="10:20">10:20</Swap>
        </p>
      </main>,
    );
    expect(await screen.findByText("10:20")).toBeInTheDocument();
    await expectAccessible();
  });
});
