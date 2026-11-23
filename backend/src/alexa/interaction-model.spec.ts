import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RequestEnvelope } from "ask-sdk-model";
import { INTENT_HANDLERS } from "./alexa.module";
import type { AlexaIntentHandler } from "./alexa-intent-handler";
import type { AlexaRequest } from "./alexa-request";
import { NOT_SERVED } from "./alexa-speaker-resolver";

const MODEL_PATH = join(__dirname, "..", "..", "alexa", "interaction-model.pt-BR.json");

const INTENTS_FALLING_BACK = ["AMAZON.FallbackIntent", "AMAZON.NavigateHomeIntent"];

type ModelIntent = Readonly<{ name: string }>;
type DialogIntent = Readonly<{
  name: string;
  confirmationRequired?: boolean;
  prompts?: Readonly<Record<string, string>>;
}>;
type Prompt = Readonly<{ id: string }>;
type InteractionModel = Readonly<{
  interactionModel: Readonly<{
    languageModel: Readonly<{ invocationName: string; intents: readonly ModelIntent[] }>;
    dialog?: Readonly<{ intents: readonly DialogIntent[] }>;
    prompts?: readonly Prompt[];
  }>;
}>;

type HandlerClassBuiltWithoutServices = new (...dependencies: never[]) => AlexaIntentHandler;

const REQUEST_FIELDS = { requestId: "request-id", timestamp: "2026-11-03T12:00:00Z", locale: "pt-BR" };

function loadModel(): InteractionModel {
  return JSON.parse(readFileSync(MODEL_PATH, "utf8")) as InteractionModel;
}

function requestFor(request: RequestEnvelope["request"]): AlexaRequest {
  return { envelope: { version: "1.0", request } as RequestEnvelope, context: { speaker: NOT_SERVED } };
}

function intentRequestFor(name: string): AlexaRequest {
  return requestFor({
    ...REQUEST_FIELDS,
    type: "IntentRequest",
    dialogState: "STARTED",
    intent: { name, confirmationStatus: "NONE" },
  });
}

const LAUNCH_REQUEST = requestFor({ ...REQUEST_FIELDS, type: "LaunchRequest" });
const SESSION_ENDED_REQUEST = requestFor({ ...REQUEST_FIELDS, type: "SessionEndedRequest", reason: "USER_INITIATED" });

const handlersAnsweringOnlyCanHandle = (INTENT_HANDLERS as readonly HandlerClassBuiltWithoutServices[]).map(
  (Handler) => new Handler(),
);

describe("Alexa interaction model (pt-BR)", () => {
  const model = loadModel().interactionModel;
  const intentNames = model.languageModel.intents.map((intent) => intent.name);

  it('ALX-01..ALX-09: uses the invocation name "pausa"', () => {
    expect(model.languageModel.invocationName).toBe("pausa");
  });

  it("ALX-01..ALX-09: declares every intent of the spec", () => {
    expect([...intentNames].sort()).toEqual(
      [
        "PairDeviceIntent",
        "NextAppointmentIntent",
        "TodayAgendaIntent",
        "WhoArrivedIntent",
        "CancelAppointmentIntent",
        "BlockScheduleIntent",
        "StartSessionIntent",
        "FinishSessionIntent",
        "IdentifySpeakerIntent",
        "PresentationInviteIntent",
        "AMAZON.HelpIntent",
        "AMAZON.RepeatIntent",
        "AMAZON.StopIntent",
        "AMAZON.CancelIntent",
        "AMAZON.FallbackIntent",
        "AMAZON.YesIntent",
        "AMAZON.NoIntent",
        "AMAZON.NavigateHomeIntent",
      ].sort(),
    );
  });

  it.each(intentNames)("ALX-01..ALX-09: %s has a handler or explicitly falls back", (intentName) => {
    const handled = handlersAnsweringOnlyCanHandle.some((handler) => handler.canHandle(intentRequestFor(intentName)));

    expect(handled).toBe(!INTENTS_FALLING_BACK.includes(intentName));
  });

  it("ALX-01..ALX-09: every registered handler answers a request the model can produce", () => {
    const modelRequests = [LAUNCH_REQUEST, SESSION_ENDED_REQUEST, ...intentNames.map(intentRequestFor)];

    const orphans = handlersAnsweringOnlyCanHandle.filter(
      (handler) => !modelRequests.some((request) => handler.canHandle(request)),
    );

    expect(orphans.map((handler) => handler.constructor.name)).toEqual([]);
  });

  it("RF-12 RF-13 ALX-04 ALX-05: only CancelAppointmentIntent and BlockScheduleIntent require confirmation", () => {
    const confirmed = (model.dialog?.intents ?? [])
      .filter((intent) => intent.confirmationRequired)
      .map((intent) => intent.name);

    expect(confirmed.sort()).toEqual(["BlockScheduleIntent", "CancelAppointmentIntent"]);
  });

  it("RF-12 RF-13 ALX-04 ALX-05: each confirmation points to a declared prompt under the key Amazon accepts", () => {
    const promptIds = (model.prompts ?? []).map((prompt) => prompt.id);
    const confirmedIntents = (model.dialog?.intents ?? []).filter((intent) => intent.confirmationRequired);

    const promptKeys = confirmedIntents.map((intent) => Object.keys(intent.prompts ?? {}));
    const confirmationPrompts = confirmedIntents.map((intent) => intent.prompts?.confirmation);

    expect(promptKeys).toEqual([["confirmation"], ["confirmation"]]);
    expect(confirmationPrompts.every((id) => id !== undefined && promptIds.includes(id))).toBe(true);
  });
});
