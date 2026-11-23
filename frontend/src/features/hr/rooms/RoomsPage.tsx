import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { errorMessage } from "@/shared/api/api-error";
import { LocationCode } from "@/shared/api/schemas";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { RoomFilter } from "./RoomFilter";
import { RoomForm } from "./RoomForm";
import {
  createRoom,
  getAdminLocations,
  getRooms,
  regenerateRoomToken,
  type AdminLocation,
  type CreateRoomInput,
  type RoomFilters,
  type RoomSummary,
} from "./api";
import { RoomsResults } from "./RoomsResults";
import { HrNavigation } from "@/features/hr/HrNavigation";

type LoadState = "loading" | "ready" | "error";
type PendingAction = { kind: "create"; input: CreateRoomInput } | { kind: "regenerate"; room: RoomSummary };

const ALL_FILTER = { id: "all", label: "Todas as unidades" };
const STATUS_OPTIONS = [
  { id: "all", label: "Todos os status" },
  { id: "true", label: "Ativas" },
  { id: "false", label: "Inativas" },
];

const toRoomSummaries = (rooms: Awaited<ReturnType<typeof getRooms>>, locations: AdminLocation[]): RoomSummary[] =>
  rooms.map((room) => ({
    ...room,
    locationName: locations.find((location) => location.id === room.locationId)?.name ?? room.locationCode,
  }));

export default function RoomsPage() {
  const announce = useAnnounce();
  const errorRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [filters, setFilters] = useState<RoomFilters>({ locationCode: "", active: "" });
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [printRoomId, setPrintRoomId] = useState<string | null>(null);
  const activeLocations = locations.filter((location) => location.active);
  const unitOptions = [ALL_FILTER, ...locations.map((location) => ({ id: location.code, label: location.name }))];

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getAdminLocations(), getRooms(filters)]).then(
      ([locationResult, roomResult]) => {
        if (!isCurrent) return;
        setLocations(locationResult);
        setRooms(toRoomSummaries(roomResult, locationResult));
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
  }, [filters, reload]);

  useEffect(() => {
    if (loadState === "error") errorRef.current?.focus();
  }, [loadState]);

  useEffect(() => {
    if (printRoomId === null) return;
    const handleAfterPrint = () => setPrintRoomId(null);
    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printRoomId]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    setReload((value) => value + 1);
  }, []);

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (pendingAction.kind === "create") {
        const created = await createRoom(pendingAction.input);
        const location = locations.find((item) => item.id === created.locationId);
        const createdRoom: RoomSummary = { ...created, locationName: location?.name ?? created.locationCode };
        const message = `${created.name} cadastrada em ${createdRoom.locationName}.`;
        setRooms((current) => [...current, createdRoom]);
        setShowCreateForm(false);
        setPendingAction(null);
        setActionMessage(message);
        announce(message);
        return;
      }

      const regenerated = await regenerateRoomToken(pendingAction.room.id);
      setRooms((current) =>
        current.map((room) =>
          room.id === regenerated.id ? { ...room, checkInToken: regenerated.checkInToken } : room,
        ),
      );
      const message = `QR Code da ${regenerated.name} atualizado. O código anterior deixou de funcionar.`;
      setPendingAction(null);
      setActionMessage(message);
      announce(message);
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  };

  const isCreateAction = pendingAction?.kind === "create";
  const selectedLocation =
    pendingAction?.kind === "create"
      ? locations.find((location) => location.id === pendingAction.input.locationId)
      : undefined;
  const confirmationTitle = isCreateAction ? "Cadastrar esta sala?" : "Regenerar QR Code?";
  const confirmationLabel = isCreateAction ? "Confirmar cadastro" : "Confirmar regeneração";
  const confirmationBusyLabel = isCreateAction ? "Cadastrando…" : "Regenerando…";

  return (
    <main id="conteudo" className="page hr-rooms-page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading hr-rooms-heading">
          <div>
            <h1 tabIndex={-1} className="display">
              Unidades e salas
            </h1>
            <p className="lede">Organize as salas e prepare o check-in de cada unidade.</p>
          </div>
          {activeLocations.length > 0 && (
            <Button
              className="cta"
              onPress={() => {
                setActionError(null);
                setShowCreateForm((value) => !value);
              }}
            >
              {showCreateForm ? "Cancelar cadastro" : "Cadastrar sala"}
            </Button>
          )}
        </header>
        <section className="hr-room-filter-panel" aria-labelledby="room-filters-title">
          <details className="hr-room-filter-disclosure" open>
            <summary id="room-filters-title">Filtrar salas</summary>
            <div className="hr-filters hr-room-filters">
              <RoomFilter
                label="Unidade"
                value={filters.locationCode}
                options={unitOptions}
                onChange={(locationCode) => {
                  const parsed = LocationCode.safeParse(locationCode);
                  setLoadState("loading");
                  setLoadError(null);
                  setFilters((current) => ({ ...current, locationCode: parsed.success ? parsed.data : "" }));
                }}
              />
              <RoomFilter
                label="Status"
                value={filters.active === "" ? "" : String(filters.active)}
                options={STATUS_OPTIONS}
                onChange={(active) => {
                  setLoadState("loading");
                  setLoadError(null);
                  setFilters((current) => ({ ...current, active: active === "" ? "" : active === "true" }));
                }}
              />
            </div>
          </details>
        </section>
        <section className="hr-panel" aria-labelledby="rooms-list-title">
          <div className="hr-section-heading">
            <h2 id="rooms-list-title">Salas cadastradas</h2>
            {loadState === "ready" && (
              <p className="hr-room-count">
                {rooms.length} {rooms.length === 1 ? "sala" : "salas"}
              </p>
            )}
          </div>
          {activeLocations.length === 0 && loadState === "ready" && (
            <p className="hr-help">Não há unidades ativas para cadastrar salas.</p>
          )}
          {actionMessage && (
            <p className="hr-success" role="status">
              {actionMessage}
            </p>
          )}
          {showCreateForm && activeLocations.length > 0 && (
            <RoomForm
              locations={activeLocations}
              isDisabled={actionBusy}
              onSubmit={(input) => {
                setActionError(null);
                setPendingAction({ kind: "create", input });
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          )}
          {loadState === "loading" && (
            <p className="hr-state" role="status">
              Carregando unidades e salas…
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
            <RoomsResults
              rooms={rooms}
              origin={window.location.origin}
              printRoomId={printRoomId}
              onRegenerate={(room) => {
                setActionError(null);
                setPendingAction({ kind: "regenerate", room });
              }}
              onPrint={setPrintRoomId}
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        isOpen={pendingAction !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !actionBusy) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
        title={confirmationTitle}
        confirmLabel={confirmationLabel}
        busyLabel={confirmationBusyLabel}
        onConfirm={handleConfirm}
        busy={actionBusy}
        error={actionError}
        confirmClassName="cta"
      >
        {pendingAction?.kind === "create" ? (
          <p>
            A sala {pendingAction.input.name} será cadastrada na unidade {selectedLocation?.name}. Um novo código de
            entrada será criado.
          </p>
        ) : (
          <p>O QR Code atual deixará de funcionar. Confirme para gerar e mostrar um novo código.</p>
        )}
      </ConfirmDialog>
    </main>
  );
}
