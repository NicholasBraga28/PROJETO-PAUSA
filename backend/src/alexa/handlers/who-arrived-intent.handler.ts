import { Injectable } from "@nestjs/common";
import { TherapistAgendaService } from "../../therapists/therapist-agenda.service";
import { TherapistQueryIntentHandler } from "./therapist-query-intent.handler";

@Injectable()
export class WhoArrivedIntentHandler extends TherapistQueryIntentHandler {
  protected readonly intentName = "WhoArrivedIntent";

  constructor(private readonly agenda: TherapistAgendaService) {
    super();
  }

  protected async spokenTextFor(therapistId: string): Promise<string> {
    return (await this.agenda.arrivalsOf(therapistId)).spokenText;
  }
}
