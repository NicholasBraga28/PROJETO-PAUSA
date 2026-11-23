import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { ApiError, errorMessage } from "@/shared/api/api-error";
import { dateLabel, dayOf } from "@/shared/time/local-time";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import {
  copySchedules,
  createSchedule,
  deleteSchedule,
  getRooms,
  getScheduleLocations,
  getSchedules,
  getTherapists,
  ScheduleConflictBody,
  updateSchedule,
  type CopySchedulesInput,
  type ScheduleCopyResult,
  type ScheduleFilters as ScheduleFilterState,
  type ScheduleInput,
  type ScheduleLocation,
  type ScheduleRoom,
  type ScheduleSlot,
} from "./api";
import { spokenScheduleTime } from "./local-schedule-time";
import { ScheduleCopyForm } from "./ScheduleCopyForm";
import { ScheduleFilters } from "./ScheduleFilters";
import { ScheduleResults, type ScheduleSummary } from "./ScheduleResults";
import { ScheduleSlotForm } from "./ScheduleSlotForm";
import { HrNavigation } from "@/features/hr/HrNavigation";

type LoadState = "loading" | "ready" | "error";
type TherapistOption = { id: string; name: string };
type PendingAction =
  | { kind: "create"; input: ScheduleInput }
  | { kind: "update"; schedule: ScheduleSummary; input: ScheduleInput }
  | { kind: "delete"; schedule: ScheduleSummary }
  | { kind: "copy"; input: CopySchedulesInput };

const emptyFilters = (date: string): ScheduleFilterState => ({ date, locationCode: "", therapistId: "", roomId: "" });

function summarizeSchedules(
  slots: ScheduleSlot[],
  therapists: TherapistOption[],
  rooms: ScheduleRoom[],
  locations: ScheduleLocation[],
) {
  return slots.map((slot) => {
    const room = rooms.find((item) => item.id === slot.roomId);
    const location = locations.find((item) => item.id === room?.locationId);
    return {
      ...slot,
      therapistName: therapists.find((item) => item.id === slot.therapistId)?.name ?? "Massoterapeuta",
      roomName: room?.name ?? "Sala",
      locationName: location?.name ?? room?.locationCode ?? "Unidade",
    } satisfies ScheduleSummary;
  });
}

const formatTime = (instant: string) => {
  const hour = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric" }).format(
    new Date(instant),
  );
  const minute = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", minute: "2-digit" })
    .format(new Date(instant))
    .padStart(2, "0");
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
};

