import { z } from "zod";
import { request } from "@/shared/api/client";
import { WaitlistAcceptance, WaitlistCreated, WaitlistEntries, type WaitlistEntry } from "@/shared/api/schemas";

const EmptyResponse = z.undefined();

export interface JoinWaitlistInput {
  desiredStartsAt: string;
  desiredEndsAt: string;
  therapistId: string;
  locationId: string;
}

export const getWaitlist = () => request("/booking/waitlist", WaitlistEntries);
export const joinWaitlist = (input: JoinWaitlistInput) =>
  request("/booking/waitlist", WaitlistCreated, { method: "POST", body: input });
export const leaveWaitlist = (id: string) =>
  request(`/booking/waitlist/${encodeURIComponent(id)}`, EmptyResponse, { method: "DELETE" });
export const acceptWaitlistOffer = (id: string) =>
  request(`/booking/waitlist/${encodeURIComponent(id)}/accept`, WaitlistAcceptance, { method: "POST" });
export const declineWaitlistOffer = (id: string) =>
  request(`/booking/waitlist/${encodeURIComponent(id)}/decline`, EmptyResponse, { method: "POST" });

export type { WaitlistEntry };
