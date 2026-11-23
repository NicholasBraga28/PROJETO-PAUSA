import { useMemo, useState, type ReactNode, type Ref } from "react";
import { Button } from "react-aria-components";
import { Link } from "react-router";
import { localParts, dateLabel, hhmm } from "@/shared/time/local-time";
import { errorMessage } from "@/shared/api/api-error";
import type { Appointment, MyAppointments } from "@/shared/api/schemas";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { useFocusAfterRemoval } from "@/shared/a11y/use-focus-after-removal";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { LOCATION_LABEL } from "@/shared/ui/location-label";
import { cancelAppointment } from "@/features/appointments/api";
import { STATUS_LABEL, CANCELLABLE } from "@/features/appointments/status";

const when = (instant: string) => {
  const { date, minutes } = localParts(instant);
  return { day: dateLabel(date, { weekday: "long", day: "numeric", month: "long" }), time: hhmm(minutes) };
};
const placeOf = (a: Appointment) =>
  `${a.roomName}${a.locationCode ? `, ${LOCATION_LABEL[a.locationCode] ?? a.locationCode}` : ""}`;

interface SessionsProps {
  mine: MyAppointments;
  onChanged: () => void;
}

export default function Sessions({ mine, onChanged }: SessionsProps) {
  const announce = useAnnounce();
  const [target, setTarget] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upcomingIds = useMemo(() => mine.upcoming.map((appointment) => appointment.id), [mine]);
  const { itemRef, titleRef, willRemove } = useFocusAfterRemoval<HTMLLIElement>(upcomingIds);

  async function cancel() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cancelAppointment(target.id);
      willRemove(target.id);
      setTarget(null);
      announce(result.spokenText);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 ref={titleRef} tabIndex={-1} className="list-title">
        Próximas
      </h2>
      {mine.upcoming.length ? (
        <ul className="cards">
          {mine.upcoming.map((a) => (
            <Card key={a.id} appointment={a} itemRef={itemRef(a.id)}>
              {CANCELLABLE.has(a.status) && (
                <Button
                  className="ghost-btn"
                  onPress={() => {
                    setError(null);
                    setTarget(a);
                  }}
                  aria-label={`Cancelar a sessão de ${when(a.startsAt).day}, ${when(a.startsAt).time}`}
                >
                  Cancelar
                </Button>
              )}
            </Card>
          ))}
        </ul>
      ) : (
        <p className="none">
          {mine.past.length ? "Você não tem agendamentos futuros." : "Você não tem agendamentos."}{" "}
          <Link className="link" to="/book">
            Reservar horário
          </Link>
        </p>
      )}

      <h2 className="list-title">Anteriores</h2>
      {mine.past.length ? (
        <ul className="cards past-list" aria-label="Sessões anteriores">
          {mine.past.map((a) => (
            <Card key={a.id} appointment={a} />
          ))}
        </ul>
      ) : (
        <p className="none">Você ainda não tem sessões anteriores.</p>
      )}
      <ConfirmDialog
        isOpen={target != null}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
        title="Cancelar esta sessão?"
        confirmLabel="Cancelar sessão"
        busyLabel="Cancelando…"
        onConfirm={cancel}
        busy={busy}
        error={error}
      >
        {target && (
          <p>
            {when(target.startsAt).day}, às {when(target.startsAt).time}, com {target.therapistName} ({placeOf(target)}
            ). O horário volta a ficar livre para outras pessoas.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

interface CardProps {
  appointment: Appointment;
  children?: ReactNode;
  itemRef?: Ref<HTMLLIElement>;
}

function Card({ appointment: a, itemRef, children }: CardProps) {
  const { day, time } = when(a.startsAt);
  return (
    <li ref={itemRef} tabIndex={itemRef ? -1 : undefined} className="card">
      <div className="card-main">
        <p className="card-when">
          <span className="cap">{day}</span>, {time}
        </p>
        <p className="sum-meta">
          com {a.therapistName} · {placeOf(a)}
        </p>
      </div>
      <span className={`status status-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
      {children}
    </li>
  );
}
