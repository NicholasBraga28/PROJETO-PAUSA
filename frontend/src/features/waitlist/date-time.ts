import { localParts, TIMEZONE } from "@/shared/time/local-time";

function dateAndTime(instant: string) {
  const { date, minutes } = localParts(instant, TIMEZONE);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const time = minute ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return { day, time };
}

export const waitlistDateTime = (instant: string) => {
  const { day, time } = dateAndTime(instant);
  return `${day}, às ${time}`;
};

export function waitlistPeriod(startsAt: string, endsAt: string) {
  const start = dateAndTime(startsAt);
  const end = dateAndTime(endsAt);
  return start.day === end.day
    ? `${start.day}, das ${start.time} às ${end.time}`
    : `De ${waitlistDateTime(startsAt)} até ${waitlistDateTime(endsAt)}`;
}
