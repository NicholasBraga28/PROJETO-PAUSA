import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusAfterRemoval } from "./use-focus-after-removal";

interface ListProps {
  initial: string[];
}

function List({ initial }: ListProps) {
  const [items, setItems] = useState(initial);
  const { itemRef, titleRef, willRemove } = useFocusAfterRemoval<HTMLLIElement>(items);
  return (
    <section aria-labelledby="proximas-title">
      <h2 id="proximas-title" ref={titleRef} tabIndex={-1}>
        Próximas
      </h2>
      <ul>
        {items.map((item) => (
          <li key={item} ref={itemRef(item)} tabIndex={-1}>
            {item}
            <button
              type="button"
              onClick={() => {
                willRemove(item);
                setItems((list) => list.filter((other) => other !== item));
              }}
            >
              Cancelar {item}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

describe("useFocusAfterRemoval", () => {
  it("TK-09.05 RNF-01: leva o foco ao próximo item depois de remover um", async () => {
    render(<List initial={["terça", "quarta", "quinta"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar quarta" }));
    expect(document.activeElement?.textContent).toMatch(/^quinta/);
  });

  it("TK-09.05 RNF-01: leva o foco ao novo último item quando o último é removido", async () => {
    render(<List initial={["terça", "quarta"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar quarta" }));
    expect(document.activeElement?.textContent).toMatch(/^terça/);
  });

  it("TK-09.05 RNF-01: leva o foco ao título quando a lista fica vazia", async () => {
    render(<List initial={["terça"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar terça" }));
    expect(screen.getByRole("heading", { name: "Próximas" })).toHaveFocus();
  });
});
