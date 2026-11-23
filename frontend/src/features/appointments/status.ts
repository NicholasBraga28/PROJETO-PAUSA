import type { AppointmentStatus } from "@/shared/api/schemas";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Reservada",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in feito",
  POSSIBLE_NO_SHOW: "Possível ausência",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  RELEASED: "Liberada",
  NO_SHOW: "Ausência",
};
export const CANCELLABLE = new Set<AppointmentStatus>(["BOOKED", "CONFIRMED"]);
