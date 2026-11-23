import { dateLabel, localParts, TIMEZONE } from "@/shared/time/local-time";

const LOCAL_DATE_TIME_FORMAT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
const CONVERSION_ATTEMPTS = 3;

export function localBlockDateTimeToIso(value: string): string {
  const match = LOCAL_DATE_TIME_FORMAT.exec(value);
  if (!match) throw new Error("Informe data e horário válidos.");
  const [, date, time] = match;
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Informe data e horário válidos.");
  let guess = target;
  for (let attempt = 0; attempt < CONVERSION_ATTEMPTS; attempt++) {
    const parts = localParts(guess, TIMEZONE);
    const localMinutes = `${String(Math.floor(parts.minutes / 60)).padStart(2, "0")}:${String(parts.minutes % 60).padStart(2, "0")}`;
    guess += target - Date.parse(`${parts.date}T${localMinutes}:00Z`);
  }
  return new Date(guess).toISOString();
}

const spokenHour = (instant: string) => {
  const minutes = localParts(instant, TIMEZONE).minutes;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
};

export function spokenBlockPeriod(startsAt: string, endsAt: string): string {
  const date = localParts(startsAt, TIMEZONE).date;
  const spokenDate = dateLabel(date, { weekday: "long", day: "numeric", month: "long" });
  return `${spokenDate}, das ${spokenHour(startsAt)} às ${spokenHour(endsAt)}`;
}
