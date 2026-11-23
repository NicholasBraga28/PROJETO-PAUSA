import { Injectable } from "@nestjs/common";
import type { Directive, Intent, ResponseEnvelope, ui } from "ask-sdk-model";
import type { AlexaReply } from "./alexa-reply";
import { lastSpeechAttributesOf } from "./alexa-session";
import type { SpeakerEntity } from "./speaker-names";

const ALEXA_RESPONSE_VERSION = "1.0";
const SPEAKER_NAME_SLOT_TYPE = "TherapistName";

const escapeSsml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const ssmlOf = (text: string): ui.SsmlOutputSpeech => ({ type: "SSML", ssml: `<speak>${escapeSsml(text)}</speak>` });

const confirmIntentDirectiveOf = (updatedIntent: Intent): Directive => ({
  type: "Dialog.ConfirmIntent",
  updatedIntent,
});

const speakerEntitiesDirectiveOf = (entities: readonly SpeakerEntity[]): Directive => ({
  type: "Dialog.UpdateDynamicEntities",
  updateBehavior: "REPLACE",
  types: [
    {
      name: SPEAKER_NAME_SLOT_TYPE,
      values: entities.map(({ therapistId, spokenName }) => ({ id: therapistId, name: { value: spokenName } })),
    },
  ],
});

const outgoingSessionAttributesOf = (speech: string, { shouldEndSession, sessionAttributes }: AlexaReply) =>
  shouldEndSession ? sessionAttributes : { ...sessionAttributes, ...lastSpeechAttributesOf(speech) };

const directivesOf = ({ confirmIntent, speakerEntities }: AlexaReply): Directive[] => [
  ...(confirmIntent ? [confirmIntentDirectiveOf(confirmIntent)] : []),
  ...(speakerEntities ? [speakerEntitiesDirectiveOf(speakerEntities)] : []),
];

@Injectable()
export class AlexaResponseBuilder {
  responseOf(reply: AlexaReply): ResponseEnvelope {
    const { speech, reprompt, shouldEndSession } = reply;
    if (speech === undefined) return { version: ALEXA_RESPONSE_VERSION, response: {} };
    const sessionAttributes = outgoingSessionAttributesOf(speech, reply);
    const directives = directivesOf(reply);
    return {
      version: ALEXA_RESPONSE_VERSION,
      ...(sessionAttributes && { sessionAttributes: { ...sessionAttributes } }),
      response: {
        outputSpeech: ssmlOf(speech),
        ...(reprompt && { reprompt: { outputSpeech: ssmlOf(reprompt) } }),
        ...(directives.length > 0 && { directives }),
        shouldEndSession,
      },
    };
  }
}
