import { localTodayOf } from "../common/clock/local-day";
import type { LocalTime } from "../therapists/therapist-agenda.service";

const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOURS_IN_HALF_DAY = 12;
const MINUTES_PER_HOUR = 60;
const FIRST_AMBIGUOUS_HOUR = 1;
const MS_PER_MINUTE = 60_000;

export type WorkingHours = Readonly<{ startMinutes: number; endMinutes: number }>;

export type SpokenPeriod =
  | Readonly<{ kind: "VAGUE" }>
  | Readonly<{ kind: "REFUSED" }>
  | Readonly<{ kind: "FOUND"; startsAt: LocalTime; endsAt: LocalTime }>;

type Period = Readonly<{ startsAt: LocalTime; endsAt: LocalTime }>;

const minutesOf = ({ hour, minute }: LocalTime): number => hour * MINUTES_PER_HOUR + minute;

const isAmbiguousHour = (hour: number): boolean => hour >= FIRST_AMBIGUOUS_HOUR && hour < HOURS_IN_HALF_DAY;

export function clockReadingsOf(slotValue: string | undefined): readonly LocalTime[] {
  const match = slotValue === undefined ? null : CLOCK_TIME.exec(slotValue);
  if (!match) return [];
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  if (!isAmbiguousHour(hour)) return [{ hour, minute }];
  return [
    { hour, minute },
    { hour: hour + HOURS_IN_HALF_DAY, minute },
  ];
}

export function todayAt(localTime: LocalTime, now: Date): Date {
  return new Date(localTodayOf(now).startsAt.getTime() + minutesOf(localTime) * MS_PER_MINUTE);
}

export function spokenPeriodOf(
  startSlotValue: string | undefined,
  endSlotValue: string | undefined,
  workingHours: WorkingHours,
): SpokenPeriod {
  const starts = clockReadingsOf(startSlotValue);
  const ends = clockReadingsOf(endSlotValue);
  if (starts.length === 0 || ends.length === 0) return { kind: "VAGUE" };
  const fitting = starts
    .flatMap((startsAt) => ends.map((endsAt) => ({ startsAt, endsAt })))
    .filter((period) => fitsWorkingHours(period, workingHours));
  if (fitting.length === 0) return { kind: "REFUSED" };
  if (fitting.length > 1) return { kind: "VAGUE" };
  return { kind: "FOUND", ...fitting[0] };
}

function fitsWorkingHours({ startsAt, endsAt }: Period, { startMinutes, endMinutes }: WorkingHours): boolean {
  const start = minutesOf(startsAt);
  const end = minutesOf(endsAt);
  return start < end && start >= startMinutes && end <= endMinutes;
}
