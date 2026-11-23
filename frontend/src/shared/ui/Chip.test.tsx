import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Label, RadioGroup } from "react-aria-components";
import { Chip } from "./Chip";
import { expectAccessible } from "@/test/axe";

describe("Chip", () => {
  it("TK-09.05 RN-04: segue o grupo de rádio do APG (Tab entra, setas trocam), sem violações", async () => {
    render(
      <main>
        <RadioGroup defaultValue="SAO_PAULO" orientation="horizontal">
          <Label>Unidade</Label>
          <Chip group="unidade" value="SAO_PAULO">
            São Paulo
          </Chip>
          <Chip group="unidade" value="LONDRINA">
            Londrina
          </Chip>
        </RadioGroup>
      </main>,
    );
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "São Paulo" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Londrina" })).toBeChecked();
    await expectAccessible();
  });
});
