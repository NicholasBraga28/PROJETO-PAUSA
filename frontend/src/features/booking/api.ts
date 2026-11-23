import { request } from "@/shared/api/client";
import { Availability, BookingResult, LocationOption, type AvailableSlot, type LocationCode } from "@/shared/api/schemas";

const iso = (d: Date) => d.toISOString();

export interface AvailabilityFilters {
  locationCode?: LocationCode;
  therapistId?: string;
}

export const getLocations = () => request("/locations", LocationOption.array());

export const getAvailability = (from: Date, to: Date, filters: AvailabilityFilters = {}) => {
  const query = new URLSearchParams({ from: iso(from), to: iso(to) });
  if (filters.locationCode) query.set("locationCode", filters.locationCode);
  if (filters.therapistId) query.set("therapistId", filters.therapistId);
  return request(`/booking/availability?${query}`, Availability);
};

export const reserve = (slot: AvailableSlot) =>
  request("/booking/appointments", BookingResult, {
    method: "POST",
    body: { startsAt: slot.startsAt, endsAt: slot.endsAt, therapistId: slot.therapistId, roomId: slot.roomId },
  });
