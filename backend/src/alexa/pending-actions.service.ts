import { Inject, Injectable } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import { CLOCK, Clock } from "../common/clock/clock";
import { messages } from "../messages/catalog";
import { fullAgendaSpeechOf } from "../notifications/therapist-agenda-speech";
import { TherapistActionsService } from "../therapists/therapist-actions.service";
import { isRemainingToday, spokenAgendaItemOf } from "../therapists/therapist-agenda";
import { TherapistAgendaService } from "../therapists/therapist-agenda.service";
import { TherapistProfileService } from "../therapists/therapist-profile.service";
import { PendingAction, pendingActionOf } from "./alexa-session";

type PendingCancel = Extract<PendingAction, { kind: "CANCEL" }>;
type PendingBlock = Extract<PendingAction, { kind: "BLOCK" }>;

@Injectable()
export class PendingActionsService {
  constructor(
    private readonly actions: TherapistActionsService,
    private readonly agenda: TherapistAgendaService,
    private readonly profiles: TherapistProfileService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async answer(therapistId: string, envelope: RequestEnvelope, isConfirmed: boolean): Promise<string> {
    const pendingAction = pendingActionOf(envelope);
    if (pendingAction?.therapistId !== therapistId) return messages.alexa.nothingToConfirm;
    if (pendingAction.kind === "READ_AGENDA") {
      return isConfirmed ? this.readAgenda(therapistId) : messages.alexa.fullAgendaDeclined;
    }
    if (!isConfirmed) return messages.alexa.nothingChanged;
    return pendingAction.kind === "CANCEL" ? this.cancel(pendingAction) : this.block(pendingAction);
  }

  private async readAgenda(therapistId: string): Promise<string> {
    const { items } = await this.agenda.agendaOf(therapistId);
    const now = this.clock.now();
    return fullAgendaSpeechOf(items.filter((item) => isRemainingToday(item, now)).map(spokenAgendaItemOf));
  }

  private async cancel({ therapistId, appointmentId, expectedStatus }: PendingCancel): Promise<string> {
    const { items } = await this.agenda.agendaOf(therapistId);
    const appointment = items.find(({ id }) => id === appointmentId);
    if (!appointment) return messages.alexa.appointmentLeftAgenda;
    if (appointment.status !== expectedStatus) return messages.errors.appointmentChangedMeanwhile;
    return (await this.actions.cancel(therapistId, appointmentId)).spokenText;
  }

  private async block({ therapistId, startsAt, endsAt }: PendingBlock): Promise<string> {
    const actorId = await this.profiles.userIdOf(therapistId);
    const period = { startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
    return (await this.actions.block(therapistId, actorId, period)).spokenText;
  }
}
