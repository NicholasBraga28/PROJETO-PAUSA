import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, finalReplyOf } from "../alexa-reply";
import { AlexaRequest, isIntentOneOf } from "../alexa-request";

const STOP_INTENTS = ["AMAZON.StopIntent", "AMAZON.CancelIntent"];

@Injectable()
export class StopIntentHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return isIntentOneOf(envelope, STOP_INTENTS);
  }

  async handle(): Promise<AlexaReply> {
    return finalReplyOf(messages.alexa.goodbye);
  }
}
