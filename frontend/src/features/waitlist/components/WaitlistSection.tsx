import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { Link } from "react-router";
import { errorMessage } from "@/shared/api/api-error";
import { useAnnounce } from "@/shared/a11y/use-announce";
import type { WaitlistEntries as WaitlistEntriesData, WaitlistEntry } from "@/shared/api/schemas";
import { acceptWaitlistOffer, declineWaitlistOffer, getWaitlist, leaveWaitlist } from "@/features/waitlist/api";
import { WaitlistEntries } from "@/features/waitlist/components/WaitlistEntries";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

type SectionState =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: WaitlistEntriesData };
type Confirmation = { action: "leave" | "accept" | "decline"; entry: WaitlistEntry } | null;

interface WaitlistSectionProps {
  employeeId: string;
  onAppointmentChanged: () => void;
}

export function WaitlistSection({ employeeId, onAppointmentChanged }: WaitlistSectionProps) {
  const announce = useAnnounce();
  const [state, setState] = useState<SectionState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const loadErrorRef = useRef<HTMLDivElement>(null);
  const mutationErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let cancelled = false;
    getWaitlist()
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", data });
        announce(data.spokenText);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(cause) });
      });
    return () => {
      cancelled = true;
    };
  }, [announce, employeeId, reload]);

  useEffect(() => {
    if (state.status === "error") loadErrorRef.current?.focus();
    if (mutationError) mutationErrorRef.current?.focus();
  }, [mutationError, state]);

  async function refresh(entryId?: string) {
    const data = await getWaitlist();
    setState({ status: "ready", data });
    announce(data.items.find((entry) => entry.id === entryId)?.spokenText ?? data.spokenText);
  }

  async function confirmChange() {
    if (!confirmation) return;
    const { action, entry } = confirmation;
    setBusyId(entry.id);
    setMutationError(null);
    try {
      if (action === "leave") await leaveWaitlist(entry.id);
      if (action === "decline") await declineWaitlistOffer(entry.id);
      if (action === "accept") {
        await acceptWaitlistOffer(entry.id);
        onAppointmentChanged();
      }
      setConfirmation(null);
      await refresh(entry.id);
    } catch (cause) {
      setMutationError(errorMessage(cause));
      setConfirmation(null);
      try {
        await refresh(entry.id);
      } catch {
        setReload((value) => value + 1);
      }
    } finally {
      setBusyId(null);
    }
  }

  const retry = () => {
    setState({ status: "loading" });
    setReload((value) => value + 1);
  };
  const confirmationText =
    confirmation?.action === "accept"
      ? "Aceitar esta oferta?"
      : confirmation?.action === "decline"
        ? "Recusar esta oferta?"
        : "Sair da lista de espera?";
  const actionLabel =
    confirmation?.action === "accept"
      ? "Aceitar oferta"
      : confirmation?.action === "decline"
        ? "Recusar oferta"
        : "Sair da lista de espera";

  return (
    <section id="lista-de-espera" className="waitlist" aria-labelledby="waitlist-title">
      <h2 id="waitlist-title" className="list-title">
        Lista de espera
      </h2>
      <div className="waitlist-in">
        <p className="lede">
          Aqui ficam os horários que você pediu para aguardar. Quando um horário reservado for liberado, você pode
          receber uma oferta nesta lista.
        </p>
        {state.status === "loading" && <p>Carregando sua lista de espera...</p>}
        {state.status === "error" && (
          <div ref={loadErrorRef} className="notice" role="alert" tabIndex={-1}>
            <p>Não foi possível carregar sua lista de espera: {state.message}</p>
            <Button className="ghost-btn" onPress={retry}>
              Tentar novamente
            </Button>
          </div>
        )}
        {mutationError && (
          <p ref={mutationErrorRef} className="field-error waitlist-error" role="alert" tabIndex={-1}>
            {mutationError}
          </p>
        )}
        {state.status === "ready" &&
          (state.data.items.length === 0 ? (
            <p className="none">
              Você ainda não entrou na lista de espera. Ao tentar reservar um horário já reservado, você poderá entrar
              na lista para receber uma oferta se ele for liberado.{" "}
              <Link className="link" to="/book">
                Ver horários
              </Link>
            </p>
          ) : (
            <WaitlistEntries
              items={state.data.items}
              busyId={busyId}
              onLeave={(entry) => setConfirmation({ action: "leave", entry })}
              onAccept={(entry) => setConfirmation({ action: "accept", entry })}
              onDecline={(entry) => setConfirmation({ action: "decline", entry })}
            />
          ))}
      </div>
      <ConfirmDialog
        isOpen={confirmation != null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setConfirmation(null);
        }}
        title={confirmationText}
        confirmLabel={actionLabel}
        busyLabel={
          confirmation?.action === "accept"
            ? "Aceitando..."
            : confirmation?.action === "decline"
              ? "Recusando..."
              : "Saindo..."
        }
        onConfirm={() => void confirmChange()}
        busy={busyId !== null}
        error={null}
      >
        {confirmation && (
          <p>
            {confirmation.action === "accept"
              ? `A oferta para ${confirmation.entry.spokenText} será aceita e convertida em agendamento.`
              : confirmation.action === "decline"
                ? `A oferta para ${confirmation.entry.spokenText} será recusada e a próxima pessoa da fila será avisada.`
                : `A entrada para ${confirmation.entry.spokenText} será cancelada.`}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
