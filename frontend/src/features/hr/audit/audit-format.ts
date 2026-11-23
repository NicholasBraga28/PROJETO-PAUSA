import { TIMEZONE } from "@/shared/time/local-time";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function startOfLocalDateUtc(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const nominalUtc = Date.UTC(year, month - 1, day);
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date(nominalUtc)).map(({ type, value }) => [type, value]),
  );
  const representedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(nominalUtc - (representedUtc - nominalUtc)).toISOString();
}

export function nextDate(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function rangeToUtc(from: string, to: string) {
  return { from: startOfLocalDateUtc(from), to: startOfLocalDateUtc(nextDate(to)) };
}

export function dateTimeLabel(instant: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(instant));
}

export function actionLabel(action: string) {
  const labels: Record<string, string> = {
    APPOINTMENT_CREATED: "Agendamento criado",
    APPOINTMENT_CANCELLED: "Agendamento cancelado",
    APPOINTMENT_CHECKED_IN: "Check-in registrado",
    SESSION_STARTED: "Sessão iniciada",
    SESSION_FINISHED: "Sessão finalizada",
    SESSION_AUTO_COMPLETED: "Sessão concluída automaticamente",
    APPOINTMENT_MARKED_NO_SHOW: "Ausência registrada",
  };
  return labels[action] ?? "Evento do agendamento registrado";
}

export function statusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    BOOKED: "Reservado",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado",
    CHECKED_IN: "Check-in registrado",
    POSSIBLE_NO_SHOW: "Possível ausência",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluído",
    RELEASED: "Liberado",
    NO_SHOW: "Ausência registrada",
  };
  return status ? labels[status] : null;
}
