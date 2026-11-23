import type { Intent, IntentConfirmationStatus, RequestEnvelope } from "ask-sdk-model";
import type { SpeakerResolution } from "./alexa-speaker-resolver";

export const SPEAKER_NAME_SLOT = "name";

const ENTITY_RESOLUTION_MATCH = "ER_SUCCESS_MATCH";

export type AlexaRequestContext = Readonly<{ speaker: SpeakerResolution }>;

export type AlexaRequest = Readonly<{ envelope: RequestEnvelope; context: AlexaRequestContext }>;

export function deviceIdOf(envelope: RequestEnvelope): string | undefined {
  return envelope.context?.System?.device?.deviceId;
}

export function intentNameOf(envelope: RequestEnvelope): string | undefined {
  return envelope.request.type === "IntentRequest" ? envelope.request.intent.name : undefined;
}

export function slotValueOf(envelope: RequestEnvelope, slotName: string): string | undefined {
  return envelope.request.type === "IntentRequest" ? envelope.request.intent.slots?.[slotName]?.value : undefined;
}

export function resolvedSlotIdOf(envelope: RequestEnvelope, slotName: string): string | undefined {
  if (envelope.request.type !== "IntentRequest") return undefined;
  const authorities = envelope.request.intent.slots?.[slotName]?.resolutions?.resolutionsPerAuthority ?? [];
  return authorities.find(({ status }) => status.code === ENTITY_RESOLUTION_MATCH)?.values[0]?.value.id;
}

export function isIntentOneOf(envelope: RequestEnvelope, intentNames: readonly string[]): boolean {
  const intentName = intentNameOf(envelope);
  return intentName !== undefined && intentNames.includes(intentName);
}

export function intentSlotsOf(envelope: RequestEnvelope): Intent["slots"] {
  return envelope.request.type === "IntentRequest" ? envelope.request.intent.slots : undefined;
}

export function confirmationStatusOf(envelope: RequestEnvelope): IntentConfirmationStatus {
  return envelope.request.type === "IntentRequest" ? envelope.request.intent.confirmationStatus : "NONE";
}
