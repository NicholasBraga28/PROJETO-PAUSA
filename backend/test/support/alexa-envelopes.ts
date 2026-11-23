import type { IntentConfirmationStatus, RequestEnvelope } from "ask-sdk-model";

export const ALEXA_TEST_SKILL_ID = "amzn1.ask.skill.00000000-0000-4000-8000-0000000000a1";
export const ALEXA_TEST_DEVICE_ID = "amzn1.ask.device.TEST-DEVICE";
export const ALEXA_TEST_USER_ID = "amzn1.ask.account.TEST-USER";

type RequestBody = Omit<RequestEnvelope["request"], "requestId" | "timestamp" | "locale">;

type EnvelopeOptions = Readonly<{
  timestamp: Date;
  applicationId?: string;
  deviceId?: string;
  sessionAttributes?: Record<string, unknown>;
}>;

type IntentOptions = EnvelopeOptions &
  Readonly<{
    slots?: Readonly<Record<string, string>>;
    confirmationStatus?: IntentConfirmationStatus;
  }>;

const envelope = (
  {
    timestamp,
    applicationId = ALEXA_TEST_SKILL_ID,
    deviceId = ALEXA_TEST_DEVICE_ID,
    sessionAttributes = {},
  }: EnvelopeOptions,
  request: RequestBody,
): RequestEnvelope => {
  const application = { applicationId };
  const user = { userId: ALEXA_TEST_USER_ID };
  return {
    version: "1.0",
    session: { new: true, sessionId: "amzn1.echo-api.session.TEST", application, user, attributes: sessionAttributes },
    context: { System: { application, user, device: { deviceId, supportedInterfaces: {} }, apiEndpoint: "" } },
    request: {
      ...request,
      requestId: "amzn1.echo-api.request.TEST",
      timestamp: timestamp.toISOString(),
      locale: "pt-BR",
    } as RequestEnvelope["request"],
  };
};

export const launchRequest = (options: EnvelopeOptions): RequestEnvelope =>
  envelope(options, { type: "LaunchRequest" });

export const sessionEndedRequest = (options: EnvelopeOptions): RequestEnvelope =>
  envelope(options, { type: "SessionEndedRequest", reason: "USER_INITIATED" } as RequestBody);

export const intentRequest = (
  name: string,
  { slots = {}, confirmationStatus = "NONE", ...options }: IntentOptions,
): RequestEnvelope =>
  envelope(options, {
    type: "IntentRequest",
    dialogState: "COMPLETED",
    intent: {
      name,
      confirmationStatus,
      slots: Object.fromEntries(
        Object.entries(slots).map(([slotName, value]) => [
          slotName,
          { name: slotName, value, confirmationStatus: "NONE" },
        ]),
      ),
    },
  } as RequestBody);
