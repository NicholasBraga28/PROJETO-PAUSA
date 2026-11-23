import { AppointmentStatus } from "@prisma/client";
import type { Intent, RequestEnvelope } from "ask-sdk-model";

const SPEAKER_ATTRIBUTE = "speakerTherapistId";
const PENDING_INTENT_ATTRIBUTE = "pendingIntent";
const SPEAKER_ATTEMPTS_ATTRIBUTE = "speakerAttempts";
const LAST_SPEECH_ATTRIBUTE = "lastSpeech";
const PENDING_ACTION_ATTRIBUTE = "pendingAction";

export type SessionAttributes = Readonly<Record<string, unknown>>;

export type PendingAction =
  | Readonly<{ kind: "CANCEL"; therapistId: string; appointmentId: string; expectedStatus: AppointmentStatus }>
  | Readonly<{ kind: "BLOCK"; therapistId: string; startsAt: string; endsAt: string }>
  | Readonly<{ kind: "READ_AGENDA"; therapistId: string }>;

export type SpeakerQuestionState = Readonly<{ pendingIntent?: Intent; attempts: number }>;

const isIntent = (value: unknown): value is Intent =>
  typeof value === "object" && value !== null && typeof (value as { name?: unknown }).name === "string";

export function sessionAttributesOf(envelope: RequestEnvelope): SessionAttributes {
  return envelope.session?.attributes ?? {};
}

const hasStringFields = (value: object, fields: readonly string[]): boolean =>
  fields.every((field) => typeof (value as Record<string, unknown>)[field] === "string");

const isAppointmentStatus = (value: object): boolean =>
  Object.values<unknown>(AppointmentStatus).includes((value as { expectedStatus?: unknown }).expectedStatus);

const isPendingAction = (value: unknown): value is PendingAction => {
  if (typeof value !== "object" || value === null || !hasStringFields(value, ["therapistId"])) return false;
  const { kind } = value as { kind?: unknown };
  if (kind === "CANCEL") return hasStringFields(value, ["appointmentId"]) && isAppointmentStatus(value);
  if (kind === "BLOCK") return hasStringFields(value, ["startsAt", "endsAt"]);
  return kind === "READ_AGENDA";
};

export function identifiedSpeakerOf(envelope: RequestEnvelope): string | undefined {
  const therapistId = sessionAttributesOf(envelope)[SPEAKER_ATTRIBUTE];
  return typeof therapistId === "string" ? therapistId : undefined;
}

export function identifiedSpeakerAttributesOf(therapistId: string): SessionAttributes {
  return { [SPEAKER_ATTRIBUTE]: therapistId };
}

export function keptSpeakerAttributesOf(envelope: RequestEnvelope): SessionAttributes {
  const therapistId = identifiedSpeakerOf(envelope);
  return therapistId ? identifiedSpeakerAttributesOf(therapistId) : {};
}

export function lastSpeechAttributesOf(speech: string): SessionAttributes {
  return { [LAST_SPEECH_ATTRIBUTE]: speech };
}

export function lastSpeechOf(envelope: RequestEnvelope): string | undefined {
  const speech = sessionAttributesOf(envelope)[LAST_SPEECH_ATTRIBUTE];
  return typeof speech === "string" ? speech : undefined;
}

export function speakerQuestionStateOf(envelope: RequestEnvelope): SpeakerQuestionState {
  const attributes = sessionAttributesOf(envelope);
  const pendingIntent = attributes[PENDING_INTENT_ATTRIBUTE];
  const attempts = attributes[SPEAKER_ATTEMPTS_ATTRIBUTE];
  return {
    pendingIntent: isIntent(pendingIntent) ? pendingIntent : undefined,
    attempts: typeof attempts === "number" ? attempts : 0,
  };
}

export function speakerQuestionAttributesOf({ pendingIntent, attempts }: SpeakerQuestionState): SessionAttributes {
  return { [PENDING_INTENT_ATTRIBUTE]: pendingIntent, [SPEAKER_ATTEMPTS_ATTRIBUTE]: attempts };
}

export function pendingActionOf(envelope: RequestEnvelope): PendingAction | undefined {
  const pendingAction = sessionAttributesOf(envelope)[PENDING_ACTION_ATTRIBUTE];
  return isPendingAction(pendingAction) ? pendingAction : undefined;
}

export function pendingActionAttributesOf(pendingAction: PendingAction): SessionAttributes {
  return { [PENDING_ACTION_ATTRIBUTE]: pendingAction };
}
