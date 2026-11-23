import { z } from "zod";

export const Role = z.enum(["EMPLOYEE", "THERAPIST", "HR", "ADMIN"]);
export type Role = z.infer<typeof Role>;

export const ChatMessageResult = z.object({
  answer: z.string(),
  topic: z.literal("rag"),
  sources: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type ChatMessageResult = z.infer<typeof ChatMessageResult>;

export const UserStatus = z.enum(["ACTIVE", "INACTIVE"]);
export type UserStatus = z.infer<typeof UserStatus>;

export const User = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: Role,
  status: UserStatus,
  therapistId: z.string().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof User>;

export const AppointmentStatus = z.enum([
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "POSSIBLE_NO_SHOW",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "RELEASED",
  "NO_SHOW",
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

export const LocationCode = z.enum(["SAO_PAULO", "LONDRINA"]);
export type LocationCode = z.infer<typeof LocationCode>;

export const DemoUser = z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string(),
  role: Role,
  roleLabel: z.string(),
  spokenText: z.string(),
});
export type DemoUser = z.infer<typeof DemoUser>;

export const Profile = z.object({
  id: z.string(),
  role: Role,
  effectiveRoles: z.array(Role),
  name: z.string(),
  firstName: z.string(),
  therapistId: z.string().nullable(),
  spokenText: z.string(),
});
export type Profile = z.infer<typeof Profile>;

export const Location = z.object({
  id: z.string(),
  code: LocationCode,
  name: z.string(),
  timezone: z.string(),
});
export type Location = z.infer<typeof Location>;

export const LocationOption = z.object({
  code: LocationCode,
  name: z.string(),
  timezone: z.string(),
});
export type LocationOption = z.infer<typeof LocationOption>;

export const AvailableSlot = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
  therapistId: z.string(),
  therapistName: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  location: Location,
});
export type AvailableSlot = z.infer<typeof AvailableSlot>;

export const Availability = z.object({
  therapists: z.array(z.object({ id: z.string(), name: z.string() })),
  slots: z.array(AvailableSlot),
  waitlistSlots: z.array(AvailableSlot),
  sessionDurationMinutes: z.number().int().positive(),
  spokenText: z.string(),
});
export type Availability = z.infer<typeof Availability>;

export const Appointment = z.object({
  id: z.string(),
  therapistId: z.string(),
  roomId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: AppointmentStatus,
  therapistName: z.string(),
  roomName: z.string(),
  locationCode: LocationCode,
});
export type Appointment = z.infer<typeof Appointment>;

export const MyAppointments = z.object({
  upcoming: z.array(Appointment),
  past: z.array(Appointment),
  spokenText: z.string(),
});
export type MyAppointments = z.infer<typeof MyAppointments>;

export const FeedbackResult = z.object({
  spokenText: z.string(),
});
export type FeedbackResult = z.infer<typeof FeedbackResult>;

export const NextAppointment = z.object({
  appointment: Appointment.nullable(),
  spokenText: z.string(),
});
export type NextAppointment = z.infer<typeof NextAppointment>;

export const WaitlistStatus = z.enum(["WAITING", "NOTIFIED", "CONVERTED", "CANCELLED", "EXPIRED", "DECLINED"]);
export type WaitlistStatus = z.infer<typeof WaitlistStatus>;

export const WaitlistEntry = z.object({
  id: z.string(),
  therapistId: z.string().nullable().optional(),
  therapistName: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  locationName: z.string().nullable().optional(),
  desiredStartsAt: z.string(),
  desiredEndsAt: z.string(),
  status: WaitlistStatus,
  offeredAt: z.string().nullable(),
  offerExpiresAt: z.string().nullable(),
  spokenText: z.string(),
});
export type WaitlistEntry = z.infer<typeof WaitlistEntry>;

export const WaitlistEntries = z.object({ items: z.array(WaitlistEntry), spokenText: z.string() });
export type WaitlistEntries = z.infer<typeof WaitlistEntries>;

export const WaitlistCreated = WaitlistEntry.omit({ spokenText: true });

export const WaitlistAcceptance = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: AppointmentStatus,
});

const SpokenAppointment = Appointment.extend({ spokenText: z.string() });

export const BookingResult = SpokenAppointment;
export type BookingResult = z.infer<typeof BookingResult>;

export const CancellationResult = SpokenAppointment;
export type CancellationResult = z.infer<typeof CancellationResult>;

export const CheckInResult = z.object({
  status: AppointmentStatus,
  spokenText: z.string(),
});
export type CheckInResult = z.infer<typeof CheckInResult>;

export const TherapistAgendaAction = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["START", "FINISH"]) }),
  z.object({ kind: z.enum(["CANCEL", "MARK_NO_SHOW"]), confirmationText: z.string() }),
]);

export const TherapistAgendaItem = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  spokenTime: z.string(),
  status: AppointmentStatus,
  spokenStatus: z.string(),
  employee: z.object({ firstName: z.string() }),
  room: z.object({ name: z.string() }),
  checkedInAt: z.string().nullable(),
  actions: z.array(TherapistAgendaAction),
  spokenText: z.string(),
});
export type TherapistAgendaItem = z.infer<typeof TherapistAgendaItem>;

export const TherapistAgenda = z.object({
  date: z.string(),
  isToday: z.boolean(),
  current: TherapistAgendaItem.nullable(),
  next: TherapistAgendaItem.nullable(),
  remainingCount: z.number().int().nonnegative(),
  items: z.array(TherapistAgendaItem),
  spokenText: z.string(),
});
export type TherapistAgenda = z.infer<typeof TherapistAgenda>;

export const TherapistActionResult = z.object({ spokenText: z.string() });
export type TherapistActionResult = z.infer<typeof TherapistActionResult>;

export const TherapistCancellationResult = z.object({
  appointmentId: z.string(),
  status: AppointmentStatus,
  spokenText: z.string(),
});

export const TherapistBlockPreview = z.object({ confirmationText: z.string() });

export const TherapistScheduleBlock = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string().nullable(),
  spokenText: z.string(),
});
export type TherapistScheduleBlock = z.infer<typeof TherapistScheduleBlock>;

export const NotificationKind = z.enum([
  "REMINDER",
  "BOOKING_CONFIRMATION",
  "WAITLIST_VACANCY",
  "CHECK_IN_CONFIRMATION",
  "POSSIBLE_NO_SHOW",
  "EMPLOYEE_CHECKED_IN",
  "APPOINTMENT_CANCELLED_BY_THERAPIST",
]);
export const NotificationStatus = z.enum(["PENDING", "SENT", "FAILED", "CANCELLED"]);
export const TherapistNotification = z.object({
  id: z.string(),
  appointmentId: z.string().nullable(),
  waitlistEntryId: z.string().optional(),
  kind: NotificationKind,
  status: NotificationStatus,
  scheduledFor: z.string(),
  readAt: z.string().nullable(),
  spokenText: z.string(),
});
export type TherapistNotification = z.infer<typeof TherapistNotification>;
export const TherapistNotificationFeed = z.object({
  items: z.array(TherapistNotification),
  nextCursor: z.string().nullable(),
  spokenText: z.string(),
});
export type TherapistNotificationFeed = z.infer<typeof TherapistNotificationFeed>;
export const TherapistNotificationReadResult = z.object({
  id: z.string(),
  readAt: z.string(),
  spokenText: z.string(),
});
