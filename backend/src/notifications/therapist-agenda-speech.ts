import { messages } from "../messages/catalog";
import {
  appointmentStatusOf,
  atTimeOf,
  calendarDateOf,
  clockTimeOf,
  countOf,
  dayOf,
  fromTimeOf,
  intervalOf,
  SpokenAppointmentStatus,
  spokenListOf,
  spokenTextOf,
} from "./spoken-text";

const speech = messages.therapistAgenda;
const nouns = messages.speech.nouns;
const SINGLE_ARRIVAL = 1;
const SINGLE_APPOINTMENT = 1;

export type SpokenAppointment = Readonly<{ firstName: string; startsAt: Date; endsAt: Date }>;

export type TodayAgendaSpeech = Readonly<{
  current: SpokenAppointment | null;
  next: SpokenAppointment | null;
  remainingCount: number;
  isEmpty: boolean;
}>;

export type OtherDayAgendaSpeech = Readonly<{
  dayStartsAt: Date;
  now: Date;
  count: number;
  first: SpokenAppointment | null;
}>;

export type SpokenArrival = Readonly<{ firstName: string; checkedInAt: Date }>;

export function agendaItemSpeechOf(appointment: SpokenAppointment, status: SpokenAppointmentStatus): string {
  return spokenTextOf([
    speech.item(appointment.firstName, atTimeOf(appointment.startsAt), appointmentStatusOf(status)),
  ]);
}

export function cancelConfirmationOf(appointment: SpokenAppointment): string {
  return speech.cancelConfirmation(appointment.firstName, atTimeOf(appointment.startsAt));
}

export function markNoShowConfirmationOf(appointment: SpokenAppointment): string {
  return speech.markNoShowConfirmation(appointment.firstName, fromTimeOf(appointment.startsAt));
}

export function blockConfirmationOf(startsAt: Date, endsAt: Date, now: Date): string {
  return speech.blockConfirmation(dayOf(startsAt, now), intervalOf(startsAt, endsAt));
}

export function todayAgendaSpeechOf({ current, next, remainingCount, isEmpty }: TodayAgendaSpeech): string {
  if (current) return spokenTextOf([currentSentenceOf(current), next ? nextSentenceOf(next) : speech.nothingLeftToday]);
  if (next)
    return spokenTextOf([speech.todaySummary(countOf(remainingCount, nouns.appointment)), nextSentenceOf(next)]);
  return isEmpty ? speech.emptyToday : speech.nothingLeftToday;
}

export function todaySummarySpeechOf({ current, next, remainingCount, isEmpty }: TodayAgendaSpeech): string {
  if (remainingCount === 0) return isEmpty ? speech.emptyToday : speech.nothingLeftToday;
  const summary = speech.todaySummary(countOf(remainingCount, nouns.appointment));
  if (offersFullAgenda(remainingCount)) return spokenTextOf([summary, speech.offerFullAgenda]);
  if (next) return spokenTextOf([summary, firstSentenceOf(next)]);
  return spokenTextOf(current ? [summary, currentSentenceOf(current)] : [summary]);
}

export function offersFullAgenda(remainingCount: number): boolean {
  return remainingCount > SINGLE_APPOINTMENT;
}

export function fullAgendaSpeechOf(appointments: readonly SpokenAppointment[]): string {
  if (appointments.length === 0) return speech.nothingLeftToday;
  const entries = appointments.map(({ firstName, startsAt }) => speech.agendaEntry(firstName, atTimeOf(startsAt)));
  return spokenTextOf([spokenListOf(entries)]);
}

export function nextAppointmentSpeechOf(next: SpokenAppointment | null): string {
  return next ? spokenTextOf([nextSentenceOf(next)]) : speech.nothingLeftToday;
}

export function otherDayAgendaSpeechOf({ dayStartsAt, now, count, first }: OtherDayAgendaSpeech): string {
  const day = dayOf(dayStartsAt, now);
  if (!first) return spokenTextOf([speech.otherDayEmpty(day)]);
  return spokenTextOf([speech.otherDaySummary(day, countOf(count, nouns.appointment)), firstSentenceOf(first)]);
}

export function arrivalsSpeechOf(latest: SpokenArrival | null, count: number): string {
  if (!latest) return speech.nobodyArrived;
  const arrived = speech.arrived(latest.firstName, atTimeOf(latest.checkedInAt));
  if (count === SINGLE_ARRIVAL) return spokenTextOf([arrived]);
  return spokenTextOf([arrived, speech.arrivalsTotal(countOf(count, nouns.person))]);
}

export function sessionStartedSpeechOf(appointment: SpokenAppointment): string {
  return spokenTextOf([messages.therapistActions.sessionStarted(appointment.firstName)]);
}

export function sessionFinishedSpeechOf(next: SpokenAppointment | null): string {
  return withNextSentenceOf(messages.therapistActions.sessionFinished, next);
}

export function noShowMarkedSpeechOf(next: SpokenAppointment | null): string {
  return withNextSentenceOf(messages.therapistActions.noShowMarked, next);
}

export function therapistCancelledSpeechOf(): string {
  return spokenTextOf([messages.therapistActions.cancelled]);
}

export function scheduleBlockedSpeechOf(): string {
  return spokenTextOf([messages.therapistActions.blocked]);
}

export function cancelledByTherapistNoticeOf(startsAt: Date, therapistFirstName: string): string {
  return messages.notifications.cancelledByTherapist(calendarDateOf(startsAt), atTimeOf(startsAt), therapistFirstName);
}

function withNextSentenceOf(sentence: string, next: SpokenAppointment | null): string {
  return spokenTextOf(next ? [sentence, nextSentenceOf(next)] : [sentence]);
}

function currentSentenceOf(appointment: SpokenAppointment): string {
  return speech.current(appointment.firstName, clockTimeOf(appointment.endsAt));
}

function firstSentenceOf(appointment: SpokenAppointment): string {
  return speech.first(appointment.firstName, atTimeOf(appointment.startsAt));
}

function nextSentenceOf(appointment: SpokenAppointment): string {
  return speech.next(appointment.firstName, atTimeOf(appointment.startsAt));
}
