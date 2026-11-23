import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, finalReplyOf, openReplyOf } from "../alexa-reply";
import { AlexaRequest, intentNameOf } from "../alexa-request";
import { identifiedSpeakerAttributesOf } from "../alexa-session";
import { IDENTIFY_SPEAKER_INTENT, unknownSpeakerReplyOf } from "../speaker-question";

@Injectable()
export class IdentifySpeakerIntentHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return intentNameOf(envelope) === IDENTIFY_SPEAKER_INTENT;
  }

  async handle({ envelope, context: { speaker } }: AlexaRequest): Promise<AlexaReply> {
    if (speaker.kind === "NOT_SERVED") return finalReplyOf(messages.alexa.deviceNotPaired);
    if (speaker.kind === "MUST_ASK") return unknownSpeakerReplyOf(envelope, speaker.candidates);
    return openReplyOf(messages.alexa.whatToSay, identifiedSpeakerAttributesOf(speaker.therapistId));
  }
}
