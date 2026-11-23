import type { AvailableSlot, Location } from "@/shared/api/schemas";
import { localParts } from "@/shared/time/local-time";

export type HourRange = [number, number];

export interface SlotFilter {
  location?: string;
  therapist?: string;
}

export const filterSlots = (slots: AvailableSlot[], { location = "any", therapist = "any" }: SlotFilter = {}) =>
  slots.filter(
    (s) =>
      (location === "any" || s.location?.code === location) && (therapist === "any" || s.therapistId === therapist),
  );

export function locationsOf(slots: AvailableSlot[]) {
  const seen = new Map<string, Location>();
  for (const s of slots) if (s.location && !seen.has(s.location.code)) seen.set(s.location.code, s.location);
  return [...seen.values()];
}

export function freeStarts(day: string, slots: AvailableSlot[], timezone?: string) {
  const found = new Set<number>();
  for (const s of slots) {
    const { date, minutes } = localParts(s.startsAt, timezone);
    if (date === day) found.add(minutes);
  }
  return [...found].sort((a, b) => a - b);
}

export const freeSlotsLabel = (count: number) =>
  count === 0 ? "sem vagas" : `${count} ${count === 1 ? "livre" : "livres"}`;

export const pickSlot = (day: string, minute: number | null, slots: AvailableSlot[], timezone?: string) =>
  minute == null
    ? null
    : (slots.find((s) => {
        const p = localParts(s.startsAt, timezone);
        return p.date === day && p.minutes === minute;
      }) ?? null);

export function dayRange(day: string, slots: AvailableSlot[], timezone?: string): HourRange | null {
  let lo = Infinity,
    hi = -Infinity;
  for (const s of slots) {
    const a = localParts(s.startsAt, timezone),
      b = localParts(s.endsAt, timezone);
    if (a.date !== day) continue;
    lo = Math.min(lo, a.minutes);
    hi = Math.max(hi, b.date === day ? b.minutes : 24 * 60);
  }
  return lo === Infinity ? null : [Math.floor(lo / 60), Math.ceil(hi / 60)];
}
