import { INestApplication } from "@nestjs/common";
import type { AppointmentStatus } from "@prisma/client";
import type { IntentConfirmationStatus } from "ask-sdk-model";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { InMemoryNotificationChannel } from "../src/notifications/in-memory-notification-channel";
import { PrismaService } from "../src/prisma/prisma.service";
import { ALEXA_TEST_DEVICE_ID, intentRequest } from "./support/alexa-envelopes";
import { createTestApp } from "./support/create-test-app";
import { signedAlexaHeaders } from "./support/fake-alexa-request-verifier";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const TUESDAY_13H_IN_SAO_PAULO = new Date("2026-11-03T16:00:00Z");
const TUESDAY_14H_IN_SAO_PAULO = "2026-11-03T17:00:00Z";
const TUESDAY_2H_IN_SAO_PAULO = "2026-11-03T05:00:00Z";
const SESSION_MS = 20 * 60_000;
const SENTENCE = /[^.?!]+[.?!]/g;
const MAX_SENTENCES = 2;
const BLOCK_SLOTS = { startTime: "03:00", endTime: "16:00" };

type AppointmentOptions = Readonly<{ status?: AppointmentStatus; therapistId?: string }>;
type IntentOptions = Readonly<{
  slots?: Record<string, string>;
  confirmationStatus?: IntentConfirmationStatus;
  sessionAttributes?: Record<string, unknown>;
}>;

