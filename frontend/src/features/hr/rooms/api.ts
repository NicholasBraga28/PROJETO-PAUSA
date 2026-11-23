import { z } from "zod";
import { request } from "@/shared/api/client";
import { LocationCode } from "@/shared/api/schemas";

export const AdminLocation = z.object({
  id: z.string(),
  code: LocationCode,
  name: z.string(),
  timezone: z.string(),
  active: z.boolean(),
});

export type AdminLocation = z.infer<typeof AdminLocation>;

export const Room = z.object({
  id: z.string(),
  name: z.string(),
  locationId: z.string(),
  locationCode: LocationCode,
  active: z.boolean(),
  checkInToken: z.string(),
});

export type Room = z.infer<typeof Room>;
export type RoomSummary = Room & { locationName: string };

export interface RoomFilters {
  locationCode: z.infer<typeof LocationCode> | "";
  active: boolean | "";
}

export interface CreateRoomInput {
  name: string;
  locationId: string;
}

export const RegeneratedRoomToken = z.object({
  id: z.string(),
  name: z.string(),
  checkInToken: z.string(),
  updatedAt: z.string(),
});

export type RegeneratedRoomToken = z.infer<typeof RegeneratedRoomToken>;

export const getAdminLocations = () => request("/locations/admin", z.array(AdminLocation));

export function getRooms(filters: RoomFilters) {
  const query = new URLSearchParams();
  if (filters.locationCode) query.set("locationCode", filters.locationCode);
  if (filters.active !== "") query.set("active", String(filters.active));
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/rooms${suffix}`, z.array(Room));
}

export const createRoom = (input: CreateRoomInput) => request("/rooms", Room, { method: "POST", body: input });

export const regenerateRoomToken = (id: string) =>
  request(`/rooms/${encodeURIComponent(id)}/regenerate-token`, RegeneratedRoomToken, { method: "POST" });
