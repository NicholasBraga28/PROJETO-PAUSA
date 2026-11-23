import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";
import { expectAccessible } from "@/test/axe";

interface HarnessProps {
  busy?: boolean;
  onConfirm?: () => void;
}

function Harness({ busy = false, onConfirm = () => {} }: HarnessProps) {
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Cancelar a sessão de terça, 14:00
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={setOpen}
        title="Cancelar esta sessão?"
        confirmLabel="Cancelar sessão"
        busyLabel="Cancelando…"
        onConfirm={onConfirm}
        busy={busy}
        error={null}
      >
        <p>O horário volta a ficar livre para outras pessoas.</p>
      </ConfirmDialog>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Cancelar a sessão de terça, 14:00" });

describe("ConfirmDialog", () => {
  it("TK-09.05 RN-13: abre com o foco em Voltar, sem violações", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    const dialog = await screen.findByRole("alertdialog", { name: "Cancelar esta sessão?" });
    expect(screen.getByRole("button", { name: "Voltar" })).toHaveFocus();
    await expectAccessible(dialog);
  });

  it("TK-09.05 RN-13: fecha com Esc e devolve o foco ao botão que o abriu", async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("TK-09.05 RN-13: fecha com Voltar acionado pelo Espaço e devolve o foco ao botão que o abriu", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await screen.findByRole("alertdialog");
    await userEvent.keyboard(" ");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("TK-09.05 RN-13: prende o foco entre as ações com Tab e Shift+Tab", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(trigger());
    await screen.findByRole("alertdialog");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Cancelar sessão" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Voltar" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancelar sessão" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("TK-09.05 RN-13: enquanto confirma, mantém o foco no diálogo, ignora nova confirmação e não fecha com Esc", async () => {
    const confirmed = vi.fn();
    function BusyHarness() {
      const [busy, setBusy] = useState(false);
      return (
        <Harness
          busy={busy}
          onConfirm={() => {
            confirmed();
            setBusy(true);
          }}
        />
      );
    }
    render(<BusyHarness />);
    await userEvent.click(trigger());
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const pending = screen.getByRole("button", { name: "Cancelando…" });
    expect(pending).toHaveFocus();
    expect(pending).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");
    expect(confirmed).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();
    expect(pending).toHaveFocus();
  });
});
