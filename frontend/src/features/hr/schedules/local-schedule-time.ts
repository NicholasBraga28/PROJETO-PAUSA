import { localParts, TIMEZONE } from "@/shared/time/local-time";

const LOCAL_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_FORMAT = /^\d{2}:\d{2}$/;
const CONVERSION_ATTEMPTS = 3;

const utcComparable = (date: string, time: string) => Date.parse(`${date}T${time}:00Z`);

export function localDateTimeToIso(date: string, time: string, timezone = TIMEZONE): string {
  if (!LOCAL_DATE_FORMAT.test(date) || !LOCAL_TIME_FORMAT.test(time))
    throw new Error("Informe data e horário válidos.");
  const target = utcComparable(date, time);
  if (!Number.isFinite(target)) throw new Error("Informe data e horário válidos.");
  let guess = target;
  for (let attempt = 0; attempt < CONVERSION_ATTEMPTS; attempt++) {
    const parts = localParts(guess, timezone);
    const currentLocal = utcComparable(
      parts.date,
      `${String(Math.floor(parts.minutes / 60)).padStart(2, "0")}:${String(parts.minutes % 60).padStart(2, "0")}`,
    );
    guess += target - currentLocal;
  }
  return new Date(guess).toISOString();
}

export function localDateTimeOf(instant: string, timezone = TIMEZONE): { date: string; time: string } {
  const { date, minutes } = localParts(instant, timezone);
  return {
    date,
    time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
  };
}

export function spokenScheduleTime(instant: string, timezone = TIMEZONE): string {
  const { date, time } = localDateTimeOf(instant, timezone);
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  const calendarDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const [hours, minutes] = time.split(":").map(Number);
  const spokenHour = minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${weekday}, ${calendarDate}, às ${spokenHour}`;
}
