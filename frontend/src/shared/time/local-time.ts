export const TIMEZONE = "America/Sao_Paulo";

const DAY_MS = 86_400_000;

export type Instant = string | number | Date;

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const PARTS = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timezone: string) {
  let formatter = PARTS.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    PARTS.set(timezone, formatter);
  }
  return formatter;
}

export function localParts(instant: Instant, timezone = TIMEZONE) {
  const p = Object.fromEntries(partsFormatter(timezone).formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
export const dayOf = (instant: Instant, timezone = TIMEZONE) => localParts(instant, timezone).date;
export const minutesOf = (instant: Instant, timezone = TIMEZONE) => localParts(instant, timezone).minutes;
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function nextDays(n: number, now = new Date(), timezone = TIMEZONE) {
  const today = Date.parse(`${dayOf(now, timezone)}T00:00:00Z`);
  return range(n).map((k) => new Date(today + k * DAY_MS).toISOString().slice(0, 10));
}

export const dateLabel = (day: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", ...opts });

export function relDay(day: string, now = new Date(), timezone = TIMEZONE) {
  const [today, tomorrow] = nextDays(2, now, timezone);
  if (day === today) return "hoje";
  if (day === tomorrow) return "amanhã";
  return dateLabel(day, { weekday: "long", day: "numeric" });
}

export const periodOf = (m: number) => (m < 12 * 60 ? "Manhã" : m < 18 * 60 ? "Tarde" : "Noite");

export function whenLabel(instant: Instant, now = new Date(), timezone = TIMEZONE) {
  const { date, minutes } = localParts(instant, timezone);
  return `${relDay(date, now, timezone)}, ${hhmm(minutes)}`;
}
