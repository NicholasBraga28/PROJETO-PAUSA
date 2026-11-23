import { Injectable } from "@nestjs/common";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import type { AlexaReply } from "../alexa-reply";
import { AlexaRequest, intentNameOf } from "../alexa-request";
import { lastSpeechOf, sessionAttributesOf } from "../alexa-session";
import { helpReplyOf } from "./help-intent.handler";

const REPEAT_INTENT = "AMAZON.RepeatIntent";

@Injectable()
export class RepeatIntentHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return intentNameOf(envelope) === REPEAT_INTENT;
  }

  async handle(request: AlexaRequest): Promise<AlexaReply> {
    const lastSpeech = lastSpeechOf(request.envelope);
    if (!lastSpeech) return helpReplyOf(request);
    return {
      speech: lastSpeech,
      reprompt: lastSpeech,
      shouldEndSession: false,
      sessionAttributes: sessionAttributesOf(request.envelope),
    };
  }
}
