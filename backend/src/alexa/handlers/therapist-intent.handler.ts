import type { RequestEnvelope } from "ask-sdk-model";
import type { AlexaReply } from "../alexa-reply";
import { SpeakerIntentHandler } from "./speaker-intent.handler";

export abstract class TherapistIntentHandler extends SpeakerIntentHandler {
  protected async replyFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply> {
    return this.replyOf(await this.spokenTextFor(therapistId, envelope), therapistId);
  }

  protected abstract spokenTextFor(therapistId: string, envelope: RequestEnvelope): Promise<string>;
}
