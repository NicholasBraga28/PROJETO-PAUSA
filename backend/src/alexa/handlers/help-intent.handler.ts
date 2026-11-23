import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, openReplyOf } from "../alexa-reply";
import { AlexaRequest, intentNameOf } from "../alexa-request";
import { keptSpeakerAttributesOf } from "../alexa-session";

const HELP_INTENT = "AMAZON.HelpIntent";

export function helpReplyOf({ envelope }: AlexaRequest): AlexaReply {
  return openReplyOf(messages.alexa.whatToSay, keptSpeakerAttributesOf(envelope));
}

@Injectable()
export class HelpIntentHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return intentNameOf(envelope) === HELP_INTENT;
  }

  async handle(request: AlexaRequest): Promise<AlexaReply> {
    return helpReplyOf(request);
  }
}
