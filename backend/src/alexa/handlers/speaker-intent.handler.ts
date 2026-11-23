import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, finalReplyOf } from "../alexa-reply";
import { AlexaRequest, intentNameOf } from "../alexa-request";
import { identifiedSpeakerAttributesOf } from "../alexa-session";
import { speakerQuestionOf } from "../speaker-question";

type Refusal = BadRequestException | ConflictException | NotFoundException;

const isRefusal = (error: unknown): error is Refusal =>
  error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException;

export abstract class SpeakerIntentHandler implements AlexaIntentHandler {
  protected abstract readonly intentName: string;

  canHandle(request: AlexaRequest): boolean {
    return intentNameOf(request.envelope) === this.intentName;
  }

  async handle({ envelope, context: { speaker } }: AlexaRequest): Promise<AlexaReply> {
    if (speaker.kind === "NOT_SERVED") return finalReplyOf(messages.alexa.deviceNotPaired);
    if (speaker.kind === "MUST_ASK") return speakerQuestionOf(envelope, speaker.candidates);
    try {
      return await this.replyFor(speaker.therapistId, envelope);
    } catch (error) {
      if (isRefusal(error)) return this.replyOf(error.message, speaker.therapistId);
      throw error;
    }
  }

  protected replyOf(speech: string, therapistId: string): AlexaReply {
    return { ...finalReplyOf(speech), sessionAttributes: identifiedSpeakerAttributesOf(therapistId) };
  }

  protected abstract replyFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply>;
}
