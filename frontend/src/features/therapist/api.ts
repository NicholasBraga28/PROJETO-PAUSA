import { request } from "@/shared/api/client";
import {
  TherapistActionResult,
  TherapistAgenda,
  TherapistBlockPreview,
  TherapistCancellationResult,
  TherapistScheduleBlock,
  TherapistNotificationFeed,
  TherapistNotificationReadResult,
} from "@/shared/api/schemas";

export const getAgenda = () => request("/therapists/me/agenda", TherapistAgenda);

export const getNotifications = (options: { since?: string; cursor?: string; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (options.since) query.set("since", options.since);
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.limit) query.set("limit", String(options.limit));
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/notifications${suffix}`, TherapistNotificationFeed);
};

export const markNotificationAsRead = (id: string) =>
  request(`/notifications/${encodeURIComponent(id)}/read`, TherapistNotificationReadResult, { method: "POST" });

const postAction = (path: string) => request(path, TherapistActionResult, { method: "POST" });

export const startAppointment = (id: string) =>
  postAction(`/therapists/me/appointments/${encodeURIComponent(id)}/start`);
export const finishAppointment = (id: string) =>
  postAction(`/therapists/me/appointments/${encodeURIComponent(id)}/finish`);
export const cancelAppointment = (id: string) =>
  request(`/therapists/me/appointments/${encodeURIComponent(id)}/cancel`, TherapistCancellationResult, {
    method: "POST",
  });
export const markNoShow = (id: string) => postAction(`/therapists/me/appointments/${encodeURIComponent(id)}/no-show`);

export interface ScheduleBlockInput {
  startsAt: string;
  endsAt: string;
  reason?: string;
}

export const previewScheduleBlock = (input: ScheduleBlockInput) =>
  request("/therapists/me/schedule-blocks/preview", TherapistBlockPreview, { method: "POST", body: input });
export const createScheduleBlock = (input: ScheduleBlockInput) =>
  request("/therapists/me/schedule-blocks", TherapistScheduleBlock, { method: "POST", body: input });
