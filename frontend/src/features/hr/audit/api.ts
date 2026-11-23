import { z } from "zod";
import { request } from "@/shared/api/client";

const EventData = z
  .object({
    status: z
      .enum([
        "BOOKED",
        "CONFIRMED",
        "CHECKED_IN",
        "POSSIBLE_NO_SHOW",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "RELEASED",
        "NO_SHOW",
      ])
      .optional(),
  })
  .strict();
const AuditEvent = z
  .object({
    id: z.string().uuid(),
    actorId: z.string().uuid().nullable(),
    action: z.string().min(1),
    entityType: z.literal("Appointment"),
    entityId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    data: EventData,
    spokenText: z.string(),
  })
  .strict();

export const AuditEvents = z
  .object({ items: z.array(AuditEvent), nextCursor: z.string().uuid().nullable(), spokenText: z.string() })
  .strict();

export type AuditEvent = z.infer<typeof AuditEvent>;
export type AuditEvents = z.infer<typeof AuditEvents>;

export interface AuditQuery {
  from?: string;
  to?: string;
  appointmentId?: string;
  actorId?: string;
  action?: string;
  cursor?: string;
}

export async function getAuditEvents(filters: AuditQuery): Promise<AuditEvents> {
  const query = new URLSearchParams();
  for (const key of ["from", "to", "appointmentId", "actorId", "action", "cursor"] as const) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  const result = await request(`/audit-events?${query.toString()}`, AuditEvents);
  return AuditEvents.parse(result);
}
