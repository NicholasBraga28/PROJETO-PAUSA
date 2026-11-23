import { z } from "zod";
import { User } from "@/shared/api/schemas";
import { request } from "@/shared/api/client";

export const ScheduleBlock = z.object({
  id: z.string(),
  therapistId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
});

export type ScheduleBlock = z.infer<typeof ScheduleBlock>;

export const BlockedAppointment = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  employee: z.object({ id: z.string(), name: z.string() }),
});

export const ScheduleBlockConflict = z.object({
  message: z.string(),
  spokenText: z.string().optional(),
  appointments: z.array(BlockedAppointment),
});

export interface ScheduleBlockInput {
  therapistId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}

export async function getActiveTherapists() {
  const users = await request("/users?role=THERAPIST&status=ACTIVE", z.array(User));
  return users.flatMap((user) => (user.therapistId ? [{ id: user.therapistId, name: user.name }] : []));
}

export const createScheduleBlock = (input: ScheduleBlockInput) =>
  request("/schedule-blocks", ScheduleBlock, { method: "POST", body: input });
