import { request } from "@/shared/api/client";
import { CancellationResult, MyAppointments, NextAppointment } from "@/shared/api/schemas";

export const getMyAppointments = () => request("/booking/appointments", MyAppointments);
export const getNextAppointment = () => request("/booking/appointments/next", NextAppointment);
export const cancelAppointment = (id: string) =>
  request(`/booking/appointments/${encodeURIComponent(id)}`, CancellationResult, { method: "DELETE" });
