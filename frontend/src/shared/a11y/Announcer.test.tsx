import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Announcer } from "./Announcer";
import { useAnnounce } from "./use-announce";
import { expectAccessible } from "@/test/axe";

function Harness() {
  const announce = useAnnounce();
  return (
    <>
      <button type="button" onClick={() => announce("Reserva confirmada.")}>
        Confirmar
      </button>
      <button type="button" onClick={() => announce("Atendimento das 14h cancelado.", { urgent: true })}>
        Avisar
      </button>
    </>
  );
}

const politeRegion = () => screen.getByRole("status");
const urgentRegion = () => document.querySelector<HTMLElement>("[aria-live=assertive]");

function recordTexts(node: Node) {
  const texts: string[] = [];
  new MutationObserver(() => texts.push(node.textContent ?? "")).observe(node, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return texts;
}

describe("Announcer", () => {
  it("TK-09.05 RNF-01: anuncia duas vezes a mesma frase dita duas vezes", async () => {
    render(
      <Announcer>
        <Harness />
      </Announcer>,
    );
    const texts = recordTexts(politeRegion());
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent("Reserva confirmada."));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(texts.filter((t) => t === "Reserva confirmada.")).toHaveLength(2));
    expect(politeRegion()).toHaveTextContent("Reserva confirmada.");
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
  });

  it("TK-09.05 RNF-01: usa a região assertive só para o aviso urgente", async () => {
    render(
      <Announcer>
        <Harness />
      </Announcer>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Avisar" }));
    await waitFor(() => expect(urgentRegion()).toHaveTextContent("Atendimento das 14h cancelado."));
    expect(politeRegion()).toHaveTextContent("");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent("Reserva confirmada."));
    expect(urgentRegion()).toHaveTextContent("Atendimento das 14h cancelado.");
    await expectAccessible();
  });
});
