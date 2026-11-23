import { ConflictException, HttpStatus } from "@nestjs/common";
import { messages } from "../messages/catalog";
import { atTimeOf, countOf, spokenTextOf } from "../notifications/spoken-text";
import { AffectedAppointment } from "../schedules/schedule-has-appointments.exception";

const SINGLE_APPOINTMENT = 1;

export class ScheduleBlockHasAppointmentsException extends ConflictException {
  constructor(appointments: readonly [AffectedAppointment, ...AffectedAppointment[]]) {
    const spokenText = spokenTextOf([
      messages.errors.scheduleBlockHasAppointments(
        countOf(appointments.length, messages.speech.nouns.appointment),
        atTimeOf(appointments[0].startsAt),
        appointments.length === SINGLE_APPOINTMENT,
      ),
    ]);
    super({ statusCode: HttpStatus.CONFLICT, error: "Conflict", message: spokenText, spokenText, appointments });
  }
}
