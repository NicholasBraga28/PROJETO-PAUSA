import { AppointmentStatus, Prisma } from "@prisma/client";
import { FINAL_STATUSES, isTransitionAllowed } from "../appointments/appointment-status";
import { firstNameOf } from "../common/names/first-name";
import { appointmentStatusOf, atTimeOf, SpokenAppointmentStatus } from "../notifications/spoken-text";
import {
  agendaItemSpeechOf,
  cancelConfirmationOf,
  markNoShowConfirmationOf,
  SpokenAppointment,
} from "../notifications/therapist-agenda-speech";

const MS_PER_MINUTE = 60_000;

export const AGENDA_APPOINTMENT_INCLUDE = {
  employee: { select: { name: true } },
  room: { select: { name: true } },
} satisfies Prisma.AppointmentInclude;

export const HIDDEN_FROM_AGENDA_STATUSES: readonly AppointmentStatus[] = ["CANCELLED", "RELEASED"];

export const AWAITING_SESSION_STATUSES: readonly AppointmentStatus[] = ["CONFIRMED", "CHECKED_IN", "POSSIBLE_NO_SHOW"];

export type AgendaAppointment = Prisma.AppointmentGetPayload<{ include: typeof AGENDA_APPOINTMENT_INCLUDE }>;

export type AgendaActionKind = "START" | "FINISH" | "CANCEL" | "MARK_NO_SHOW";

export type AgendaAction =
  Readonly<{ kind: "START" | "FINISH" }> | Readonly<{ kind: "CANCEL" | "MARK_NO_SHOW"; confirmationText: string }>;

export type AgendaItem = Readonly<{
  id: string;
  startsAt: string;
  endsAt: string;
  spokenTime: string;
  status: AppointmentStatus;
  spokenStatus: string;
  employee: Readonly<{ firstName: string }>;
  room: Readonly<{ name: string }>;
  checkedInAt: string | null;
  actions: readonly AgendaAction[];
  spokenText: string;
}>;

export type TherapistAgenda = Readonly<{
  date: string;
  isToday: boolean;
  current: AgendaItem | null;
  next: AgendaItem | null;
  remainingCount: number;
  items: readonly AgendaItem[];
  spokenText: string;
}>;

export type TherapistArrivals = Readonly<{
  items: readonly AgendaItem[];
  spokenText: string;
}>;

export type AgendaActionContext = Readonly<{
  now: Date;
  checkInEarlyMinutes: number;
  hasSessionInProgress: boolean;
}>;

export type StartWindowPosition = "BEFORE" | "INSIDE" | "AFTER";

type TimedAppointment = Readonly<{ id: string; status: AppointmentStatus; startsAt: Date; endsAt: Date }>;

const TARGET_STATUS_OF_ACTION: Readonly<Record<AgendaActionKind, AppointmentStatus>> = {
  START: "IN_PROGRESS",
  FINISH: "COMPLETED",
  CANCEL: "CANCELLED",
  MARK_NO_SHOW: "NO_SHOW",
};

const ACTION_KINDS = Object.keys(TARGET_STATUS_OF_ACTION) as AgendaActionKind[];

export function currentOf<T extends TimedAppointment>(appointments: readonly T[], now: Date): T | null {
  const inProgress = appointments.find((appointment) => appointment.status === "IN_PROGRESS");
  if (inProgress) return inProgress;
  return (
    appointments.find(
      (appointment) => isAwaitingSession(appointment) && appointment.startsAt <= now && now < appointment.endsAt,
    ) ?? null
  );
}

export function nextOf<T extends TimedAppointment>(appointments: readonly T[], now: Date, current: T | null): T | null {
  return (
    appointments.find(
      (appointment) => isAwaitingSession(appointment) && appointment.startsAt > now && appointment.id !== current?.id,
    ) ?? null
  );
}

export function isRemaining(appointment: TimedAppointment, now: Date, isToday: boolean): boolean {
  if (FINAL_STATUSES.includes(appointment.status)) return false;
  return !isToday || appointment.endsAt > now;
}

export function isRemainingToday(item: AgendaItem, now: Date): boolean {
  return isRemaining({ ...item, startsAt: new Date(item.startsAt), endsAt: new Date(item.endsAt) }, now, true);
}

export function agendaItemOf(appointment: AgendaAppointment, context: AgendaActionContext): AgendaItem {
  const spoken = spokenAppointmentOf(appointment);
  const status = appointment.status as SpokenAppointmentStatus;
  return {
    id: appointment.id,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    spokenTime: atTimeOf(appointment.startsAt),
    status: appointment.status,
    spokenStatus: appointmentStatusOf(status),
    employee: { firstName: spoken.firstName },
    room: { name: appointment.room.name },
    checkedInAt: appointment.checkedInAt?.toISOString() ?? null,
    actions: allowedActionKindsOf(appointment, context).map((kind) => actionOf(kind, spoken)),
    spokenText: agendaItemSpeechOf(spoken, status),
  };
}

export function spokenAppointmentOf(appointment: AgendaAppointment): SpokenAppointment {
  return {
    firstName: firstNameOf(appointment.employee.name),
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
  };
}

export function spokenAgendaItemOf(item: AgendaItem): SpokenAppointment {
  return { firstName: item.employee.firstName, startsAt: new Date(item.startsAt), endsAt: new Date(item.endsAt) };
}

function allowedActionKindsOf(appointment: TimedAppointment, context: AgendaActionContext): AgendaActionKind[] {
  return ACTION_KINDS.filter(
    (kind) =>
      isTransitionAllowed({ from: appointment.status, to: TARGET_STATUS_OF_ACTION[kind], actor: "THERAPIST" }) &&
      (kind !== "START" || canStartNow(appointment, context)),
  );
}

export function startWindowPositionOf(
  appointment: Readonly<{ startsAt: Date; endsAt: Date }>,
  now: Date,
  checkInEarlyMinutes: number,
): StartWindowPosition {
  const opensAt = new Date(appointment.startsAt.getTime() - checkInEarlyMinutes * MS_PER_MINUTE);
  if (now < opensAt) return "BEFORE";
  return now < appointment.endsAt ? "INSIDE" : "AFTER";
}

function canStartNow(appointment: TimedAppointment, context: AgendaActionContext): boolean {
  return (
    !context.hasSessionInProgress &&
    startWindowPositionOf(appointment, context.now, context.checkInEarlyMinutes) === "INSIDE"
  );
}

function actionOf(kind: AgendaActionKind, appointment: SpokenAppointment): AgendaAction {
  if (kind === "CANCEL") return { kind, confirmationText: cancelConfirmationOf(appointment) };
  if (kind === "MARK_NO_SHOW") return { kind, confirmationText: markNoShowConfirmationOf(appointment) };
  return { kind };
}

function isAwaitingSession(appointment: TimedAppointment): boolean {
  return AWAITING_SESSION_STATUSES.includes(appointment.status);
}
