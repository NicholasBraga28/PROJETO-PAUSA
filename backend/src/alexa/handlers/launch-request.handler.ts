import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, openReplyOf } from "../alexa-reply";
import type { AlexaRequest } from "../alexa-request";

@Injectable()
export class LaunchRequestHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return envelope.request.type === "LaunchRequest";
  }

  async handle(): Promise<AlexaReply> {
    return openReplyOf(messages.alexa.welcome);
  }
}