function confirmationDetails(action: PendingAction, therapists: TherapistOption[], rooms: ScheduleRoom[]) {
  if (action.kind === "copy") {
    const therapist = therapists.find((item) => item.id === action.input.therapistId)?.name;
    return (
      <div>
        <p>
          Data de origem:{" "}
          <time dateTime={action.input.sourceDate}>
            {dateLabel(action.input.sourceDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </time>
          . {therapist ? `Massoterapeuta: ${therapist}.` : "Todos os massoterapeutas."}
        </p>
        <p>Datas de destino:</p>
        <ul>
          {action.input.targetDates.map((date) => (
            <li key={date}>
              <time dateTime={date}>
                {dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </time>
            </li>
          ))}
        </ul>
        <p>Uma data com conflito será ignorada; as demais poderão ser copiadas.</p>
      </div>
    );
  }

  if (action.kind === "delete") {
    return (
      <p>
        Remover o período de {action.schedule.therapistName}, {action.schedule.roomName}, {periodLabel(action.schedule)}
        . Se houver um atendimento em andamento, não será possível remover este horário. Os atendimentos que impedem a
        remoção serão mostrados.
      </p>
    );
  }

  const therapistId = action.kind === "create" ? action.input.therapistId : action.schedule.therapistId;
  const therapistName = therapists.find((item) => item.id === therapistId)?.name ?? "Massoterapeuta";
  const roomName = rooms.find((item) => item.id === action.input.roomId)?.name ?? "Sala";
  const period = `${spokenScheduleTime(action.input.startsAt)} até ${formatTime(action.input.endsAt)}`;
  return (
    <p>
      {action.kind === "create" ? "Criar" : "Atualizar"} período de {therapistName}, {roomName}, {period}.
    </p>
  );
}

function periodLabel(schedule: Pick<ScheduleSlot, "startsAt" | "endsAt">) {
  return `${spokenScheduleTime(schedule.startsAt)} até ${formatTime(schedule.endsAt)}`;
}

function CopyResult({
  result,
  therapists,
  rooms,
  locations,
}: {
  result: ScheduleCopyResult;
  therapists: TherapistOption[];
  rooms: ScheduleRoom[];
  locations: ScheduleLocation[];
}) {
  const created = summarizeSchedules(result.created, therapists, rooms, locations);
  const createdCount = created.length;
  const skippedCount = result.skipped.length;
  const createdSummary = `${createdCount} ${createdCount === 1 ? "período criado" : "períodos criados"}`;
  const skippedSummary = `${skippedCount} ${skippedCount === 1 ? "data ignorada" : "datas ignoradas"}`;
  return (
    <section className="hr-schedule-copy-result" aria-labelledby="copy-result-title">
      <h3 id="copy-result-title">Resultado da cópia</h3>
      <p>
        {createdSummary}; {skippedSummary}.
      </p>
      {created.length > 0 && (
        <ul aria-label="Períodos criados pela cópia">
          {created.map((schedule) => (
            <li key={schedule.id}>
              {schedule.therapistName}, {schedule.roomName}, {periodLabel(schedule)}.
            </li>
          ))}
        </ul>
      )}
      {result.skipped.length > 0 && (
        <ul aria-label="Datas ignoradas pela cópia">
          {result.skipped.map(({ date, message }) => (
            <li key={date}>
              <time dateTime={date}>
                {dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </time>
              : {message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SchedulesPage() {
  const announce = useAnnounce();
  const today = dayOf(new Date());
  const [filters, setFilters] = useState(() => emptyFilters(today));
  const [submittedFilters, setSubmittedFilters] = useState(() => emptyFilters(today));
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [rooms, setRooms] = useState<ScheduleRoom[]>([]);
  const [locations, setLocations] = useState<ScheduleLocation[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionConflicts, setActionConflicts] = useState<
    Array<{ id: string; startsAt: string; endsAt: string; employee: { id: string; name: string } }>
  >([]);
  const [copyResult, setCopyResult] = useState<ScheduleCopyResult | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const announceResults = useRef(false);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getSchedules(submittedFilters), getTherapists(), getRooms(), getScheduleLocations()]).then(
      ([slotResult, therapistResult, roomResult, locationResult]) => {
        if (!isCurrent) return;
        setSchedules(summarizeSchedules(slotResult, therapistResult, roomResult, locationResult));
        setTherapists(therapistResult);
        setRooms(roomResult);
        setLocations(locationResult);
        setLoadError(null);
        setLoadState("ready");
        if (announceResults.current) {
          announceResults.current = false;
          announce(
            slotResult.length === 0
              ? "Nenhum período encontrado para esta data."
              : `${slotResult.length} períodos encontrados.`,
          );
        }
      },
      (error: unknown) => {
        if (!isCurrent) return;
        announceResults.current = false;
        setLoadError(errorMessage(error));
        setLoadState("error");
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [announce, reload, submittedFilters]);

  useEffect(() => {
    if (loadState === "error") errorRef.current?.focus();
  }, [loadState]);

  const retry = useCallback(() => {
    setLoadError(null);
    setLoadState("loading");
    setReload((current) => current + 1);
  }, []);

  const startReload = (message: string) => {
    setPendingAction(null);
    setActionError(null);
    setActionConflicts([]);
    setShowCreateForm(false);
    setEditingSchedule(null);
    announce(message);
    setLoadState("loading");
    setReload((current) => current + 1);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    setActionConflicts([]);
    try {
      if (pendingAction.kind === "create") {
        const created = await createSchedule(pendingAction.input);
        const therapistName = therapists.find((item) => item.id === created.therapistId)?.name ?? "Massoterapeuta";
        const roomName = rooms.find((item) => item.id === created.roomId)?.name ?? "Sala";
        startReload(`Período de ${therapistName}, ${roomName}, ${periodLabel(created)} criado.`);
      } else if (pendingAction.kind === "update") {
        await updateSchedule(pendingAction.schedule.id, {
          roomId: pendingAction.input.roomId,
          startsAt: pendingAction.input.startsAt,
          endsAt: pendingAction.input.endsAt,
        });
        startReload(
          `Período de ${pendingAction.schedule.therapistName}, ${periodLabel(pendingAction.input)} atualizado.`,
        );
      } else if (pendingAction.kind === "delete") {
        await deleteSchedule(pendingAction.schedule.id);
        startReload(`Período de ${pendingAction.schedule.therapistName} removido.`);
      } else {
        const result = await copySchedules(pendingAction.input);
        setCopyResult(result);
        const createdCount = result.created.length;
        const skippedCount = result.skipped.length;
        const createdSummary = `${createdCount} ${createdCount === 1 ? "período criado" : "períodos criados"}`;
        const skippedSummary = `${skippedCount} ${skippedCount === 1 ? "data ignorada" : "datas ignoradas"}`;
        startReload(`Cópia concluída: ${createdSummary}; ${skippedSummary}.`);
      }
    } catch (error: unknown) {
      setActionError(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) {
        const parsed = ScheduleConflictBody.safeParse(error.responseBody);
        if (parsed.success) setActionConflicts(parsed.data.appointments);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleSearch = () => {
    announceResults.current = true;
    setCopyResult(null);
    setLoadError(null);
    setLoadState("loading");
    setSubmittedFilters({ ...filters });
  };

  const pendingTitle =
    pendingAction?.kind === "create"
      ? "Criar período de trabalho?"
      : pendingAction?.kind === "update"
        ? "Atualizar período de trabalho?"
        : pendingAction?.kind === "delete"
          ? "Remover período de trabalho?"
          : "Copiar agenda para estas datas?";
  const confirmLabel =
    pendingAction?.kind === "create"
      ? "Confirmar criação"
      : pendingAction?.kind === "update"
        ? "Confirmar alteração"
        : pendingAction?.kind === "delete"
          ? "Confirmar remoção"
          : "Confirmar cópia";

  return (
    <main id="conteudo" className="page hr-schedules-page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Agendas diárias
          </h1>
          <p className="lede">Monte períodos de trabalho e copie uma agenda para datas futuras escolhidas.</p>
        </header>
        <section className="hr-panel" aria-labelledby="schedule-filters-title">
          <h2 id="schedule-filters-title">Consultar agenda</h2>
          <ScheduleFilters
            filters={filters}
            locations={locations}
            therapists={therapists}
            rooms={rooms}
            onChange={setFilters}
            onSearch={handleSearch}
          />
        </section>
        <section className="hr-panel" aria-labelledby="schedule-list-title">
          <div className="hr-section-heading">
            <h2 id="schedule-list-title">Períodos de trabalho</h2>
            <Button
              className="cta"
              onPress={() => {
                setEditingSchedule(null);
                setShowCreateForm((visible) => !visible);
                setActionError(null);
              }}
              isDisabled={loadState !== "ready" || therapists.length === 0 || rooms.length === 0}
            >
              {showCreateForm ? "Fechar cadastro" : "Adicionar período"}
            </Button>
          </div>
          {showCreateForm && loadState === "ready" && (
            <ScheduleSlotForm
              date={submittedFilters.date}
              slot={null}
              therapists={therapists}
              rooms={rooms.filter((room) => room.active)}
              isDisabled={actionBusy}
              onSubmit={(input) => setPendingAction({ kind: "create", input })}
              onCancel={() => setShowCreateForm(false)}
            />
          )}
          {editingSchedule && (
            <ScheduleSlotForm
              date={submittedFilters.date}
              slot={editingSchedule}
              therapists={therapists}
              rooms={rooms.filter((room) => room.active)}
              isDisabled={actionBusy}
              onSubmit={(input) => setPendingAction({ kind: "update", schedule: editingSchedule, input })}
              onCancel={() => setEditingSchedule(null)}
            />
          )}
          {loadState === "loading" && (
            <p className="hr-state" role="status">
              Carregando agenda…
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
          {loadState === "ready" && (
            <ScheduleResults
              schedules={schedules}
              onEdit={(schedule) => {
                setShowCreateForm(false);
                setEditingSchedule(schedule);
                setActionError(null);
              }}
              onRemove={(schedule) => {
                setActionConflicts([]);
                setActionError(null);
                setPendingAction({ kind: "delete", schedule });
              }}
            />
          )}
        </section>
        <section className="hr-panel" aria-labelledby="schedule-copy-panel-title">
          <h2 id="schedule-copy-panel-title">Copiar um dia modelo</h2>
          <p>Escolha a data de origem e cada data futura. A cópia não cria recorrência.</p>
          <ScheduleCopyForm
            defaultSourceDate={submittedFilters.date}
            therapists={therapists}
            onSubmit={(input) => {
              setActionError(null);
              setCopyResult(null);
              setPendingAction({ kind: "copy", input });
            }}
          />
          {copyResult && <CopyResult result={copyResult} therapists={therapists} rooms={rooms} locations={locations} />}
        </section>
      </div>
      <ConfirmDialog
        isOpen={pendingAction !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !actionBusy) {
            setPendingAction(null);
            setActionError(null);
            setActionConflicts([]);
          }
        }}
        title={pendingTitle}
        confirmLabel={confirmLabel}
        busyLabel="Salvando…"
        onConfirm={handleConfirm}
        busy={actionBusy}
        error={actionError}
        confirmClassName="cta"
      >
        {pendingAction && confirmationDetails(pendingAction, therapists, rooms)}
        {actionConflicts.length > 0 && (
          <section aria-labelledby="schedule-conflict-title">
            <h3 id="schedule-conflict-title">Atendimentos que impedem a alteração</h3>
            <ul>
              {actionConflicts.map((appointment) => (
                <li key={appointment.id}>
                  {appointment.employee.name}, {periodLabel(appointment)}.
                </li>
              ))}
            </ul>
          </section>
        )}
      </ConfirmDialog>
    </main>
  );
}
