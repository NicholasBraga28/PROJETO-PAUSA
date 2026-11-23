import type { RequestEnvelope } from "ask-sdk-model";
import { messages } from "../messages/catalog";
import { spokenListOf } from "../notifications/spoken-text";
import { AlexaReply, finalReplyOf } from "./alexa-reply";
import type { AlexaRequest } from "./alexa-request";
import { SpeakerQuestionState, speakerQuestionAttributesOf, speakerQuestionStateOf } from "./alexa-session";
import type { SpeakerCandidate } from "./alexa-speaker-resolver";
import { hasSharedFirstNames, speakerEntitiesOf } from "./speaker-names";

export const IDENTIFY_SPEAKER_INTENT = "IdentifySpeakerIntent";

const MAX_SPEAKER_ATTEMPTS = 2;

const questionFor = (candidates: readonly SpeakerCandidate[]): string =>
  hasSharedFirstNames(candidates) ? messages.alexa.whoIsSpeakingWithSurname : messages.alexa.whoIsSpeaking;

const spokenNamesOf = (candidates: readonly SpeakerCandidate[]): string =>
  spokenListOf(speakerEntitiesOf(candidates).map(({ spokenName }) => spokenName));

function askingReplyOf(
  speech: string,
  state: SpeakerQuestionState,
  candidates: readonly SpeakerCandidate[],
): AlexaReply {
  return {
    speech,
    reprompt: speech,
    shouldEndSession: false,
    sessionAttributes: speakerQuestionAttributesOf(state),
    speakerEntities: speakerEntitiesOf(candidates),
  };
}

export function speakerQuestionOf(envelope: RequestEnvelope, candidates: readonly SpeakerCandidate[]): AlexaReply {
  const pendingIntent = envelope.request.type === "IntentRequest" ? envelope.request.intent : undefined;
  return askingReplyOf(questionFor(candidates), { pendingIntent, attempts: 0 }, candidates);
}

export function unknownSpeakerReplyOf(envelope: RequestEnvelope, candidates: readonly SpeakerCandidate[]): AlexaReply {
  const { pendingIntent, attempts } = speakerQuestionStateOf(envelope);
  const names = spokenNamesOf(candidates);
  const attempt = attempts + 1;
  if (attempt >= MAX_SPEAKER_ATTEMPTS) return finalReplyOf(messages.alexa.speakersOfDevice(names));
  return askingReplyOf(messages.alexa.speakerNotLinked(names), { pendingIntent, attempts: attempt }, candidates);
}

export function withPendingIntentReplayed(request: AlexaRequest): AlexaRequest {
  const { envelope, context } = request;
  const { pendingIntent } = speakerQuestionStateOf(envelope);
  const answer = envelope.request;
  const isAnsweringTheQuestion = answer.type === "IntentRequest" && answer.intent.name === IDENTIFY_SPEAKER_INTENT;
  if (!isAnsweringTheQuestion || !pendingIntent || context.speaker.kind !== "IDENTIFIED") return request;
  return { context, envelope: { ...envelope, request: { ...answer, intent: pendingIntent } } };
}
