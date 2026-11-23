import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, openReplyOf } from "../alexa-reply";
import type { AlexaRequest } from "../alexa-request";
import { keptSpeakerAttributesOf } from "../alexa-session";

@Injectable()
export class FallbackHandler implements AlexaIntentHandler {
  canHandle(): boolean {
    return true;
  }

  async handle({ envelope }: AlexaRequest): Promise<AlexaReply> {
    return openReplyOf(messages.alexa.notUnderstood, keptSpeakerAttributesOf(envelope));
  }
}
