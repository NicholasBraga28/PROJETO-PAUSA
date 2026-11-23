import { Injectable } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import type { AlexaReply } from "../alexa-reply";
import { PendingActionsService } from "../pending-actions.service";
import { SpeakerIntentHandler } from "./speaker-intent.handler";

@Injectable()
abstract class ConfirmationAnswerIntentHandler extends SpeakerIntentHandler {
  protected abstract readonly isConfirmed: boolean;

  constructor(private readonly pendingActions: PendingActionsService) {
    super();
  }

  protected async replyFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply> {
    return this.replyOf(await this.pendingActions.answer(therapistId, envelope, this.isConfirmed), therapistId);
  }
}

@Injectable()
export class YesIntentHandler extends ConfirmationAnswerIntentHandler {
  protected readonly intentName = "AMAZON.YesIntent";
  protected readonly isConfirmed = true;
}

@Injectable()
export class NoIntentHandler extends ConfirmationAnswerIntentHandler {
  protected readonly intentName = "AMAZON.NoIntent";
  protected readonly isConfirmed = false;
}
