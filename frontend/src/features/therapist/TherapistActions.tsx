import { useCallback, useContext, useRef, useState, type FormEvent } from "react";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { errorMessage } from "@/shared/api/api-error";
import type { TherapistAgenda, TherapistAgendaItem } from "@/shared/api/schemas";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import {
  cancelAppointment,
  createScheduleBlock,
  finishAppointment,
  getAgenda,
  markNoShow,
  previewScheduleBlock,
  startAppointment,
  type ScheduleBlockInput,
} from "./api";
import { localBlockDateTimeToIso } from "./block-time";

type AppointmentAction = "CANCEL" | "MARK_NO_SHOW";
type Confirmation =
  | { type: "appointment"; id: string; action: AppointmentAction; text: string }
  | { type: "block"; input: ScheduleBlockInput; text: string };

interface TherapistActionsProps {
  agenda: TherapistAgenda;
  onAgendaRefresh: (agenda: TherapistAgenda) => void;
}

function spokenTarget(appointment: TherapistAgendaItem) {
  return `${appointment.employee.firstName}, ${appointment.spokenTime}`;
}

function TherapistActions({ agenda, onAgendaRefresh }: TherapistActionsProps) {
  const announce = useContext(AnnouncerContext);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const actionsRegionRef = useRef<HTMLElement>(null);

  const completeAction = useCallback(
    async (spokenText: string, moveFocus = false) => {
      setPendingMessage(null);
      announce(spokenText);
      try {
        onAgendaRefresh(await getAgenda());
      } catch {
        announce("A ação foi concluída, mas não foi possível atualizar a agenda. Tente atualizar a página.", {
          urgent: true,
        });
      }
      if (moveFocus) requestAnimationFrame(() => actionsRegionRef.current?.focus());
    },
    [announce, onAgendaRefresh],
  );

  const runDirectAction = useCallback(
    async (appointment: TherapistAgendaItem, action: "START" | "FINISH") => {
      if (isBusy) return;
      setIsBusy(true);
      const pendingText = `${action === "START" ? "Iniciando" : "Finalizando"} atendimento de ${spokenTarget(appointment)}.`;
      setPendingMessage(pendingText);
      announce(pendingText);
      setBlockError(null);
      setActionError(null);
      try {
        const result =
          action === "START" ? await startAppointment(appointment.id) : await finishAppointment(appointment.id);
        await completeAction(result.spokenText);
      } catch (error: unknown) {
        setPendingMessage(null);
        const message = errorMessage(error);
        setActionError(message);
        announce(message, { urgent: true });
      } finally {
        setIsBusy(false);
      }
    },
    [announce, completeAction, isBusy],
  );

  const confirmAppointmentAction = useCallback(async () => {
    if (!confirmation || confirmation.type !== "appointment") return;
    setIsBusy(true);
    announce(confirmation.action === "CANCEL" ? "Cancelando o atendimento." : "Registrando a ausência.");
    setDialogError(null);
    try {
      const result =
        confirmation.action === "CANCEL" ? await cancelAppointment(confirmation.id) : await markNoShow(confirmation.id);
      setConfirmation(null);
      await completeAction(result.spokenText, true);
    } catch (error: unknown) {
      const message = errorMessage(error);
      setDialogError(message);
      announce(message, { urgent: true });
    } finally {
      setIsBusy(false);
    }
  }, [announce, completeAction, confirmation]);

  const reviewBlock = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isBusy) return;
      if (!event.currentTarget.reportValidity()) return;
      const formData = new FormData(event.currentTarget);
      const reason = String(formData.get("reason") ?? "").trim();
      let input: ScheduleBlockInput;
      try {
        input = {
          startsAt: localBlockDateTimeToIso(String(formData.get("startsAt") ?? "")),
          endsAt: localBlockDateTimeToIso(String(formData.get("endsAt") ?? "")),
          ...(reason ? { reason } : {}),
        };
      } catch (error: unknown) {
        const message = errorMessage(error);
        setBlockError(message);
        announce(message, { urgent: true });
        return;
      }
      setIsBusy(true);
      setPendingMessage("Verificando se o horário pode ser bloqueado.");
      announce("Verificando se o horário pode ser bloqueado.");
      setBlockError(null);
      try {
        const preview = await previewScheduleBlock(input);
        setPendingMessage(null);
        setConfirmation({ type: "block", input, text: preview.confirmationText });
      } catch (error: unknown) {
        setPendingMessage(null);
        const message = errorMessage(error);
        setBlockError(message);
        announce(message, { urgent: true });
      } finally {
        setIsBusy(false);
      }
    },
    [announce, isBusy],
  );

  const confirmBlock = useCallback(async () => {
    if (!confirmation || confirmation.type !== "block") return;
    setIsBusy(true);
    announce("Registrando período sem atendimento.");
    setDialogError(null);
    try {
      const result = await createScheduleBlock(confirmation.input);
      setConfirmation(null);
      setBlockError(null);
      await completeAction(result.spokenText);
    } catch (error: unknown) {
      const message = errorMessage(error);
      setDialogError(message);
      announce(message, { urgent: true });
    } finally {
      setIsBusy(false);
    }
  }, [announce, completeAction, confirmation]);

  const closeConfirmation = (isOpen: boolean) => {
    if (isOpen || isBusy) return;
    setConfirmation(null);
    setDialogError(null);
  };

  return (
    <>
      <section
        id="therapist-actions"
        className="therapist-region"
        aria-labelledby="therapist-actions-heading"
        tabIndex={-1}
        aria-busy={isBusy}
        ref={actionsRegionRef}
      >
        <h2 id="therapist-actions-heading">Atendimentos</h2>
        {pendingMessage ? <p className="therapist-loading">{pendingMessage}</p> : null}
        {actionError ? (
          <p className="therapist-error" role="alert">
            {actionError}
          </p>
        ) : null}
        <ul className="therapist-action-list">
          {agenda.items.flatMap((appointment) =>
            appointment.actions.map((action) => {
              const target = spokenTarget(appointment);
              if (action.kind === "START" || action.kind === "FINISH") {
                const label = action.kind === "START" ? "Iniciar atendimento" : "Finalizar atendimento";
                return (
                  <li key={`${appointment.id}-${action.kind}`}>
                    <button
                      type="button"
                      className="primary-btn therapist-action-button"
                      aria-disabled={isBusy || undefined}
                      onClick={() => void runDirectAction(appointment, action.kind)}
                    >
                      {label} de {target}
                    </button>
                  </li>
                );
              }
              if (!("confirmationText" in action)) return null;
              const actionKind: AppointmentAction = action.kind;
              const confirmationText = action.confirmationText;
              const label = action.kind === "CANCEL" ? "Cancelar atendimento" : "Marcar ausência";
              return (
                <li key={`${appointment.id}-${action.kind}`}>
                  <button
                    type="button"
                    className={
                      action.kind === "CANCEL"
                        ? "danger-btn therapist-action-button"
                        : "ghost-btn therapist-action-button"
                    }
                    aria-disabled={isBusy || undefined}
                    onClick={() => {
                      if (isBusy) return;
                      setDialogError(null);
                      setConfirmation({
                        type: "appointment",
                        id: appointment.id,
                        action: actionKind,
                        text: confirmationText,
                      });
                    }}
                  >
                    {label} de {target}
                  </button>
                </li>
              );
            }),
          )}
        </ul>
        {agenda.items.every((appointment) => appointment.actions.length === 0) ? (
          <p>Não há atendimentos para gerenciar hoje.</p>
        ) : null}

      </section>

      <section
        id="therapist-block"
        className="therapist-block-group"
        aria-labelledby="therapist-block-heading"
        tabIndex={-1}
        aria-busy={isBusy}
      >
        <h2 id="therapist-block-heading">Horários</h2>
        <p>Informe quando você não poderá atender.</p>
        <form className="therapist-block-form" onSubmit={(event) => void reviewBlock(event)}>
          <label htmlFor="therapist-block-start">Início</label>
          <input id="therapist-block-start" name="startsAt" type="datetime-local" required />
          <label htmlFor="therapist-block-end">Fim</label>
          <input id="therapist-block-end" name="endsAt" type="datetime-local" required />
          <label htmlFor="therapist-block-reason">Motivo (opcional)</label>
          <input id="therapist-block-reason" name="reason" type="text" maxLength={200} />
          {blockError ? (
            <p className="therapist-error" role="alert">
              {blockError}
            </p>
          ) : null}
          <button type="submit" className="primary-btn therapist-action-button" aria-disabled={isBusy || undefined}>
            {isBusy ? "Aguarde" : "Revisar período"}
          </button>
        </form>
      </section>

      {confirmation ? (
        <ConfirmDialog
          isOpen
          onOpenChange={closeConfirmation}
          title={confirmation.text}
          confirmLabel={
            confirmation.type === "block"
              ? "Confirmar período"
              : confirmation.action === "CANCEL"
                ? "Confirmar cancelamento"
                : "Confirmar ausência"
          }
          busyLabel="Processando…"
          onConfirm={() => void (confirmation.type === "block" ? confirmBlock() : confirmAppointmentAction())}
          error={dialogError}
          busy={isBusy}
        >
          {null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export default TherapistActions;
