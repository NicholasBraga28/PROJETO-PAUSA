import type { Intent } from "ask-sdk-model";
import { messages } from "../messages/catalog";
import type { SpeakerEntity } from "./speaker-names";

export type AlexaReply = Readonly<{
  speech?: string;
  reprompt?: string;
  shouldEndSession: boolean;
  confirmIntent?: Intent;
  sessionAttributes?: Readonly<Record<string, unknown>>;
  speakerEntities?: readonly SpeakerEntity[];
}>;

export const SILENT_REPLY: AlexaReply = { shouldEndSession: true };

export function finalReplyOf(speech: string): AlexaReply {
  return { speech, shouldEndSession: true };
}

export function openReplyOf(speech: string, sessionAttributes?: AlexaReply["sessionAttributes"]): AlexaReply {
  return { speech, reprompt: messages.alexa.whatToSay, shouldEndSession: false, sessionAttributes };
}

export function repeatableReplyOf(speech: string, sessionAttributes: AlexaReply["sessionAttributes"]): AlexaReply {
  return { speech, reprompt: messages.alexa.repeatHint, shouldEndSession: false, sessionAttributes };
}

export function questionReplyOf(
  speech: string,
  question: string,
  sessionAttributes: AlexaReply["sessionAttributes"],
): AlexaReply {
  return { speech, reprompt: question, shouldEndSession: false, sessionAttributes };
}

export function confirmationReplyOf(
  question: string,
  intent: Intent,
  sessionAttributes: AlexaReply["sessionAttributes"],
): AlexaReply {
  return { speech: question, reprompt: question, shouldEndSession: false, confirmIntent: intent, sessionAttributes };
}
