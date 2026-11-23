import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { AppointmentCancelledEvent, AppointmentEvents } from "../src/booking/appointment-events";
import { BookingService } from "../src/booking/booking.service";
import { FakeClock } from "../src/common/clock/fake-clock";
import { InMemoryNotificationChannel } from "../src/notifications/in-memory-notification-channel";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const FRIDAY_14_05_IN_SAO_PAULO = new Date("2026-10-23T17:05:00Z");
const IN_TEN_MINUTES = "2026-10-23T17:15:00Z";
const NEXT_MONDAY_AT_11 = "2026-10-26T14:00:00Z";
const SESSION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

type AppointmentInput = Readonly<{
  employeeName?: string;
  startsAt?: string;
  status?: AppointmentStatus;
  therapistId?: string;
}>;

describe("Therapist cancellation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;
  let channel: InMemoryNotificationChannel;
  let therapistUserId: string;
  let therapistId: string;
  let roomId: string;

  beforeAll(async () => {
    clock = new FakeClock(FRIDAY_14_05_IN_SAO_PAULO);
    channel = new InMemoryNotificationChannel();
    ({ app, prisma } = await createTestApp({ clock, notificationChannel: channel }));
  });

  beforeEach(async () => {
    clock.set(FRIDAY_14_05_IN_SAO_PAULO);
    channel.messages.length = 0;
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAppointment(input: AppointmentInput = {}) {
    const employeeName = input.employeeName ?? "Ana Souza";
    const startsAt = new Date(input.startsAt ?? IN_TEN_MINUTES);
    const employee = await prisma.user.create({
      data: {
        email: `${employeeName.replace(/\s+/g, ".").toLowerCase()}-${startsAt.getTime()}@example.com`,
        name: employeeName,
        role: "EMPLOYEE",
      },
    });
    return prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: input.therapistId ?? therapistId,
        roomId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + SESSION_MINUTES * MS_PER_MINUTE),
        status: input.status ?? "CONFIRMED",
      },
    });
  }

  const cancelAsTherapist = (appointmentId: string, userId = therapistUserId) =>
    request(app.getHttpServer())
      .post(`/api/therapists/me/appointments/${appointmentId}/cancel`)
      .set("x-user-id", userId);

  const statusOf = async (appointmentId: string) =>
    (await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status;

  it.each(["BOOKED", "CONFIRMED"] as AppointmentStatus[])(
    "D-05: cancels a %s appointment that starts in 10 minutes",
    async (status) => {
      const appointment = await createAppointment({ status });

      const response = await cancelAsTherapist(appointment.id).expect(201);

      expect(response.body).toEqual({ appointmentId: appointment.id, status: "CANCELLED", spokenText: "Cancelado." });
      await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
        expect.objectContaining({
          status: "CANCELLED",
          cancelledAt: FRIDAY_14_05_IN_SAO_PAULO,
          cancelledById: therapistUserId,
        }),
      );
    },
  );

  it("RN-13: emits the cancellation with the appointment's employee and audits the therapist as actor", async () => {
    const appointment = await createAppointment();
    const received: AppointmentCancelledEvent[] = [];
    app.get(AppointmentEvents).onCancelled((event) => {
      if (event.appointmentId === appointment.id) received.push(event);
    });

    await cancelAsTherapist(appointment.id).expect(201);

    expect(received).toEqual([
      {
        appointmentId: appointment.id,
        employeeId: appointment.employeeId,
        cancelledById: therapistUserId,
        cancelledByRole: "THERAPIST",
      },
    ]);
    await expect(
      prisma.auditEvent.findMany({ where: { entityId: appointment.id, action: "APPOINTMENT_CANCELLED" } }),
    ).resolves.toEqual([
      expect.objectContaining({
        actorId: therapistUserId,
        data: { status: "CANCELLED", employeeId: appointment.employeeId, cancelledByRole: "THERAPIST" },
      }),
    ]);
  });

  it("MSG-07: notifies the employee with the therapist's first name only", async () => {
    const appointment = await createAppointment();

    await cancelAsTherapist(appointment.id).expect(201);

    const cancellationNotice =
      "Seu atendimento de 23 de outubro, às 14h15, com Marcos, foi cancelado pelo massoterapeuta. " +
      "Você pode reservar outro horário na página inicial.";
    expect(channel.messages).toEqual([
      {
        recipientId: appointment.employeeId,
        appointmentId: appointment.id,
        kind: "APPOINTMENT_CANCELLED_BY_THERAPIST",
        message: cancellationNotice,
        spokenText: cancellationNotice,
        scheduledFor: FRIDAY_14_05_IN_SAO_PAULO,
      },
    ]);
  });

  it("RF-12: cancels the appointment's pending notices", async () => {
    const appointment = await createAppointment();
    const reminder = await prisma.notification.create({
      data: {
        appointmentId: appointment.id,
        recipientId: appointment.employeeId,
        kind: "REMINDER",
        scheduledFor: new Date("2026-10-23T17:10:00Z"),
      },
    });

    await cancelAsTherapist(appointment.id).expect(201);

    await expect(prisma.notification.findUniqueOrThrow({ where: { id: reminder.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CANCELLED" }),
    );
  });

  async function waitFor(appointment: { startsAt: Date; endsAt: Date }) {
    const waiting = await prisma.user.create({
      data: { email: "waiting@example.com", name: "Carla Dias", role: "EMPLOYEE" },
    });
    return prisma.waitlistEntry.create({
      data: {
        employeeId: waiting.id,
        therapistId,
        desiredStartsAt: appointment.startsAt,
        desiredEndsAt: appointment.endsAt,
      },
    });
  }

  const waitlistStatusOf = async (entryId: string) =>
    (await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entryId } })).status;

  it("RN-10: does not offer the slot to the waitlist when the therapist cancels", async () => {
    const appointment = await createAppointment();
    const entry = await waitFor(appointment);

    await cancelAsTherapist(appointment.id).expect(201);

    expect(await waitlistStatusOf(entry.id)).toBe("WAITING");
    await expect(prisma.notification.count({ where: { kind: "WAITLIST_VACANCY" } })).resolves.toBe(0);
  });

  it("RN-10: still offers the slot to the waitlist when the employee cancels", async () => {
    const appointment = await createAppointment({ startsAt: NEXT_MONDAY_AT_11 });
    const entry = await waitFor(appointment);

    await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", appointment.employeeId)
      .expect(200);

    expect(await waitlistStatusOf(entry.id)).toBe("NOTIFIED");
  });

  it("RN-10 RN-13: still offers the slot when HR cancels and audits HR as actor", async () => {
    const appointment = await createAppointment({ startsAt: NEXT_MONDAY_AT_11 });
    const entry = await waitFor(appointment);
    const hr = await prisma.user.create({ data: { email: "hr@example.com", name: "Rita Melo", role: "HR" } });

    await app.get(BookingService).cancel(appointment.id, hr.id, "HR");

    expect(await waitlistStatusOf(entry.id)).toBe("NOTIFIED");
    await expect(
      prisma.auditEvent.findFirst({ where: { entityId: appointment.id, action: "APPOINTMENT_CANCELLED" } }),
    ).resolves.toEqual(
      expect.objectContaining({
        actorId: hr.id,
        data: { status: "CANCELLED", employeeId: appointment.employeeId, cancelledByRole: "HR" },
      }),
    );
  });

  it("RN-01: the employee still cannot cancel the same appointment 10 minutes ahead", async () => {
    const appointment = await createAppointment();

    await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", appointment.employeeId)
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe("A antecedência mínima para cancelamento não foi respeitada."));
    expect(await statusOf(appointment.id)).toBe("CONFIRMED");
  });

  it.each(["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as AppointmentStatus[])(
    "RF-12 RF-32: refuses to cancel a %s appointment with a sentence and changes nothing",
    async (status) => {
      const appointment = await createAppointment({ status });

      const response = await cancelAsTherapist(appointment.id).expect(409);

      expect(response.body.message).toEqual(expect.any(String));
      expect(await statusOf(appointment.id)).toBe(status);
      expect(channel.messages).toEqual([]);
    },
  );

  it("RF-12 RF-32: when the employee and the therapist cancel at the same time, only one wins", async () => {
    const appointment = await createAppointment({ startsAt: NEXT_MONDAY_AT_11 });

    const responses = await Promise.all([
      cancelAsTherapist(appointment.id),
      request(app.getHttpServer())
        .delete(`/api/booking/appointments/${appointment.id}`)
        .set("x-user-id", appointment.employeeId),
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect([
      [200, 409],
      [201, 409],
    ]).toContainEqual(statuses);
    const refused = responses.find((response) => response.status === 409);
    expect(refused?.body.message).toEqual(expect.any(String));
    await expect(
      prisma.auditEvent.count({ where: { entityId: appointment.id, action: "APPOINTMENT_CANCELLED" } }),
    ).resolves.toBe(1);
  });

  it("TK-06.06: the legacy cancel route no longer exists", async () => {
    const appointment = await createAppointment();

    await request(app.getHttpServer())
      .delete(`/api/therapist/appointments/${appointment.id}`)
      .set("x-user-id", therapistUserId)
      .expect(404);
    expect(await statusOf(appointment.id)).toBe("CONFIRMED");
  });

  it("RN-13: answers 404 like a missing appointment for another therapist's appointment", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other.therapist@example.com", name: "Paula Reis", role: "THERAPIST" },
    });
    const otherTherapist = await prisma.therapist.create({ data: { userId: otherUser.id } });
    const appointment = await createAppointment({ therapistId: otherTherapist.id });

    const foreign = await cancelAsTherapist(appointment.id).expect(404);
    const missing = await cancelAsTherapist("6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b").expect(404);

    expect(foreign.body).toEqual(missing.body);
    expect(await statusOf(appointment.id)).toBe("CONFIRMED");
  });
});
