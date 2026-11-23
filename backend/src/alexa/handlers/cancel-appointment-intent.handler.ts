import { Inject, Injectable } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import { CLOCK, Clock } from "../../common/clock/clock";
import { messages } from "../../messages/catalog";
import { atTimeOf, spokenAlternativesOf, spokenListOf } from "../../notifications/spoken-text";
import { cancelConfirmationOf } from "../../notifications/therapist-agenda-speech";
import { AgendaItem, spokenAgendaItemOf } from "../../therapists/therapist-agenda";
import { LocalTime, TherapistAgendaService } from "../../therapists/therapist-agenda.service";
import type { AlexaReply } from "../alexa-reply";
import { slotValueOf } from "../alexa-request";
import { PendingActionsService } from "../pending-actions.service";
import { clockReadingsOf, todayAt } from "../spoken-time";
import { ConfirmableIntentHandler } from "./confirmable-intent.handler";

const TIME_SLOT = "time";

@Injectable()
export class CancelAppointmentIntentHandler extends ConfirmableIntentHandler {
  protected readonly intentName = "CancelAppointmentIntent";

  constructor(
    pendingActions: PendingActionsService,
    private readonly agenda: TherapistAgendaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(pendingActions);
  }

  protected async questionFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply> {
    const readings = clockReadingsOf(slotValueOf(envelope, TIME_SLOT));
    if (readings.length === 0) return this.replyOf(messages.alexa.vagueCancelTime, therapistId);
    const matches = await this.agenda.findTodayAppointments(therapistId, { localTimes: readings, action: "CANCEL" });
    const [target] = matches;
    if (!target) return this.replyOf(messages.alexa.noAppointmentAt(this.spokenReadingsOf(readings)), therapistId);
    if (matches.length > 1) return this.replyOf(messages.alexa.ambiguousTime(spokenTimesOf(matches)), therapistId);
    return this.confirmationOf(cancelConfirmationOf(spokenAgendaItemOf(target)), envelope, {
      kind: "CANCEL",
      therapistId,
      appointmentId: target.id,
      expectedStatus: target.status,
    });
  }

  private spokenReadingsOf(readings: readonly LocalTime[]): string {
    const now = this.clock.now();
    return spokenAlternativesOf(readings.map((reading) => atTimeOf(todayAt(reading, now))));
  }
}

function spokenTimesOf(appointments: readonly AgendaItem[]): string {
  return spokenListOf(appointments.map(({ spokenTime }) => spokenTime));
}
