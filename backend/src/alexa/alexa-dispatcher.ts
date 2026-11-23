import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import { messages } from "../messages/catalog";
import { ALEXA_INTENT_HANDLERS, AlexaIntentHandler } from "./alexa-intent-handler";
import { AlexaReply, finalReplyOf } from "./alexa-reply";
import { AlexaRequest, intentNameOf } from "./alexa-request";
import { AlexaRequestContextResolver } from "./alexa-request-context-resolver";
import { FallbackHandler } from "./handlers/fallback.handler";
import { withPendingIntentReplayed } from "./speaker-question";

const NO_INTENT = "none";

@Injectable()
export class AlexaDispatcher {
  private readonly logger = new Logger(AlexaDispatcher.name);

  constructor(
    @Inject(ALEXA_INTENT_HANDLERS) private readonly handlers: readonly AlexaIntentHandler[],
    private readonly fallback: FallbackHandler,
    private readonly contexts: AlexaRequestContextResolver,
  ) {}

  async dispatch(envelope: RequestEnvelope): Promise<AlexaReply> {
    try {
      const request = withPendingIntentReplayed({ envelope, context: await this.contexts.contextOf(envelope) });
      return await this.handlerFor(request).handle(request);
    } catch {
      this.logFailureOf(envelope);
      return finalReplyOf(messages.alexa.failure);
    }
  }

  private handlerFor(request: AlexaRequest): AlexaIntentHandler {
    return this.handlers.find((handler) => handler.canHandle(request)) ?? this.fallback;
  }

  private logFailureOf(envelope: RequestEnvelope): void {
    const { type, requestId } = envelope.request;
    this.logger.error(
      `Alexa request failed: requestType=${type} intent=${intentNameOf(envelope) ?? NO_INTENT} requestId=${requestId}`,
    );
  }
}
