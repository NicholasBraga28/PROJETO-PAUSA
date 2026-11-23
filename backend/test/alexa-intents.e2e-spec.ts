import { INestApplication, Logger } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { TherapistAgendaService } from "../src/therapists/therapist-agenda.service";
import { ALEXA_TEST_DEVICE_ID, intentRequest, launchRequest, sessionEndedRequest } from "./support/alexa-envelopes";
import { createTestApp } from "./support/create-test-app";
import { signedAlexaHeaders } from "./support/fake-alexa-request-verifier";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const TUESDAY_23_30_IN_SAO_PAULO = new Date("2026-11-04T02:30:00Z");
const SESSION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

describe("Alexa intents (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;
  let therapistUserId: string;
  let therapistId: string;
  let roomId: string;

  const send = (envelope: RequestEnvelope) => {
    const body = JSON.stringify(envelope);
    return request(app.getHttpServer()).post("/api/alexa").set(signedAlexaHeaders(body)).send(body);
  };
  const sendIntent = (name: string, slots?: Record<string, string>, sessionAttributes?: Record<string, unknown>) =>
    send(intentRequest(name, { timestamp: clock.now(), slots, sessionAttributes }));
  const repeatAfter = (previous: request.Response) =>
    sendIntent("AMAZON.RepeatIntent", {}, previous.body.sessionAttributes);
  const speechOf = (response: request.Response): string => response.body.response.outputSpeech.ssml;

  beforeAll(async () => {
    clock = new FakeClock(TUESDAY_23_30_IN_SAO_PAULO);
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(TUESDAY_23_30_IN_SAO_PAULO);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    const therapistUser = await prisma.user.create({
      data: { email: "therapist@example.com", name: "Marcos Pereira", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-sala-1" },
    });
    therapistUserId = therapistUser.id;
    therapistId = therapist.id;
    roomId = room.id;
    await prisma.alexaDevice.create({
      data: { deviceId: ALEXA_TEST_DEVICE_ID, therapists: { create: { therapistId } } },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAppointment(employeeName: string, startsAt: string, checkedInAt?: string) {
    const employee = await prisma.user.create({
      data: { email: `${employeeName.toLowerCase()}-${startsAt}@example.com`, name: employeeName, role: "EMPLOYEE" },
    });
    const start = new Date(startsAt);
    return prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId,
        roomId,
        startsAt: start,
        endsAt: new Date(start.getTime() + SESSION_MINUTES * MS_PER_MINUTE),
        status: checkedInAt ? "CHECKED_IN" : "CONFIRMED",
        checkedInAt: checkedInAt && new Date(checkedInAt),
      },
    });
  }

  it("RNF-02: WhoArrivedIntent speaks the same text the therapist screen reads", async () => {
    await createAppointment("Beatriz Rocha", "2026-11-04T02:20:00Z", "2026-11-04T02:15:00Z");
    await createAppointment("Diego Alves", "2026-11-04T02:40:00Z");
    const screen = await request(app.getHttpServer())
      .get("/api/therapists/me/arrivals")
      .set("x-user-id", therapistUserId)
      .expect(200);

    const response = await sendIntent("WhoArrivedIntent").expect(200);

    expect(speechOf(response)).toBe(`<speak>${screen.body.spokenText}</speak>`);
  });

  it("RNF-02: starts and finishes the current session by voice", async () => {
    await createAppointment("Beatriz Rocha", "2026-11-04T02:40:00Z");

    const started = await sendIntent("StartSessionIntent").expect(200);
    const finished = await sendIntent("FinishSessionIntent").expect(200);

    expect(speechOf(started)).toBe("<speak>Sessão com Beatriz iniciada.</speak>");
    expect(speechOf(finished)).toBe("<speak>Sessão finalizada.</speak>");
  });

  describe("RF-17: on a device that is not paired", () => {
    beforeEach(async () => {
      await prisma.alexaDevice.deleteMany();
    });

    it.each(["TodayAgendaIntent", "StartSessionIntent", "IdentifySpeakerIntent"])(
      "RF-17: answers %s with the not paired sentence and ends the session",
      async (intent) => {
        const response = await sendIntent(intent).expect(200);

        expect(response.body.response).toEqual({
          outputSpeech: {
            type: "SSML",
            ssml: "<speak>Este aparelho ainda não está vinculado. Peça ao RH um código de vinculação.</speak>",
          },
          shouldEndSession: true,
        });
      },
    );

    it("RF-17: still opens the skill, helps and stops", async () => {
      const launched = await send(launchRequest({ timestamp: clock.now() })).expect(200);
      const helped = await sendIntent("AMAZON.HelpIntent").expect(200);
      const stopped = await sendIntent("AMAZON.StopIntent").expect(200);

      expect(speechOf(launched)).toContain("Olá.");
      expect(speechOf(helped)).toContain("Você pode dizer");
      expect(speechOf(stopped)).toBe("<speak>Até logo.</speak>");
    });
  });

  it("RNF-02: opens the skill with a short greeting and two examples, keeping the session open", async () => {
    const response = await send(launchRequest({ timestamp: clock.now() })).expect(200);

    expect(response.body.response).toEqual({
      outputSpeech: {
        type: "SSML",
        ssml: "<speak>Olá. Você pode pedir o próximo atendimento ou a agenda do dia.</speak>",
      },
      reprompt: {
        outputSpeech: {
          type: "SSML",
          ssml: "<speak>Você pode dizer: próximo atendimento, agenda do dia ou quem chegou.</speak>",
        },
      },
      shouldEndSession: false,
    });
  });

  describe("RNF-02: repeat", () => {
    it("RNF-02: repeats exactly the sentence of the query just answered", async () => {
      await createAppointment("Beatriz Rocha", "2026-11-04T02:40:00Z");
      const answered = await sendIntent("NextAppointmentIntent").expect(200);

      const repeated = await repeatAfter(answered).expect(200);

      expect(speechOf(answered)).toContain("Beatriz");
      expect(speechOf(repeated)).toBe(speechOf(answered));
      expect(repeated.body.response.shouldEndSession).toBe(false);
    });

    it("RNF-02: repeats the greeting, since every answer keeps its own sentence", async () => {
      const launched = await send(launchRequest({ timestamp: clock.now() })).expect(200);

      const repeated = await repeatAfter(launched).expect(200);

      expect(speechOf(repeated)).toBe("<speak>Olá. Você pode pedir o próximo atendimento ou a agenda do dia.</speak>");
    });

    it("RNF-02: answers like the help when nothing was said before", async () => {
      const repeated = await sendIntent("AMAZON.RepeatIntent").expect(200);

      expect(speechOf(repeated)).toBe(
        "<speak>Você pode dizer: próximo atendimento, agenda do dia ou quem chegou.</speak>",
      );
      expect(repeated.body.response.shouldEndSession).toBe(false);
    });
  });

  it("RNF-02: says goodbye when asked to stop", async () => {
    const response = await sendIntent("AMAZON.StopIntent").expect(200);

    expect(speechOf(response)).toBe("<speak>Até logo.</speak>");
  });

  it("says the presentation's closing invite and ends the session", async () => {
    const response = await sendIntent("PresentationInviteIntent").expect(200);

    expect(speechOf(response)).toBe(
      "<speak>Vamos juntos usá-las para abrir as portas da acessibilidade e bem-estar?</speak>",
    );
    expect(response.body.response.shouldEndSession).toBe(true);
  });

  it("RNF-02: helps with at most three commands and a reprompt, keeping the session open", async () => {
    const response = await sendIntent("AMAZON.HelpIntent").expect(200);

    expect(response.body.response).toEqual({
      outputSpeech: {
        type: "SSML",
        ssml: "<speak>Você pode dizer: próximo atendimento, agenda do dia ou quem chegou.</speak>",
      },
      reprompt: {
        outputSpeech: {
          type: "SSML",
          ssml: "<speak>Você pode dizer: próximo atendimento, agenda do dia ou quem chegou.</speak>",
        },
      },
      shouldEndSession: false,
    });
  });

  it.each(["AMAZON.FallbackIntent", "AMAZON.NavigateHomeIntent"])(
    "RNF-02: answers %s, which has no handler of its own, with a short suggestion of what to say",
    async (intent) => {
      const response = await sendIntent(intent).expect(200);

      expect(speechOf(response)).toBe(
        "<speak>Não entendi. Você pode dizer: próximo atendimento ou agenda do dia.</speak>",
      );
      expect(response.body.response.shouldEndSession).toBe(false);
    },
  );

  it("RNF-02: answers the end of the session without speech", async () => {
    const response = await send(sessionEndedRequest({ timestamp: clock.now() })).expect(200);

    expect(response.body).toEqual({ version: "1.0", response: {} });
  });

  it("RNF-04: answers 200 with the generic failure and logs only the request type, intent and IDs", async () => {
    jest
      .spyOn(TherapistAgendaService.prototype, "agendaOf")
      .mockRejectedValue(new Error("agenda of Beatriz Rocha unavailable"));
    const error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    const response = await sendIntent("TodayAgendaIntent").expect(200);

    expect(speechOf(response)).toBe(
      "<speak>Não consegui consultar a agenda agora. Tente de novo em instantes.</speak>",
    );
    expect(error).toHaveBeenCalledTimes(1);
    const [entry] = error.mock.calls[0];
    expect(entry).toBe(
      "Alexa request failed: requestType=IntentRequest intent=TodayAgendaIntent requestId=amzn1.echo-api.request.TEST",
    );
    expect(error.mock.calls[0]).toHaveLength(1);
  });
});
