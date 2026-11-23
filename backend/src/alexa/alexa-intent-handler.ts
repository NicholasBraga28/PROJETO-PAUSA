import type { AlexaReply } from "./alexa-reply";
import type { AlexaRequest } from "./alexa-request";

export interface AlexaIntentHandler {
  canHandle(request: AlexaRequest): boolean;
  handle(request: AlexaRequest): Promise<AlexaReply>;
}

export const ALEXA_INTENT_HANDLERS = Symbol("ALEXA_INTENT_HANDLERS");
