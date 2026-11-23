import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AttendanceToleranceJob } from "../src/attendance/jobs/attendance-tolerance.job";
import { FakeClock } from "../src/common/clock/fake-clock";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../src/notifications/notification-channel";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const FRIDAY_14_25_IN_SAO_PAULO = new Date("2026-10-23T17:25:00.000Z");
const FRIDAY_14_30_IN_SAO_PAULO = new Date("2026-10-23T17:30:00.000Z");
const FRIDAY_14_41_IN_SAO_PAULO = new Date("2026-10-23T17:41:00.000Z");

describe("Notifications (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channel: NotificationChannel;
  let clock: FakeClock;

  beforeAll(async () => {
    clock = new FakeClock(FRIDAY_14_25_IN_SAO_PAULO);
    ({ app, prisma } = await createTestApp({ clock }));
    channel = app.get(NOTIFICATION_CHANNEL);
  });

  beforeEach(async () => {
    clock.set(FRIDAY_14_25_IN_SAO_PAULO);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-05.01 RF-31 RNF-01: persists one accessible notification for duplicate logical deliveries", async () => {
    const employee = await prisma.user.create({
      data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" },
    });
    const therapistUser = await prisma.user.create({
      data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    const appointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T14:00:00.000Z"),
        endsAt: new Date("2026-10-21T14:20:00.000Z"),
        status: "CHECKED_IN",
      },
    });

    const message = {
      recipientId: therapistUser.id,
      appointmentId: appointment.id,
      kind: "CHECK_IN_CONFIRMATION" as const,
      message: "Check-in confirmado para hoje, às 11h, na Sala 1.",
      spokenText: "Check-in confirmado para hoje, às 11h, na Sala 1.",
      scheduledFor: new Date("2026-10-21T13:55:00.000Z"),
    };
    await channel.notify(message);
    await channel.notify(message);

    await expect(prisma.notification.findMany({ where: { appointmentId: appointment.id } })).resolves.toEqual([
      expect.objectContaining({
        recipientId: therapistUser.id,
        appointmentId: appointment.id,
        kind: "CHECK_IN_CONFIRMATION",
        status: "PENDING",
        message: message.message,
        spokenText: message.spokenText,
      }),
    ]);
  });

  it("TK-05.01 RF-31 RNF-01: lists only the therapist notifications in chronological order", async () => {
    const firstTherapist = await prisma.user.create({
      data: { email: "first@example.com", name: "First Therapist", role: "THERAPIST" },
    });
    const secondTherapist = await prisma.user.create({
      data: { email: "second@example.com", name: "Second Therapist", role: "THERAPIST" },
    });
    const employee = await prisma.user.create({
      data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" },
    });
    const firstProfile = await prisma.therapist.create({ data: { userId: firstTherapist.id } });
    const secondProfile = await prisma.therapist.create({ data: { userId: secondTherapist.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    const firstAppointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: firstProfile.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T15:00:00Z"),
        endsAt: new Date("2026-10-21T15:20:00Z"),
        status: "CONFIRMED",
      },
    });
    const secondAppointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: secondProfile.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T14:00:00Z"),
        endsAt: new Date("2026-10-21T14:20:00Z"),
        status: "CONFIRMED",
      },
    });
    await channel.notify({
      recipientId: firstTherapist.id,
      appointmentId: firstAppointment.id,
      kind: "CHECK_IN_CONFIRMATION",
      message: "Mais tarde",
      spokenText: "Mais tarde",
      scheduledFor: new Date("2026-10-21T15:00:00Z"),
    });
    await channel.notify({
      recipientId: firstTherapist.id,
      appointmentId: secondAppointment.id,
      kind: "CHECK_IN_CONFIRMATION",
      message: "Mais cedo",
      spokenText: "Mais cedo",
      scheduledFor: new Date("2026-10-21T14:00:00Z"),
    });
    await channel.notify({
      recipientId: secondTherapist.id,
      appointmentId: firstAppointment.id,
      kind: "CHECK_IN_CONFIRMATION",
      message: "Other",
      spokenText: "Other",
      scheduledFor: new Date("2026-10-21T13:00:00Z"),
    });

    const response = await request(app.getHttpServer())
      .get("/api/notifications")
      .set("x-user-id", firstTherapist.id)
      .expect(200);

    expect(response.body.items.map(({ appointmentId }: { appointmentId: string }) => appointmentId)).toEqual([
      secondAppointment.id,
      firstAppointment.id,
    ]);
    expect(response.body.items.every(({ spokenText }: { spokenText: string }) => spokenText.length > 0)).toBe(true);
    expect(response.body.spokenText).toContain("2 avisos");
  });

  describe("therapist feed", () => {
    const createTherapistUser = (email: string) =>
      prisma.user.create({ data: { email, name: "Ana Souza", role: "THERAPIST" } });

    const notifyAt = (recipientId: string, scheduledFor: string, spokenText: string) =>
      channel.notify({
        recipientId,
        kind: "EMPLOYEE_CHECKED_IN",
        message: spokenText,
        spokenText,
        scheduledFor: new Date(scheduledFor),
      });

    const feedOf = (userId: string, query: Record<string, string> = {}) =>
      request(app.getHttpServer()).get("/api/notifications").query(query).set("x-user-id", userId);

    it("TK-06.04 RF-31 RNF-01: returns only the notifications after the given instant, in chronological order", async () => {
      const therapist = await createTherapistUser("therapist@example.com");
      await notifyAt(therapist.id, "2026-10-23T17:05:00.000Z", "Depois, mais tarde.");
      await notifyAt(therapist.id, "2026-10-23T16:55:00.000Z", "Antes.");
      await notifyAt(therapist.id, "2026-10-23T17:00:00.000Z", "No instante.");
      await notifyAt(therapist.id, "2026-10-23T17:01:00.000Z", "Depois.");

      const response = await feedOf(therapist.id, { since: "2026-10-23T17:00:00.000Z" }).expect(200);

      expect(response.body.items.map(({ spokenText }: { spokenText: string }) => spokenText)).toEqual([
        "Depois.",
        "Depois, mais tarde.",
      ]);
    });

    it.each(["ontem", "2026-10-23", "2026-10-23T17:00:00"])(
      "TK-06.04 RNF-01 RNF-05: refuses the instant %s, which is not a complete date and time with offset",
      async (since) => {
        const therapist = await createTherapistUser("therapist@example.com");

        const response = await feedOf(therapist.id, { since }).expect(400);

        expect(response.body.message).toEqual(["O instante dos avisos é inválido: informe a data e a hora completas."]);
      },
    );

    const markAsRead = (userId: string, notificationId: string) =>
      request(app.getHttpServer()).post(`/api/notifications/${notificationId}/read`).set("x-user-id", userId);

    it("TK-06.04 RF-31 RNF-01: keeps a notification marked as read so the screen does not read it again", async () => {
      const therapist = await createTherapistUser("therapist@example.com");
      await notifyAt(therapist.id, "2026-10-23T17:00:00.000Z", "Lido.");
      await notifyAt(therapist.id, "2026-10-23T17:01:00.000Z", "Não lido.");
      const [read] = (await feedOf(therapist.id).expect(200)).body.items;

      const marked = await markAsRead(therapist.id, read.id).expect(200);
      clock.advanceMinutes(5);
      await markAsRead(therapist.id, read.id).expect(200);

      expect(marked.body).toEqual({
        id: read.id,
        readAt: FRIDAY_14_25_IN_SAO_PAULO.toISOString(),
        spokenText: "Aviso marcado como lido.",
      });
      const response = await feedOf(therapist.id).expect(200);
      expect(response.body.items).toEqual([
        expect.objectContaining({ spokenText: "Lido.", readAt: FRIDAY_14_25_IN_SAO_PAULO.toISOString() }),
        expect.objectContaining({ spokenText: "Não lido.", readAt: null }),
      ]);
    });

    it("TK-06.04 RF-31 RN-13: answers as missing when marking another user's notification as read", async () => {
      const owner = await createTherapistUser("owner@example.com");
      const intruder = await createTherapistUser("intruder@example.com");
      await notifyAt(owner.id, "2026-10-23T17:00:00.000Z", "Do outro.");
      const [notification] = (await feedOf(owner.id).expect(200)).body.items;

      const response = await markAsRead(intruder.id, notification.id).expect(404);

      expect(response.body.message).toBe("Aviso não encontrado.");
      expect((await feedOf(intruder.id).expect(200)).body.items).toEqual([]);
      expect((await feedOf(owner.id).expect(200)).body.items).toEqual([
        expect.objectContaining({ id: notification.id, readAt: null }),
      ]);
    });

    const sentencesOf = (text: string) => text.match(/[^.?!]+[.?!]/g) ?? [];

    async function createAppointmentAt14h30() {
      const [employee, therapistUser] = await Promise.all([
        prisma.user.create({
          data: { email: "employee@example.com", name: "Carlos Eduardo Lima", role: "EMPLOYEE" },
        }),
        createTherapistUser("therapist@example.com"),
      ]);
      const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
      const room = await prisma.room.create({
        data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
      });
      await prisma.appointment.create({
        data: {
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: room.id,
          startsAt: FRIDAY_14_30_IN_SAO_PAULO,
          endsAt: new Date("2026-10-23T17:50:00.000Z"),
          status: "CONFIRMED",
        },
      });
      return { employee, therapistUser };
    }

    const expectReadableByScreenReader = (text: string) => {
      expect(sentencesOf(text).length).toBeLessThanOrEqual(2);
      expect(text).not.toMatch(/Eduardo|Lima|@|\d{4}-\d{2}|\d:\d|h:|T\d{2}|UTC|[0-9a-f]{8}-/);
    };

    it("TK-06.04 RF-31 RNF-01 RNF-04: says an arrival in at most two sentences with only the employee first name", async () => {
      const { employee, therapistUser } = await createAppointmentAt14h30();
      await request(app.getHttpServer())
        .post("/api/booking/check-in/token-1")
        .set("x-user-id", employee.id)
        .expect(200);

      const response = await feedOf(therapistUser.id).expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          kind: "EMPLOYEE_CHECKED_IN",
          spokenText: "Carlos chegou para o atendimento de hoje, às 14h30, na Sala 1.",
        }),
      ]);
      expectReadableByScreenReader(response.body.items[0].spokenText);
    });

    it("TK-06.04 RF-31 RNF-01 RNF-04: says a possible no-show in at most two sentences with only the employee first name", async () => {
      const { therapistUser } = await createAppointmentAt14h30();
      clock.set(FRIDAY_14_41_IN_SAO_PAULO);
      await app.get(AttendanceToleranceJob).run();

      const response = await feedOf(therapistUser.id).expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          kind: "POSSIBLE_NO_SHOW",
          spokenText: "Carlos ainda não fez check-in para o atendimento de hoje, às 14h30, na Sala 1.",
        }),
      ]);
      expectReadableByScreenReader(response.body.items[0].spokenText);
    });

    it("TK-06.06 RF-12 RNF-04: tells the employee in the feed that the therapist cancelled, with only the therapist first name", async () => {
      const { employee, therapistUser } = await createAppointmentAt14h30();
      const appointment = await prisma.appointment.findFirstOrThrow({ where: { employeeId: employee.id } });
      await request(app.getHttpServer())
        .post(`/api/therapists/me/appointments/${appointment.id}/cancel`)
        .set("x-user-id", therapistUser.id)
        .expect(201);

      const response = await feedOf(employee.id).expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          appointmentId: appointment.id,
          kind: "APPOINTMENT_CANCELLED_BY_THERAPIST",
          status: "PENDING",
          spokenText:
            "Seu atendimento de 23 de outubro, às 14h30, com Ana, foi cancelado pelo massoterapeuta. " +
            "Você pode reservar outro horário na página inicial.",
        }),
      ]);
      expect(response.body.items[0].spokenText).not.toMatch(/Souza/);
    });
  });
});
