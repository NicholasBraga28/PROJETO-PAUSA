import type { RequestEnvelope } from "ask-sdk-model";
import { AlexaReply, confirmationReplyOf } from "../alexa-reply";
import { confirmationStatusOf, intentSlotsOf } from "../alexa-request";
import { PendingAction, identifiedSpeakerAttributesOf, pendingActionAttributesOf } from "../alexa-session";
import type { PendingActionsService } from "../pending-actions.service";
import { SpeakerIntentHandler } from "./speaker-intent.handler";

export abstract class ConfirmableIntentHandler extends SpeakerIntentHandler {
  constructor(private readonly pendingActions: PendingActionsService) {
    super();
  }

  protected async replyFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply> {
    const confirmationStatus = confirmationStatusOf(envelope);
    if (confirmationStatus === "NONE") return this.questionFor(therapistId, envelope);
    const isConfirmed = confirmationStatus === "CONFIRMED";
    return this.replyOf(await this.pendingActions.answer(therapistId, envelope, isConfirmed), therapistId);
  }

  protected confirmationOf(question: string, envelope: RequestEnvelope, pendingAction: PendingAction): AlexaReply {
    return confirmationReplyOf(
      question,
      { name: this.intentName, confirmationStatus: "NONE", slots: intentSlotsOf(envelope) },
      { ...identifiedSpeakerAttributesOf(pendingAction.therapistId), ...pendingActionAttributesOf(pendingAction) },
    );
  }

  protected abstract questionFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply>;
}
