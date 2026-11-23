import { Button } from "react-aria-components";
import { Link } from "react-router";
import type { WaitlistEntry } from "@/shared/api/schemas";
import { waitlistDateTime, waitlistPeriod } from "@/features/waitlist/date-time";

const STATUS_LABEL = {
  WAITING: "Aguardando vaga",
  NOTIFIED: "Vaga oferecida",
  CONVERTED: "Convertida em agendamento",
  CANCELLED: "Saiu da lista",
  EXPIRED: "Oferta expirada",
  DECLINED: "Oferta recusada",
} as const;

interface WaitlistEntriesProps {
  items: WaitlistEntry[];
  busyId: string | null;
  onLeave: (entry: WaitlistEntry) => void;
  onAccept: (entry: WaitlistEntry) => void;
  onDecline: (entry: WaitlistEntry) => void;
}

export function WaitlistEntries({ items, busyId, onLeave, onAccept, onDecline }: WaitlistEntriesProps) {
  return (
    <ul className="cards waitlist-cards" aria-label="Entradas da lista de espera">
      {items.map((entry, index) => (
        <li key={entry.id} className="card waitlist-card">
          <div className="card-main">
            <p className="card-when">{waitlistPeriod(entry.desiredStartsAt, entry.desiredEndsAt)}</p>
            <p className="sum-meta">
              {entry.therapistName ?? "Terapeuta a definir"} · {entry.locationName ?? "Unidade a definir"}
            </p>
            <p className="sum-meta">{entry.spokenText}</p>
          </div>
          <span className={`status waitlist-status waitlist-status-${entry.status.toLowerCase()}`}>
            {STATUS_LABEL[entry.status]}
          </span>
          {entry.status === "NOTIFIED" && entry.offerExpiresAt && (
            <Button
              className="cta"
              onPress={() => onAccept(entry)}
              aria-label={`Aceitar horário oferecido para ${waitlistDateTime(entry.desiredStartsAt)}, entrada ${index + 1}`}
              isDisabled={busyId === entry.id}
            >
              Aceitar horário oferecido
            </Button>
          )}
          {entry.status === "NOTIFIED" && entry.offerExpiresAt && (
            <Button
              className="ghost-btn"
              onPress={() => onDecline(entry)}
              aria-label={`Recusar oferta para ${waitlistDateTime(entry.desiredStartsAt)}, entrada ${index + 1}`}
              isDisabled={busyId === entry.id}
            >
              Recusar oferta
            </Button>
          )}
          {entry.status === "CONVERTED" && (
            <Link
              className="ghost-btn"
              to="/sessions#sessoes"
              aria-label={`Ver minhas sessões após conversão de ${waitlistDateTime(entry.desiredStartsAt)}`}
            >
              Ver minhas sessões
            </Link>
          )}
          {(entry.status === "WAITING" || entry.status === "NOTIFIED") && (
            <Button
              className="ghost-btn"
              onPress={() => onLeave(entry)}
              aria-label={`Sair da lista de espera para ${waitlistDateTime(entry.desiredStartsAt)}, entrada ${index + 1}`}
              isDisabled={busyId === entry.id}
            >
              Sair da lista de espera
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