describe("Alexa actions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channel: InMemoryNotificationChannel;
  let roomId: string;
  let marcosId: string;
  let marcosUserId: string;
  const clock = new FakeClock(TUESDAY_13H_IN_SAO_PAULO);

  const sendIntent = (name: string, options: IntentOptions = {}) => {
    const body = JSON.stringify(intentRequest(name, { timestamp: clock.now(), ...options }));
    return request(app.getHttpServer()).post("/api/alexa").set(signedAlexaHeaders(body)).send(body);
  };
  const textOf = (response: request.Response): string => {
    const text = response.body.response.outputSpeech.ssml.replace(/^<speak>|<\/speak>$/g, "");
    expect(text.match(SENTENCE)?.length).toBeLessThanOrEqual(MAX_SENTENCES);
    return text;
  };
  const answer = (name: string, question: request.Response, confirmationStatus: IntentConfirmationStatus) =>
    sendIntent(name, { confirmationStatus, sessionAttributes: question.body.sessionAttributes });

  const createTherapist = async (name: string) => {
    const email = `${name.toLowerCase().replaceAll(" ", ".")}@example.com`;
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return { userId: user.id, therapistId: (await prisma.therapist.create({ data: { userId: user.id } })).id };
  };
  const createAppointment = async (employeeName: string, startsAt: string, options: AppointmentOptions = {}) => {
    const employee = await prisma.user.create({
      data: {
        email: `${employeeName.toLowerCase().replaceAll(" ", ".")}-${startsAt}@example.com`,
        name: employeeName,
        role: "EMPLOYEE",
      },
    });
    const start = new Date(startsAt);
    return prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: options.therapistId ?? marcosId,
        roomId,
        startsAt: start,
        endsAt: new Date(start.getTime() + SESSION_MS),
        status: options.status ?? "CONFIRMED",
      },
    });
  };
  const statusOf = async (appointmentId: string) =>
    (await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status;

  beforeAll(async () => {
    channel = new InMemoryNotificationChannel();
    ({ app, prisma } = await createTestApp({ clock, notificationChannel: channel }));
  });

  beforeEach(async () => {
    clock.set(TUESDAY_13H_IN_SAO_PAULO);
    channel.messages.length = 0;
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    roomId = (await prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "sala-1" } }))
      .id;
    ({ therapistId: marcosId, userId: marcosUserId } = await createTherapist("Marcos Pereira"));
    await prisma.alexaDevice.create({
      data: { deviceId: ALEXA_TEST_DEVICE_ID, therapists: { create: { therapistId: marcosId } } },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("ALX-04 RF-12: cancel with confirmation", () => {
    it("RF-12 RN-13: asks before cancelling and changes nothing yet", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);

      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } }).expect(200);

      expect(textOf(question)).toBe("Cancelar o atendimento de Ana às 14h. Confirma?");
      expect(question.body.response.shouldEndSession).toBe(false);
      expect(question.body.response.directives).toEqual([
        expect.objectContaining({
          type: "Dialog.ConfirmIntent",
          updatedIntent: expect.objectContaining({ name: "CancelAppointmentIntent" }),
        }),
      ]);
      expect(await statusOf(ana.id)).toBe("CONFIRMED");
    });

    it("RF-12 D-05: cancels after yes, warns the employee and audits the therapist as the actor", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });

      const confirmed = await answer("CancelAppointmentIntent", question, "CONFIRMED").expect(200);

      expect(textOf(confirmed)).toBe("Cancelado.");
      expect(confirmed.body.response.shouldEndSession).toBe(true);
      expect(await statusOf(ana.id)).toBe("CANCELLED");
      expect(channel.messages).toEqual([
        expect.objectContaining({ recipientId: ana.employeeId, kind: "APPOINTMENT_CANCELLED_BY_THERAPIST" }),
      ]);
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: ana.id, action: "APPOINTMENT_CANCELLED" },
      });
      expect(audit?.actorId).toBe(marcosUserId);
    });

    it("RF-12 D-05: cancels an appointment that starts in ten minutes", async () => {
      const ana = await createAppointment("Ana Souza", "2026-11-03T16:10:00Z");
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "13:10" } });

      const confirmed = await answer("CancelAppointmentIntent", question, "CONFIRMED").expect(200);

      expect(textOf(confirmed)).toBe("Cancelado.");
      expect(await statusOf(ana.id)).toBe("CANCELLED");
    });

    it("RN-13: changes nothing after no", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });

      const denied = await answer("CancelAppointmentIntent", question, "DENIED").expect(200);

      expect(textOf(denied)).toBe("Tudo bem, nada foi alterado.");
      expect(await statusOf(ana.id)).toBe("CONFIRMED");
    });

    it("RN-13: also understands a plain yes or no said after the question", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });

      const denied = await answer("AMAZON.NoIntent", question, "NONE").expect(200);
      const confirmed = await answer("AMAZON.YesIntent", question, "NONE").expect(200);

      expect(textOf(denied)).toBe("Tudo bem, nada foi alterado.");
      expect(textOf(confirmed)).toBe("Cancelado.");
      expect(await statusOf(ana.id)).toBe("CANCELLED");
    });

    it.each(["AMAZON.StopIntent", "AMAZON.CancelIntent"])(
      "RN-13: %s drops the pending cancellation, says goodbye and changes nothing",
      async (intent) => {
        const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
        const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });

        const stopped = await answer(intent, question, "NONE").expect(200);

        expect(textOf(stopped)).toBe("Até logo.");
        expect(stopped.body.response.shouldEndSession).toBe(true);
        expect(stopped.body.sessionAttributes).toBeUndefined();
        expect(await statusOf(ana.id)).toBe("CONFIRMED");
      },
    );

    it("RNF-02 RF-12: repeats the question and still cancels after yes", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });

      const repeated = await answer("AMAZON.RepeatIntent", question, "NONE").expect(200);
      const confirmed = await answer("AMAZON.YesIntent", repeated, "NONE").expect(200);

      expect(textOf(repeated)).toBe("Cancelar o atendimento de Ana às 14h. Confirma?");
      expect(repeated.body.response.reprompt.outputSpeech.ssml).toBe(
        "<speak>Cancelar o atendimento de Ana às 14h. Confirma?</speak>",
      );
      expect(textOf(confirmed)).toBe("Cancelado.");
      expect(await statusOf(ana.id)).toBe("CANCELLED");
    });

    it("RN-13: does nothing on a yes without a question asked", async () => {
      const response = await sendIntent("AMAZON.YesIntent").expect(200);

      expect(textOf(response)).toBe(
        "Não há nada para confirmar. Você pode dizer: próximo atendimento ou agenda do dia.",
      );
    });

    it("RF-12: does not act and says why when the employee cancelled before the yes", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });
      await prisma.appointment.update({ where: { id: ana.id }, data: { status: "CANCELLED" } });
      channel.messages.length = 0;

      const confirmed = await answer("CancelAppointmentIntent", question, "CONFIRMED").expect(200);

      expect(textOf(confirmed)).toBe(
        "Esse atendimento foi cancelado ou liberado antes da confirmação. Nada foi alterado.",
      );
      expect(channel.messages).toEqual([]);
    });

    it("RF-12: does not act when the appointment changed state before the yes", async () => {
      const ana = await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      const question = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } });
      await prisma.appointment.update({ where: { id: ana.id }, data: { status: "CHECKED_IN" } });

      const confirmed = await answer("CancelAppointmentIntent", question, "CONFIRMED").expect(200);

      expect(textOf(confirmed)).toBe("Este atendimento acabou de mudar: consulte a agenda e tente de novo.");
      expect(await statusOf(ana.id)).toBe("CHECKED_IN");
    });

    it.each([["14:00"], ["02:00"]])(
      "RF-12: finds the 14h appointment when it is the only reading (%s)",
      async (time) => {
        await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);

        const question = await sendIntent("CancelAppointmentIntent", { slots: { time } }).expect(200);

        expect(textOf(question)).toBe("Cancelar o atendimento de Ana às 14h. Confirma?");
      },
    );

    it('RF-12: does not guess "às duas" when there are appointments at 2h and at 14h', async () => {
      await createAppointment("Ana Souza", TUESDAY_14H_IN_SAO_PAULO);
      await createAppointment("Bruno Lima", TUESDAY_2H_IN_SAO_PAULO);

      const response = await sendIntent("CancelAppointmentIntent", { slots: { time: "02:00" } }).expect(200);

      expect(textOf(response)).toBe("Há atendimentos às 2h e às 14h. Diga, por exemplo: duas da tarde.");
      expect(response.body.response.directives).toBeUndefined();
    });

    it("RF-12: says there is no appointment at the spoken time", async () => {
      const response = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00" } }).expect(200);

      expect(textOf(response)).toBe("Não há atendimento às 14h hoje.");
    });

    it("RF-12: refuses a vague time with an example", async () => {
      const response = await sendIntent("CancelAppointmentIntent", { slots: { time: "AF" } }).expect(200);

      expect(textOf(response)).toBe(
        "Diga o horário exato do atendimento, por exemplo: cancelar o atendimento das duas da tarde.",
      );
    });

    it("RN-13 RN-17: never touches a colleague's appointment on the same device", async () => {
      const { therapistId: julia } = await createTherapist("Julia Costa");
      await prisma.alexaDeviceTherapist.create({
        data: { alexaDevice: { connect: { deviceId: ALEXA_TEST_DEVICE_ID } }, therapist: { connect: { id: julia } } },
      });
      const colleagues = await createAppointment("Carla Alves", TUESDAY_14H_IN_SAO_PAULO, { therapistId: julia });

      const response = await sendIntent("CancelAppointmentIntent", { slots: { time: "14:00", name: "Marcos" } }).expect(
        200,
      );

      expect(textOf(response)).toBe("Não há atendimento às 14h hoje.");
      expect(await statusOf(colleagues.id)).toBe("CONFIRMED");
    });
  });

  describe("ALX-05 RF-13: block with confirmation", () => {
    it("RF-13: asks before blocking a free period and blocks it after yes", async () => {
      const question = await sendIntent("BlockScheduleIntent", { slots: BLOCK_SLOTS }).expect(200);

      expect(textOf(question)).toBe("Bloquear das 15h às 16h. Confirma?");
      expect(await prisma.scheduleBlock.count()).toBe(0);

      const confirmed = await answer("BlockScheduleIntent", question, "CONFIRMED").expect(200);

      expect(textOf(confirmed)).toBe("Bloqueado.");
      const block = await prisma.scheduleBlock.findFirstOrThrow();
      expect(block).toMatchObject({
        therapistId: marcosId,
        createdById: marcosUserId,
        startsAt: new Date("2026-11-03T18:00:00Z"),
        endsAt: new Date("2026-11-03T19:00:00Z"),
      });
    });

    it("RN-13: creates nothing after no", async () => {
      const question = await sendIntent("BlockScheduleIntent", { slots: BLOCK_SLOTS });

      const denied = await answer("BlockScheduleIntent", question, "DENIED").expect(200);

      expect(textOf(denied)).toBe("Tudo bem, nada foi alterado.");
      expect(await prisma.scheduleBlock.count()).toBe(0);
    });

    it("D-04: refuses a period with active appointments, saying how many and the first", async () => {
      await createAppointment("Ana Souza", "2026-11-03T18:00:00Z");
      await createAppointment("Bruno Lima", "2026-11-03T18:30:00Z");

      const response = await sendIntent("BlockScheduleIntent", { slots: BLOCK_SLOTS }).expect(200);

      expect(textOf(response)).toBe(
        "Há 2 atendimentos nesse período, o primeiro às 15h. Cancele-os antes de bloquear.",
      );
      expect(await prisma.scheduleBlock.count()).toBe(0);
    });

    it("D-04: does not block when an appointment was booked in the period before the yes", async () => {
      const question = await sendIntent("BlockScheduleIntent", { slots: BLOCK_SLOTS });
      await createAppointment("Ana Souza", "2026-11-03T18:00:00Z");

      const confirmed = await answer("BlockScheduleIntent", question, "CONFIRMED").expect(200);

      expect(textOf(confirmed)).toBe("Há 1 atendimento nesse período, às 15h. Cancele-o antes de bloquear.");
      expect(await prisma.scheduleBlock.count()).toBe(0);
    });

    it.each([
      ["an end before the start", { startTime: "16:00", endTime: "15:00" }],
      ["a period outside the working hours", { startTime: "19:00", endTime: "20:00" }],
    ])("RF-13 RN-08: refuses %s saying how to speak", async (_, slots) => {
      const response = await sendIntent("BlockScheduleIntent", { slots }).expect(200);

      expect(textOf(response)).toBe(
        "O bloqueio precisa ser hoje, dentro do horário de funcionamento, com o fim depois do início. " +
          "Diga, por exemplo: bloquear das três às quatro da tarde.",
      );
      expect(await prisma.scheduleBlock.count()).toBe(0);
    });

    it('RF-13: refuses "de tarde" saying how to speak', async () => {
      const response = await sendIntent("BlockScheduleIntent", { slots: { startTime: "AF", endTime: "16:00" } });

      expect(textOf(response)).toBe("Diga o horário exato, por exemplo: bloquear das três às quatro da tarde.");
      expect(await prisma.scheduleBlock.count()).toBe(0);
    });
  });

  describe("ALX-06 RF-14: start and finish without confirmation", () => {
    it("RF-14: starts a possible no-show without check-in right away", async () => {
      const ana = await createAppointment("Ana Souza", "2026-11-03T15:55:00Z", { status: "POSSIBLE_NO_SHOW" });

      const response = await sendIntent("StartSessionIntent").expect(200);

      expect(textOf(response)).toBe("Sessão com Ana iniciada.");
      expect(response.body.response.directives).toBeUndefined();
      expect(await statusOf(ana.id)).toBe("IN_PROGRESS");
    });

    it("RF-14 ALX-07: finishes the session in progress and says who is next", async () => {
      const ana = await createAppointment("Ana Souza", "2026-11-03T15:55:00Z", { status: "IN_PROGRESS" });
      await createAppointment("Bruno Lima", "2026-11-03T18:00:00Z");

      const response = await sendIntent("FinishSessionIntent").expect(200);

      expect(textOf(response)).toBe("Sessão finalizada. Próximo: Bruno, às 15h.");
      expect(await statusOf(ana.id)).toBe("COMPLETED");
    });

    it("RF-14: explains when there is nothing to start", async () => {
      const response = await sendIntent("StartSessionIntent").expect(200);

      expect(textOf(response)).toBe("Não há atendimento para iniciar agora.");
    });

    it("RF-14: explains when there is nothing to finish", async () => {
      const response = await sendIntent("FinishSessionIntent").expect(200);

      expect(textOf(response)).toBe("Nenhuma sessão em andamento.");
    });
  });
});
