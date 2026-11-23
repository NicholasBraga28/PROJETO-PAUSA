import { Injectable } from "@nestjs/common";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, SILENT_REPLY } from "../alexa-reply";
import type { AlexaRequest } from "../alexa-request";

@Injectable()
export class SessionEndedRequestHandler implements AlexaIntentHandler {
  canHandle({ envelope }: AlexaRequest): boolean {
    return envelope.request.type === "SessionEndedRequest";
  }

  async handle(): Promise<AlexaReply> {
    return SILENT_REPLY;
  }
}
