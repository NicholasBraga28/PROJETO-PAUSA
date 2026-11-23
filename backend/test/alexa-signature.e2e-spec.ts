import { INestApplication, Logger } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import * as request from "supertest";
import { ALEXA_TIMESTAMP_TOLERANCE_MS } from "../src/alexa/alexa-signature.guard";
import { FakeClock } from "../src/common/clock/fake-clock";
import { TherapistProfileService } from "../src/therapists/therapist-profile.service";
import { ALEXA_TEST_USER_ID, intentRequest, launchRequest } from "./support/alexa-envelopes";
import { createTestApp } from "./support/create-test-app";
import { AlexaHeaders, signedAlexaHeaders } from "./support/fake-alexa-request-verifier";

const NOW = new Date("2026-11-03T13:00:00.000Z");
const ONE_SECOND_MS = 1_000;
const OTHER_SKILL_ID = "amzn1.ask.skill.11111111-1111-4111-8111-111111111111";
const agendaRequest = (timestamp = NOW) => intentRequest("AgendaDoDiaIntent", { timestamp });

const offsetFromNow = (milliseconds: number) => new Date(NOW.getTime() + milliseconds);

const UNVERIFIED_REQUESTS: ReadonlyArray<Readonly<{ case: string; headersFor: (body: string) => AlexaHeaders }>> = [
  {
    case: "a body changed after it was signed",
    headersFor: (body) => signedAlexaHeaders(body.replace("AgendaDoDiaIntent", "QuemChegouIntent")),
  },
  { case: "no signature headers", headersFor: () => ({ "content-type": "application/json" }) },
  {
    case: "a certificate the verifier does not trust",
    headersFor: (body) => ({ ...signedAlexaHeaders(body), signaturecertchainurl: "https://example.com/cert.pem" }),
  },
];

describe("AlexaSignatureGuard (e2e)", () => {
  let app: INestApplication;
  const clock = new FakeClock(NOW);

  const send = (body: string, headers: AlexaHeaders = signedAlexaHeaders(body)) =>
    request(app.getHttpServer()).post("/api/alexa").set(headers).send(body);
  const sendEnvelope = (envelope: RequestEnvelope) => send(JSON.stringify(envelope));

  beforeAll(async () => {
    ({ app } = await createTestApp({ clock }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("RNF-03: answers a verified request from this skill, on time, with speech", async () => {
    const response = await sendEnvelope(launchRequest({ timestamp: NOW })).expect(200);

    expect(response.body.response.outputSpeech.ssml).toContain("Olá");
  });

  it.each(UNVERIFIED_REQUESTS)(
    "RNF-03: refuses $case with 400, without speech and without reaching the handler",
    async ({ headersFor }) => {
      const therapistIdOf = jest.spyOn(TherapistProfileService.prototype, "therapistIdOf");
      const body = JSON.stringify(agendaRequest());

      const response = await send(body, headersFor(body)).expect(400);

      expect(response.body.response).toBeUndefined();
      expect(therapistIdOf).not.toHaveBeenCalled();
    },
  );

  it.each([
    { case: "more than 150 s before", timestamp: offsetFromNow(-ALEXA_TIMESTAMP_TOLERANCE_MS - ONE_SECOND_MS) },
    { case: "more than 150 s after", timestamp: offsetFromNow(ALEXA_TIMESTAMP_TOLERANCE_MS + ONE_SECOND_MS) },
  ])("RNF-03: refuses a request sent $case the server clock", async ({ timestamp }) => {
    const response = await sendEnvelope(launchRequest({ timestamp })).expect(400);

    expect(response.body.response).toBeUndefined();
  });

  it("RNF-03: accepts a request sent exactly 150 s before the server clock", async () => {
    await sendEnvelope(launchRequest({ timestamp: offsetFromNow(-ALEXA_TIMESTAMP_TOLERANCE_MS) })).expect(200);
  });

  it("RNF-03: refuses a request addressed to another skill", async () => {
    const response = await sendEnvelope(launchRequest({ timestamp: NOW, applicationId: OTHER_SKILL_ID })).expect(400);

    expect(response.body.response).toBeUndefined();
  });

  it("RNF-04: logs a refused request with only the reason and IDs", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await sendEnvelope(launchRequest({ timestamp: NOW, applicationId: OTHER_SKILL_ID })).expect(400);

    expect(warn).toHaveBeenCalledTimes(1);
    const [entry] = warn.mock.calls[0];
    expect(entry).toEqual(expect.stringContaining("reason=other_skill"));
    expect(entry).toEqual(expect.stringContaining(OTHER_SKILL_ID));
    expect(entry).not.toContain(ALEXA_TEST_USER_ID);
    expect(entry).not.toContain("LaunchRequest");
  });
});
