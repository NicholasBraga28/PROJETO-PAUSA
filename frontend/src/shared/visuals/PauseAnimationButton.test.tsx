import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PauseAnimationButton } from "./PauseAnimationButton";
import { REDUCED_MOTION, useScenePaused } from "./use-scene-paused";
import { expectAccessible } from "@/test/axe";

function Scene() {
  const [isPaused, setPaused] = useScenePaused();
  return (
    <main>
      <p>{isPaused ? "parada" : "em movimento"}</p>
      <PauseAnimationButton isPaused={isPaused} onChange={setPaused} />
    </main>
  );
}

function prefersReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: matches && query === REDUCED_MOTION,
    media: query,
    onchange: null,
    dispatchEvent: () => false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
}

describe("PauseAnimationButton", () => {
  it("TK-09.06 RN-04: pausa a cena pelo teclado e anuncia o estado com aria-pressed, sem violações", async () => {
    render(<Scene />);
    const button = screen.getByRole("button", { name: "Pausar animação" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("em movimento")).toBeInTheDocument();

    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("parada")).toBeInTheDocument();
    await expectAccessible();
  });

  it("TK-09.06 RN-04: lembra a escolha ao voltar à página", async () => {
    const { unmount } = render(<Scene />);
    await userEvent.click(screen.getByRole("button", { name: "Pausar animação" }));
    unmount();

    render(<Scene />);
    expect(screen.getByRole("button", { name: "Pausar animação" })).toHaveAttribute("aria-pressed", "true");
  });

  it('TK-09.06 RN-04: com "reduzir movimento" a cena já começa parada', () => {
    prefersReducedMotion(true);
    render(<Scene />);
    expect(screen.getByRole("button", { name: "Pausar animação" })).toHaveAttribute("aria-pressed", "true");
  });

  it('TK-09.06 RN-04: a escolha de deixar em movimento vale mesmo com "reduzir movimento"', async () => {
    prefersReducedMotion(true);
    const { unmount } = render(<Scene />);
    await userEvent.click(screen.getByRole("button", { name: "Pausar animação" }));
    unmount();

    render(<Scene />);
    expect(screen.getByRole("button", { name: "Pausar animação" })).toHaveAttribute("aria-pressed", "false");
  });
});
