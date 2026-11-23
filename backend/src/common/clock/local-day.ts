import { addLocalDays, datePartsAt, localDateTimeToUtc } from "../../reports/report-date";

export const LOCAL_TIMEZONE = "America/Sao_Paulo";
const NEXT_DAY = 1;

export type LocalDay = Readonly<{ date: string; startsAt: Date; endsAt: Date }>;

export function localDateOf(instant: Date): string {
  return datePartsAt(instant, LOCAL_TIMEZONE).date;
}

export function localDayOf(date: string): LocalDay {
  return {
    date,
    startsAt: localDateTimeToUtc(date, LOCAL_TIMEZONE),
    endsAt: localDateTimeToUtc(addLocalDays(date, NEXT_DAY), LOCAL_TIMEZONE),
  };
}

export function localTodayOf(now: Date): LocalDay {
  return localDayOf(localDateOf(now));
}
