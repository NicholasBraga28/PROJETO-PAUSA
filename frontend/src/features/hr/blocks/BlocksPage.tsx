import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { ApiError, errorMessage } from "@/shared/api/api-error";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { BlockForm } from "./BlockForm";
import {
  createScheduleBlock,
  getActiveTherapists,
  ScheduleBlockConflict,
  type ScheduleBlock,
  type ScheduleBlockInput,
} from "./api";
import { localBlockDateTimeToIso, spokenBlockPeriod } from "./block-time";
import { HrNavigation } from "@/features/hr/HrNavigation";

type LoadState = "loading" | "ready" | "error";
type Therapist = { id: string; name: string };

interface PendingBlock extends ScheduleBlockInput {
  localStartsAt: string;
  localEndsAt: string;
}

const conflictPeriod = (startsAt: string, endsAt: string) => spokenBlockPeriod(startsAt, endsAt);

function BlockConflicts({
  appointments,
}: {
  appointments: Array<{ id: string; startsAt: string; endsAt: string; employee: { id: string; name: string } }>;
}) {
  if (appointments.length === 0) return null;
  return (
    <section aria-labelledby="block-conflicts-title">
      <h3 id="block-conflicts-title">Há atendimentos neste período</h3>
      <p>Esses atendimentos continuam marcados. Resolva-os antes de salvar o período sem atendimento.</p>
      <ul>
        {appointments.map((appointment) => (
          <li key={appointment.id}>
            {appointment.employee.name}, {conflictPeriod(appointment.startsAt, appointment.endsAt)}.
          </li>
        ))}
      </ul>
    </section>
  );
}

function confirmationDetails(action: PendingBlock, therapists: Therapist[]) {
  const therapist = therapists.find((option) => option.id === action.therapistId);
  const startsAt = localBlockDateTimeToIso(action.localStartsAt);
  const endsAt = localBlockDateTimeToIso(action.localEndsAt);
  return (
    <>
      <p>
        Marcar período sem atendimento para {therapist?.name ?? "o massoterapeuta selecionado"},{" "}
        {spokenBlockPeriod(startsAt, endsAt)}.
      </p>
      {action.reason && <p>Motivo: {action.reason}.</p>}
      <p>
        Se houver atendimentos nesse período, será necessário resolvê-los antes. Eles não serão cancelados
        automaticamente.
      </p>
    </>
  );
}

function createdMessage(block: ScheduleBlock, therapists: Therapist[]) {
  const therapist = therapists.find((option) => option.id === block.therapistId)?.name ?? "Massoterapeuta";
  return `Período sem atendimento registrado para ${therapist}, ${spokenBlockPeriod(block.startsAt, block.endsAt)}.`;
}

export default function BlocksPage() {
  const announce = useAnnounce();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [pendingBlock, setPendingBlock] = useState<PendingBlock | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<
    Array<{ id: string; startsAt: string; endsAt: string; employee: { id: string; name: string } }>
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    getActiveTherapists().then(
      (result) => {
        if (!isCurrent) return;
        setTherapists(result);
        setLoadError(null);
        setLoadState("ready");
      },
      (error: unknown) => {
        if (!isCurrent) return;
        setLoadError(errorMessage(error));
        setLoadState("error");
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [reload]);

  useEffect(() => {
    if (loadState === "error") errorRef.current?.focus();
  }, [loadState]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    setReload((current) => current + 1);
  }, []);

  const handleConfirm = async () => {
    if (!pendingBlock) return;
    setActionBusy(true);
    setActionError(null);
    setConflicts([]);
    try {
      const created = await createScheduleBlock({
        therapistId: pendingBlock.therapistId,
        startsAt: localBlockDateTimeToIso(pendingBlock.localStartsAt),
        endsAt: localBlockDateTimeToIso(pendingBlock.localEndsAt),
        ...(pendingBlock.reason ? { reason: pendingBlock.reason } : {}),
      });
      const message = createdMessage(created, therapists);
      setPendingBlock(null);
      setSuccessMessage(message);
      announce(message);
    } catch (error: unknown) {
      setActionError(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) {
        const parsed = ScheduleBlockConflict.safeParse(error.responseBody);
        if (parsed.success) setConflicts(parsed.data.appointments);
      }
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <main id="conteudo" className="page hr-blocks-page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Horários sem atendimento
          </h1>
          <p className="lede">
            Marque um período em que o massoterapeuta não poderá atender. Esta tela registra novos períodos e não permite
            consultar ou alterar os já criados.
          </p>
        </header>
        <section className="hr-panel" aria-labelledby="create-block-title">
          <h2 id="create-block-title">Marcar período sem atendimento</h2>
          {loadState === "loading" && (
            <p className="hr-state" role="status">
              Carregando massoterapeutas ativos…
            </p>
          )}
          {loadState === "error" && loadError && (
            <div className="hr-error" role="alert" tabIndex={-1} ref={errorRef}>
              <p>{loadError}</p>
              <Button className="cta" onPress={retry}>
                Tentar novamente
              </Button>
            </div>
          )}
          {loadState === "ready" && therapists.length === 0 && (
            <p className="hr-empty">Não há massoterapeutas ativos no momento.</p>
          )}
          {loadState === "ready" && therapists.length > 0 && (
            <BlockForm
              therapists={therapists}
              isDisabled={actionBusy}
              onSubmit={(input) => {
                setSuccessMessage(null);
                setActionError(null);
                setConflicts([]);
                setPendingBlock({
                  ...input,
                  localStartsAt: input.startsAt,
                  localEndsAt: input.endsAt,
                  startsAt: localBlockDateTimeToIso(input.startsAt),
                  endsAt: localBlockDateTimeToIso(input.endsAt),
                });
              }}
            />
          )}
          {successMessage && (
            <p className="hr-success" role="status">
              {successMessage}
            </p>
          )}
        </section>
        <ConfirmDialog
          isOpen={pendingBlock !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen && !actionBusy) {
              setPendingBlock(null);
              setActionError(null);
              setConflicts([]);
            }
          }}
          title="Marcar período sem atendimento?"
          confirmLabel="Confirmar período"
          busyLabel="Salvando período…"
          onConfirm={handleConfirm}
          error={actionError}
          busy={actionBusy}
        >
          {pendingBlock && confirmationDetails(pendingBlock, therapists)}
          <BlockConflicts appointments={conflicts} />
        </ConfirmDialog>
      </div>
    </main>
  );
}
