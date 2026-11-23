import { INestApplication } from "@nestjs/common";
import type { IntentRequest, RequestEnvelope } from "ask-sdk-model";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { ALEXA_TEST_DEVICE_ID, intentRequest } from "./support/alexa-envelopes";
import { createTestApp } from "./support/create-test-app";
import { signedAlexaHeaders } from "./support/fake-alexa-request-verifier";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-03T15:00:00Z");
const SHIFT_START = new Date("2026-11-03T14:00:00Z");
const SHIFT_END = new Date("2026-11-03T18:00:00Z");
const SESSION_MS = 20 * 60_000;
const BRUNO_NEXT = "<speak>Próximo: Carla, às 13h.</speak>";
const DIANA_NEXT = "<speak>Próximo: Ana, às 13h20.</speak>";
const DIANA_TODAY = "<speak>Hoje, 1 atendimento. Primeiro: Ana, às 13h20.</speak>";
const NOT_PAIRED = "<speak>Este aparelho ainda não está vinculado. Peça ao RH um código de vinculação.</speak>";

type SendOptions = Readonly<{ slots?: Record<string, string>; sessionAttributes?: Record<string, unknown> }>;

describe("Alexa speaker identification (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let roomId: string;
  let brunoId: string;
  let dianaId: string;
  const clock = new FakeClock(NOW);

  const send = (envelope: RequestEnvelope) => {
    const body = JSON.stringify(envelope);
    return request(app.getHttpServer()).post("/api/alexa").set(signedAlexaHeaders(body)).send(body);
  };
  const sendIntent = (name: string, options: SendOptions = {}) =>
    send(intentRequest(name, { timestamp: clock.now(), ...options }));
  const speechOf = (response: request.Response): string => response.body.response.outputSpeech.ssml;

  const createTherapist = async (name: string) => {
    const email = `${name.toLowerCase().replaceAll(" ", ".")}@example.com`;
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return (await prisma.therapist.create({ data: { userId: user.id } })).id;
  };
  const link = (...therapistIds: string[]) =>
    prisma.alexaDevice.create({
      data: {
        deviceId: ALEXA_TEST_DEVICE_ID,
        therapists: { create: therapistIds.map((therapistId) => ({ therapistId })) },
      },
    });
  const scheduleNow = (therapistId: string) =>
    prisma.scheduleSlot.create({ data: { therapistId, roomId, startsAt: SHIFT_START, endsAt: SHIFT_END } });
  const createAppointment = async (therapistId: string, employeeName: string, startsAt: string) => {
    const employee = await prisma.user.create({
      data: { email: `${employeeName.toLowerCase()}@example.com`, name: employeeName, role: "EMPLOYEE" },
    });
    const start = new Date(startsAt);
    await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId,
        roomId,
        startsAt: start,
        endsAt: new Date(start.getTime() + SESSION_MS),
        status: "CONFIRMED",
      },
    });
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(NOW);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    roomId = (await prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "sala-1" } }))
      .id;
    brunoId = await createTherapist("Bruno Lima");
    dianaId = await createTherapist("Diana Rocha");
    await createAppointment(brunoId, "Carla Alves", "2026-11-03T16:00:00Z");
    await createAppointment(dianaId, "Ana Souza", "2026-11-03T16:20:00Z");
  });

  afterAll(async () => {
    await app.close();
  });

  it("D-19 US-10a: answers the only linked therapist without asking who is speaking", async () => {
    await link(brunoId);

    const response = await sendIntent("NextAppointmentIntent").expect(200);

    expect(speechOf(response)).toBe(BRUNO_NEXT);
    expect(response.body.sessionAttributes).toEqual({
      speakerTherapistId: brunoId,
      lastSpeech: "Próximo: Carla, às 13h.",
    });
  });

  it("D-19: answers the only linked therapist on a ScheduleSlot right now", async () => {
    await link(brunoId, dianaId);
    await scheduleNow(dianaId);

    const response = await sendIntent("NextAppointmentIntent").expect(200);

    expect(speechOf(response)).toBe(DIANA_NEXT);
  });

  describe("when the agenda does not tell who is speaking", () => {
    beforeEach(async () => {
      await link(brunoId, dianaId);
      await scheduleNow(brunoId);
      await scheduleNow(dianaId);
    });

    it("RN-17 US-10b: asks who is speaking, offering the linked first names to the name slot", async () => {
      const response = await sendIntent("NextAppointmentIntent").expect(200);

      expect(speechOf(response)).toBe("<speak>Quem está falando?</speak>");
      expect(response.body.response.shouldEndSession).toBe(false);
      expect(response.body.response.directives).toEqual([
        {
          type: "Dialog.UpdateDynamicEntities",
          updateBehavior: "REPLACE",
          types: [
            {
              name: "TherapistName",
              values: [
                { id: brunoId, name: { value: "Bruno" } },
                { id: dianaId, name: { value: "Diana" } },
              ],
            },
          ],
        },
      ]);
    });

    it("RN-17 US-10c: runs the original request once the name arrives and does not ask again", async () => {
      const question = await sendIntent("NextAppointmentIntent").expect(200);

      const answer = await sendIntent("IdentifySpeakerIntent", {
        slots: { name: "Diana" },
        sessionAttributes: question.body.sessionAttributes,
      }).expect(200);
      const followUp = await sendIntent("TodayAgendaIntent", {
        sessionAttributes: answer.body.sessionAttributes,
      }).expect(200);

      expect(speechOf(answer)).toBe(DIANA_NEXT);
      expect(speechOf(followUp)).toBe(DIANA_TODAY);
    });

    it("RN-17 US-10f: answers without asking when the request already says the name", async () => {
      const response = await sendIntent("NextAppointmentIntent", { slots: { name: "diana" } }).expect(200);

      expect(speechOf(response)).toBe(DIANA_NEXT);
    });

    it("RN-17 US-10b: accepts the therapist ID the Alexa resolved from the dynamic names", async () => {
      const envelope = intentRequest("IdentifySpeakerIntent", { timestamp: clock.now(), slots: { name: "diana" } });
      const answer = { ...envelope.request } as IntentRequest;
      answer.intent.slots = {
        name: {
          name: "name",
          value: "Dayana",
          confirmationStatus: "NONE",
          resolutions: {
            resolutionsPerAuthority: [
              {
                authority: "amzn1.er-authority.echo-sdk.dynamic.TherapistName",
                status: { code: "ER_SUCCESS_MATCH" },
                values: [{ value: { id: dianaId, name: "Diana" } }],
              },
            ],
          },
        },
      };
      const question = await sendIntent("NextAppointmentIntent").expect(200);

      const response = await send({
        ...envelope,
        request: answer,
        session: { ...envelope.session!, attributes: question.body.sessionAttributes },
      }).expect(200);

      expect(speechOf(response)).toBe(DIANA_NEXT);
    });

    it("RN-17 US-10d: says who the device serves after an unknown name and gives up after the second", async () => {
      const question = await sendIntent("StartSessionIntent").expect(200);

      const firstTry = await sendIntent("IdentifySpeakerIntent", {
        slots: { name: "Zélia" },
        sessionAttributes: question.body.sessionAttributes,
      }).expect(200);
      const secondTry = await sendIntent("IdentifySpeakerIntent", {
        slots: { name: "Zélia" },
        sessionAttributes: firstTry.body.sessionAttributes,
      }).expect(200);

      expect(speechOf(firstTry)).toBe("<speak>Esta Alexa atende Bruno e Diana. Quem está falando?</speak>");
      expect(firstTry.body.response.shouldEndSession).toBe(false);
      expect(speechOf(secondTry)).toBe("<speak>Esta Alexa atende Bruno e Diana.</speak>");
      expect(secondTry.body.response.shouldEndSession).toBe(true);
      expect(await prisma.appointment.count({ where: { status: "IN_PROGRESS" } })).toBe(0);
    });
  });

  it("RN-17 US-10e: asks for the surname when two linked therapists share the first name", async () => {
    const otherDianaId = await createTherapist("Diana Maria Lima");
    await link(brunoId, dianaId, otherDianaId);

    const response = await sendIntent("NextAppointmentIntent").expect(200);

    expect(speechOf(response)).toBe("<speak>Quem está falando? Diga o nome e o sobrenome.</speak>");
    expect(response.body.response.directives[0].types[0].values).toEqual([
      { id: brunoId, name: { value: "Bruno" } },
      { id: dianaId, name: { value: "Diana Rocha" } },
      { id: otherDianaId, name: { value: "Diana Lima" } },
    ]);
  });

  it("RN-17 US-10e: tells apart two Dianas by the surname", async () => {
    const otherDianaId = await createTherapist("Diana Maria Lima");
    await link(brunoId, dianaId, otherDianaId);

    const byFirstName = await sendIntent("NextAppointmentIntent", { slots: { name: "Diana" } }).expect(200);
    const bySurname = await sendIntent("NextAppointmentIntent", { slots: { name: "Diana Rocha" } }).expect(200);

    expect(speechOf(byFirstName)).toBe("<speak>Quem está falando? Diga o nome e o sobrenome.</speak>");
    expect(speechOf(bySurname)).toBe(DIANA_NEXT);
  });

  describe("US-10: deactivated therapists", () => {
    const deactivate = (therapistId: string) =>
      prisma.user.updateMany({ where: { therapist: { id: therapistId } }, data: { status: "INACTIVE" } });

    it("RN-17: does not serve the only linked therapist once deactivated", async () => {
      await link(brunoId);
      await deactivate(brunoId);

      const response = await sendIntent("NextAppointmentIntent").expect(200);

      expect(speechOf(response)).toBe(NOT_PAIRED);
    });

    it("RN-17: stops serving a therapist deactivated in the middle of the conversation", async () => {
      await link(brunoId, dianaId);
      await deactivate(brunoId);

      const response = await sendIntent("NextAppointmentIntent", {
        sessionAttributes: { speakerTherapistId: brunoId },
      }).expect(200);

      expect(speechOf(response)).toBe(DIANA_NEXT);
    });

    it("RN-17: does not accept the name of a deactivated therapist", async () => {
      const zeliaId = await createTherapist("Zélia Prado");
      await link(brunoId, dianaId, zeliaId);
      await deactivate(zeliaId);

      const response = await sendIntent("NextAppointmentIntent", { slots: { name: "Zélia" } }).expect(200);

      expect(speechOf(response)).toBe("<speak>Quem está falando?</speak>");
    });
  });

  it("RF-17: an unpaired device says it is not paired and ends the session", async () => {
    const response = await sendIntent("NextAppointmentIntent").expect(200);

    expect(speechOf(response)).toBe(NOT_PAIRED);
    expect(response.body.response.shouldEndSession).toBe(true);
  });
});
