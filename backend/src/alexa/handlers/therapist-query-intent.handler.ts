import { AlexaReply, repeatableReplyOf } from "../alexa-reply";
import { identifiedSpeakerAttributesOf } from "../alexa-session";
import { TherapistIntentHandler } from "./therapist-intent.handler";

export abstract class TherapistQueryIntentHandler extends TherapistIntentHandler {
  protected replyOf(speech: string, therapistId: string): AlexaReply {
    return repeatableReplyOf(speech, identifiedSpeakerAttributesOf(therapistId));
  }
}
