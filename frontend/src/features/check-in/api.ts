import { request } from "@/shared/api/client";
import { CheckInResult } from "@/shared/api/schemas";

export const checkIn = (token: string) =>
  request(`/booking/check-in/${encodeURIComponent(token)}`, CheckInResult, { method: "POST" });
