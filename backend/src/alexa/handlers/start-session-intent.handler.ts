import { Injectable } from "@nestjs/common";
import { TherapistActionsService } from "../../therapists/therapist-actions.service";
import { TherapistIntentHandler } from "./therapist-intent.handler";

@Injectable()
export class StartSessionIntentHandler extends TherapistIntentHandler {
  protected readonly intentName = "StartSessionIntent";

  constructor(private readonly actions: TherapistActionsService) {
    super();
  }

  protected async spokenTextFor(therapistId: string): Promise<string> {
    return (await this.actions.startCurrent(therapistId)).spokenText;
  }
}
