import type { KpiReport } from "./api";

const SHIFT_LABELS: Record<KpiReport["demand"]["byShift"][number]["shift"], string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
};

const WEEKDAY_LABELS: Record<KpiReport["demand"]["byWeekday"][number]["weekday"], string> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terça-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export const labelForShift = (shift: KpiReport["demand"]["byShift"][number]["shift"]) => SHIFT_LABELS[shift];
export const labelForWeekday = (weekday: KpiReport["demand"]["byWeekday"][number]["weekday"]) =>
  WEEKDAY_LABELS[weekday];

export function formatReportTime(time: string) {
  const [hour = "0", minute = "00"] = time.split(":");
  return `${Number(hour)}h${minute === "00" ? "" : minute}`;
}

export function formatReportDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

export function currentMonthRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find(({ type }) => type === "year")?.value ?? "";
  const month = parts.find(({ type }) => type === "month")?.value ?? "";
  return monthRange(Number(year), Number(month));
}

export function shiftMonthRange(from: string, offset: number) {
  const [year = 0, month = 1] = from.split("-").map(Number);
  const shiftedDate = new Date(Date.UTC(year, month - 1 + offset, 1));
  return monthRange(shiftedDate.getUTCFullYear(), shiftedDate.getUTCMonth() + 1);
}

export function formatMonthLabel(from: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${from}T12:00:00.000Z`));
}

export function formatReportCompactDate(date: string) {
  const [, month = "01", day = "01"] = date.split("-");
  return `${Number(day)}/${month}`;
}

function monthRange(year: number, month: number) {
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const yearLabel = firstDate.getUTCFullYear();
  const monthLabel = String(firstDate.getUTCMonth() + 1).padStart(2, "0");
  const finalDay = new Date(Date.UTC(yearLabel, firstDate.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    from: `${yearLabel}-${monthLabel}-01`,
    to: `${yearLabel}-${monthLabel}-${String(finalDay).padStart(2, "0")}`,
  };
}
