import { INestApplication } from "@nestjs/common";
import type { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { ALEXA_TEST_DEVICE_ID, intentRequest } from "./support/alexa-envelopes";
import { createTestApp } from "./support/create-test-app";
import { signedAlexaHeaders } from "./support/fake-alexa-request-verifier";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const TUESDAY_13H_IN_SAO_PAULO = new Date("2026-11-03T16:00:00Z");
const TUESDAY_23_30_IN_SAO_PAULO = new Date("2026-11-04T02:30:00Z");
const SESSION_MS = 20 * 60_000;
const REPEAT_HINT = "<speak>Para ouvir de novo, diga repetir.</speak>";
const SENTENCE = /[^.?!]+[.?!]/g;
const QUERY_INTENTS = ["NextAppointmentIntent", "TodayAgendaIntent", "WhoArrivedIntent"];

type AppointmentOptions = Readonly<{ status?: AppointmentStatus; checkedInAt?: string; therapistId?: string }>;

describe("Alexa queries (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let roomId: string;
  let marcosId: string;
  const clock = new FakeClock(TUESDAY_13H_IN_SAO_PAULO);

  const sendIntent = (name: string, slots?: Record<string, string>) => {
    const body = JSON.stringify(intentRequest(name, { timestamp: clock.now(), slots }));
    return request(app.getHttpServer()).post("/api/alexa").set(signedAlexaHeaders(body)).send(body);
  };
  const answer = (name: string, question: request.Response) => {
    const envelope = intentRequest(name, {
      timestamp: clock.now(),
      sessionAttributes: question.body.sessionAttributes,
    });
    const body = JSON.stringify(envelope);
    return request(app.getHttpServer()).post("/api/alexa").set(signedAlexaHeaders(body)).send(body);
  };
  const textOf = (response: request.Response): string =>
    response.body.response.outputSpeech.ssml.replace(/^<speak>|<\/speak>$/g, "");

  const createTherapist = async (name: string) => {
    const email = `${name.toLowerCase().replaceAll(" ", ".")}@example.com`;
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return (await prisma.therapist.create({ data: { userId: user.id } })).id;
  };
  const createAppointment = async (employeeName: string, startsAt: string, options: AppointmentOptions = {}) => {
    const employee = await prisma.user.create({
      data: {
        email: `${employeeName.toLowerCase().replaceAll(" ", ".")}@example.com`,
        name: employeeName,
        role: "EMPLOYEE",
      },
    });
    const start = new Date(startsAt);
    await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: options.therapistId ?? marcosId,
        roomId,
        startsAt: start,
        endsAt: new Date(start.getTime() + SESSION_MS),
        status: options.status ?? (options.checkedInAt ? "CHECKED_IN" : "CONFIRMED"),
        checkedInAt: options.checkedInAt && new Date(options.checkedInAt),
      },
    });
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(TUESDAY_13H_IN_SAO_PAULO);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    roomId = (await prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "sala-1" } }))
      .id;
    marcosId = await createTherapist("Marcos Pereira");
    await prisma.alexaDevice.create({
      data: { deviceId: ALEXA_TEST_DEVICE_ID, therapists: { create: { therapistId: marcosId } } },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("ALX-01 RF-11: next appointment", () => {
    it("RF-11: says the first name and the spoken time of the next confirmed appointment", async () => {
      await createAppointment("Ana Souza", "2026-11-03T17:00:00Z");

      const response = await sendIntent("NextAppointmentIntent").expect(200);

      expect(textOf(response)).toBe("Próximo: Ana, às 14h.");
    });

    it("RF-11: says there is nothing left today when every appointment has passed", async () => {
      await createAppointment("Ana Souza", "2026-11-03T12:00:00Z", { status: "COMPLETED" });

      const response = await sendIntent("NextAppointmentIntent").expect(200);

      expect(textOf(response)).toBe("Você não tem mais atendimentos hoje.");
    });
  });

  describe("ALX-02 RF-10: today's agenda", () => {
    describe("with more than one appointment still left", () => {
      beforeEach(async () => {
        await createAppointment("Bia Lima", "2026-11-03T12:00:00Z", { status: "COMPLETED" });
        await createAppointment("Caio Reis", "2026-11-03T13:00:00Z", { status: "COMPLETED" });
        await createAppointment("Carla Alves", "2026-11-03T16:30:00Z", { status: "CANCELLED" });
        await createAppointment("Ana Souza", "2026-11-03T17:00:00Z");
        await createAppointment("Davi Melo", "2026-11-03T18:30:00Z");
      });

      it("RF-10: counts only what is still left and offers to read every appointment", async () => {
        const response = await sendIntent("TodayAgendaIntent").expect(200);

        expect(textOf(response)).toBe("Hoje, 2 atendimentos. Quer que eu fale todos?");
        expect(response.body.response.shouldEndSession).toBe(false);
        expect(response.body.response.reprompt).toEqual({
          outputSpeech: { type: "SSML", ssml: "<speak>Quer que eu fale todos?</speak>" },
        });
      });

      it("RF-10: after yes, reads every appointment still left with its time, in order", async () => {
        const question = await sendIntent("TodayAgendaIntent");

        const response = await answer("AMAZON.YesIntent", question).expect(200);

        expect(textOf(response)).toBe("Ana às 14h e Davi às 15h30.");
      });

      it("RF-10: after no, reads nothing", async () => {
        const question = await sendIntent("TodayAgendaIntent");

        const response = await answer("AMAZON.NoIntent", question).expect(200);

        expect(textOf(response)).toBe("Tudo bem.");
      });
    });

    it("RNF-05: speaks about the São Paulo day at 23h30 there, not about tomorrow", async () => {
      clock.set(TUESDAY_23_30_IN_SAO_PAULO);
      await createAppointment("Beatriz Rocha", "2026-11-04T02:40:00Z");
      await createAppointment("Carla Alves", "2026-11-04T13:00:00Z");

      const response = await sendIntent("TodayAgendaIntent").expect(200);

      expect(textOf(response)).toBe("Hoje, 1 atendimento. Primeiro: Beatriz, às 23h40.");
    });
  });

  describe("ALX-03 RF-15 RN-14: who arrived", () => {
    it("RF-15: says the latest arrival first and then how many arrived today", async () => {
      await createAppointment("Bia Lima", "2026-11-03T16:20:00Z", { checkedInAt: "2026-11-03T16:10:00Z" });
      await createAppointment("Ana Souza", "2026-11-03T17:00:00Z", { checkedInAt: "2026-11-03T16:55:00Z" });
      await createAppointment("Caio Reis", "2026-11-03T16:40:00Z", { checkedInAt: "2026-11-03T16:30:00Z" });

      const response = await sendIntent("WhoArrivedIntent").expect(200);

      expect(textOf(response)).toBe("Ana chegou às 13h55. Hoje, 3 pessoas chegaram.");
    });

    it("RF-15: says nobody arrived yet", async () => {
      await createAppointment("Ana Souza", "2026-11-03T17:00:00Z");

      const response = await sendIntent("WhoArrivedIntent").expect(200);

      expect(textOf(response)).toBe("Ninguém chegou ainda.");
    });
  });

  describe("RN-17: with a colleague linked to the same device", () => {
    beforeEach(async () => {
      const dianaId = await createTherapist("Diana Rocha");
      await prisma.alexaDeviceTherapist.create({
        data: { alexaDevice: { connect: { deviceId: ALEXA_TEST_DEVICE_ID } }, therapist: { connect: { id: dianaId } } },
      });
      await createAppointment("Eva Nunes", "2026-11-03T16:30:00Z", {
        therapistId: dianaId,
        checkedInAt: "2026-11-03T16:25:00Z",
      });
      await createAppointment("Ana Souza", "2026-11-03T17:00:00Z", { checkedInAt: "2026-11-03T16:50:00Z" });
    });

    it.each([
      { intent: "NextAppointmentIntent", text: "Próximo: Ana, às 14h." },
      { intent: "TodayAgendaIntent", text: "Hoje, 1 atendimento. Primeiro: Ana, às 14h." },
      { intent: "WhoArrivedIntent", text: "Ana chegou às 13h50." },
    ])("RN-13: $intent speaks only the appointments of the therapist who said the name", async ({ intent, text }) => {
      const response = await sendIntent(intent, { name: "Marcos" }).expect(200);

      expect(textOf(response)).toBe(text);
    });
  });

  describe("RNF-01 RNF-04: every query answer", () => {
    beforeEach(async () => {
      await createAppointment("Ana Maria Souza", "2026-11-03T17:00:00Z", { checkedInAt: "2026-11-03T16:55:00Z" });
      await createAppointment("Bia Lima", "2026-11-03T18:00:00Z", { checkedInAt: "2026-11-03T16:40:00Z" });
    });

    it.each(["NextAppointmentIntent", "WhoArrivedIntent"])(
      "%s keeps the session open with the repeat hint and keeps the speech",
      async (intent) => {
        const response = await sendIntent(intent).expect(200);

        expect(response.body.response.shouldEndSession).toBe(false);
        expect(response.body.response.reprompt).toEqual({ outputSpeech: { type: "SSML", ssml: REPEAT_HINT } });
        expect(response.body.sessionAttributes).toEqual({ speakerTherapistId: marcosId, lastSpeech: textOf(response) });
      },
    );

    it("TodayAgendaIntent keeps the session open waiting for the answer and keeps the speech", async () => {
      const response = await sendIntent("TodayAgendaIntent").expect(200);

      expect(response.body.response.shouldEndSession).toBe(false);
      expect(response.body.sessionAttributes).toEqual({
        speakerTherapistId: marcosId,
        lastSpeech: textOf(response),
        pendingAction: { kind: "READ_AGENDA", therapistId: marcosId },
      });
    });

    it.each(QUERY_INTENTS)(
      "%s answers in up to two sentences with the first name and no ID or ISO time",
      async (intent) => {
        const response = await sendIntent(intent).expect(200);
        const text = textOf(response);

        expect(text.match(SENTENCE)?.length).toBeLessThanOrEqual(2);
        expect(text).toMatch(/^(Próximo: Ana|Hoje, \d|Ana chegou)/);
        expect(text).not.toMatch(/Maria|Souza|Lima|\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|UTC|[0-9a-f]{8}-/);
      },
    );
  });
});
