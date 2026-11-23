import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, finalReplyOf } from "../alexa-reply";
import { AlexaRequest, intentNameOf } from "../alexa-request";

const PRESENTATION_INVITE_INTENT = "PresentationInviteIntent";

@Injectable()
export class PresentationInviteIntentHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return intentNameOf(envelope) === PRESENTATION_INVITE_INTENT;
  }

  async handle(): Promise<AlexaReply> {
    return finalReplyOf(messages.alexa.presentationInvite);
  }
}
