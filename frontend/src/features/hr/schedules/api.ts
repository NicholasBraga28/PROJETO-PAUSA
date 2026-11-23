import { z } from "zod";
import { request } from "@/shared/api/client";
import { LocationCode, User } from "@/shared/api/schemas";

export const ScheduleSlot = z.object({
  id: z.string(),
  therapistId: z.string(),
  roomId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  createdAt: z.string(),
});

export type ScheduleSlot = z.infer<typeof ScheduleSlot>;

export const ScheduleRoom = z.object({
  id: z.string(),
  name: z.string(),
  locationId: z.string(),
  locationCode: LocationCode,
  active: z.boolean(),
});

export type ScheduleRoom = z.infer<typeof ScheduleRoom>;

export const ScheduleLocation = z.object({
  id: z.string(),
  code: LocationCode,
  name: z.string(),
  timezone: z.string(),
  active: z.boolean(),
});

export type ScheduleLocation = z.infer<typeof ScheduleLocation>;

export interface ScheduleFilters {
  date: string;
  locationCode: z.infer<typeof LocationCode> | "";
  therapistId: string;
  roomId: string;
}

export interface ScheduleInput {
  therapistId: string;
  roomId: string;
  startsAt: string;
  endsAt: string;
}

export interface ScheduleUpdate {
  roomId: string;
  startsAt: string;
  endsAt: string;
}

export interface CopySchedulesInput {
  sourceDate: string;
  targetDates: string[];
  therapistId?: string;
}

export const ScheduleCopyResult = z.object({
  created: z.array(ScheduleSlot),
  skipped: z.array(z.object({ date: z.string(), message: z.string() })),
});

export type ScheduleCopyResult = z.infer<typeof ScheduleCopyResult>;

export const ScheduleConflict = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  employee: z.object({ id: z.string(), name: z.string() }),
});

export const ScheduleConflictBody = z.object({
  message: z.string(),
  appointments: z.array(ScheduleConflict),
});

export function getSchedules(filters: ScheduleFilters) {
  const query = new URLSearchParams({ date: filters.date });
  if (filters.locationCode) query.set("locationCode", filters.locationCode);
  if (filters.therapistId) query.set("therapistId", filters.therapistId);
  if (filters.roomId) query.set("roomId", filters.roomId);
  return request(`/schedules?${query.toString()}`, z.array(ScheduleSlot));
}

export async function getTherapists() {
  const users = await request("/users?role=THERAPIST&status=ACTIVE", z.array(User));
  return users.flatMap((user) => (user.therapistId ? [{ id: user.therapistId, name: user.name }] : []));
}

export const getRooms = () => request("/rooms?active=true", z.array(ScheduleRoom));

export const getScheduleLocations = () => request("/locations/admin", z.array(ScheduleLocation));

export const createSchedule = (input: ScheduleInput) =>
  request("/schedules", ScheduleSlot, { method: "POST", body: input });

export const updateSchedule = (id: string, input: ScheduleUpdate) =>
  request(`/schedules/${encodeURIComponent(id)}`, ScheduleSlot, { method: "PATCH", body: input });

export const deleteSchedule = (id: string) =>
  request(`/schedules/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE" });

export const copySchedules = (input: CopySchedulesInput) =>
  request("/schedules/copy", ScheduleCopyResult, { method: "POST", body: input });
