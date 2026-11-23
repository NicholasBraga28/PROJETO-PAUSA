import { Injectable } from "@nestjs/common";
import { nextAppointmentSpeechOf } from "../../notifications/therapist-agenda-speech";
import { spokenAgendaItemOf } from "../../therapists/therapist-agenda";
import { TherapistAgendaService } from "../../therapists/therapist-agenda.service";
import { TherapistQueryIntentHandler } from "./therapist-query-intent.handler";

@Injectable()
export class NextAppointmentIntentHandler extends TherapistQueryIntentHandler {
  protected readonly intentName = "NextAppointmentIntent";

  constructor(private readonly agenda: TherapistAgendaService) {
    super();
  }

  protected async spokenTextFor(therapistId: string): Promise<string> {
    const { next } = await this.agenda.agendaOf(therapistId);
    return nextAppointmentSpeechOf(next && spokenAgendaItemOf(next));
  }
}
