import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { AppointmentEvents, AppointmentNoShowEvent } from "../src/booking/appointment-events";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const FRIDAY_14_05_IN_SAO_PAULO = new Date("2026-10-23T17:05:00Z");
const MISSING_APPOINTMENT_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const SESSION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

type AppointmentInput = Readonly<{
  employeeName: string;
  startsAt: string;
  status?: AppointmentStatus;
  therapistId?: string;
}>;

describe("Therapist actions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;
  let therapistUserId: string;
  let therapistId: string;
  let roomId: string;

  beforeAll(async () => {
    clock = new FakeClock(FRIDAY_14_05_IN_SAO_PAULO);
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(FRIDAY_14_05_IN_SAO_PAULO);
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

  async function createAppointment(input: AppointmentInput) {
    const employee = await prisma.user.create({
      data: {
        email: `${input.employeeName.replace(/\s+/g, ".").toLowerCase()}-${input.startsAt}@example.com`,
        name: input.employeeName,
        role: "EMPLOYEE",
      },
    });
    const startsAt = new Date(input.startsAt);
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

  const post = (path: string, userId = therapistUserId) =>
    request(app.getHttpServer()).post(`/api/therapists/me/${path}`).set("x-user-id", userId);

  it("RF-14 RF-32: starts a CONFIRMED appointment without check-in by ID", async () => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });

    const response = await post(`appointments/${appointment.id}/start`).expect(201);

    expect(response.body).toEqual({
      appointmentId: appointment.id,
      status: "IN_PROGRESS",
      spokenText: "Sessão com Ana iniciada.",
    });
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "IN_PROGRESS", sessionStartedAt: FRIDAY_14_05_IN_SAO_PAULO }),
    );
  });

  it.each([
    ["one minute before check-in opens", "2026-10-23T17:14:00Z", messages.errors.sessionNotOpenYet],
    ["at the end of the appointment", "2026-10-23T17:50:00Z", messages.errors.sessionTimeOver],
  ])("RN-09: refuses to start %s", async (_case, now, message) => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:30:00Z" });
    clock.set(new Date(now));

    const response = await post(`appointments/${appointment.id}/start`).expect(409);

    expect(response.body.message).toBe(message);
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CONFIRMED", sessionStartedAt: null }),
    );
  });

  it.each([
    ["when check-in opens", "2026-10-23T17:15:00Z"],
    ["one minute before the end", "2026-10-23T17:49:00Z"],
  ])("RN-09: starts %s", async (_case, now) => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:30:00Z" });
    clock.set(new Date(now));

    await post(`appointments/${appointment.id}/start`).expect(201);
  });

  it.each<AppointmentStatus>(["CHECKED_IN", "POSSIBLE_NO_SHOW"])(
    "RF-14: starts an appointment in %s",
    async (status) => {
      const appointment = await createAppointment({
        employeeName: "Ana Souza",
        startsAt: "2026-10-23T17:00:00Z",
        status,
      });

      const response = await post(`appointments/${appointment.id}/start`).expect(201);

      expect(response.body.status).toBe("IN_PROGRESS");
    },
  );

  it("RN-12: refuses to start while another session is in progress and names who is in it", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T16:40:00Z", status: "IN_PROGRESS" });
    const appointment = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:00:00Z" });

    const response = await post(`appointments/${appointment.id}/start`).expect(409);

    expect(response.body.message).toBe("Finalize a sessão com Ana antes de iniciar outra.");
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CONFIRMED" }),
    );
  });

  it("RF-14: starts, without ID, the eligible appointment whose start is closest to now", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T16:50:00Z" });
    const closest = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:10:00Z" });

    const response = await post("sessions/current/start").expect(201);

    expect(response.body).toEqual({
      appointmentId: closest.id,
      status: "IN_PROGRESS",
      spokenText: "Sessão com Bruno iniciada.",
    });
  });

  it("RF-14: on a tie, starts the earlier appointment", async () => {
    const earlier = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T16:55:00Z" });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:15:00Z" });

    const response = await post("sessions/current/start").expect(201);

    expect(response.body.appointmentId).toBe(earlier.id);
  });

  it("RF-14: answers that there is nothing to start when no appointment is inside its start window", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T18:00:00Z" });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T16:00:00Z" });
    await createAppointment({ employeeName: "Carla Rocha", startsAt: "2026-10-23T17:00:00Z", status: "BOOKED" });

    const response = await post("sessions/current/start").expect(404);

    expect(response.body.message).toBe("Não há atendimento para iniciar agora.");
  });

  it("RNF-05: starts, without ID, the appointment of 23h40 at 23h30 in São Paulo, already the next day in UTC", async () => {
    clock.set(new Date("2026-10-24T02:30:00Z"));
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T23:00:00Z" });
    const lateNight = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-24T02:40:00Z" });

    const response = await post("sessions/current/start").expect(201);

    expect(response.body.appointmentId).toBe(lateNight.id);
  });

  it("RN-12: refuses to start without ID while another session is in progress", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T16:40:00Z", status: "IN_PROGRESS" });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:00:00Z" });

    const response = await post("sessions/current/start").expect(409);

    expect(response.body.message).toBe("Finalize a sessão com Ana antes de iniciar outra.");
  });

  it("RF-14 RF-32: finishes the session in progress without ID and speaks the next one", async () => {
    const session = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "IN_PROGRESS",
    });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T18:00:00Z" });

    const response = await post("sessions/current/finish").expect(201);

    expect(response.body).toEqual({
      appointmentId: session.id,
      status: "COMPLETED",
      spokenText: "Sessão finalizada. Próximo: Bruno, às 15h.",
    });
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: session.id } })).resolves.toEqual(
      expect.objectContaining({ status: "COMPLETED", sessionEndedAt: FRIDAY_14_05_IN_SAO_PAULO }),
    );
  });

  it("RF-14: finishes a session by ID and says only that it finished when nothing comes next", async () => {
    const session = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "IN_PROGRESS",
    });

    const response = await post(`appointments/${session.id}/finish`).expect(201);

    expect(response.body).toEqual({ appointmentId: session.id, status: "COMPLETED", spokenText: "Sessão finalizada." });
  });

  it("RF-14: answers that no session is in progress when finishing without ID", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });

    const response = await post("sessions/current/finish").expect(404);

    expect(response.body.message).toBe("Nenhuma sessão em andamento.");
  });

  it.each(["start", "finish"])(
    "RN-13: answers %s on another therapist's appointment as if it did not exist",
    async (action) => {
      const colleagueUser = await prisma.user.create({
        data: { email: "colleague@example.com", name: "Paula Dias", role: "THERAPIST" },
      });
      const colleague = await prisma.therapist.create({ data: { userId: colleagueUser.id } });
      const theirs = await createAppointment({
        employeeName: "Ana Souza",
        startsAt: "2026-10-23T17:00:00Z",
        status: action === "start" ? "CONFIRMED" : "IN_PROGRESS",
        therapistId: colleague.id,
      });

      const response = await post(`appointments/${theirs.id}/${action}`).expect(404);
      const missing = await post(`appointments/${MISSING_APPOINTMENT_ID}/${action}`).expect(404);

      expect(response.body).toEqual(missing.body);
      expect(response.body.message).toBe(messages.errors.appointmentNotFound);
      await expect(prisma.appointment.findUniqueOrThrow({ where: { id: theirs.id } })).resolves.toEqual(
        expect.objectContaining({ status: theirs.status }),
      );
    },
  );

  it("RN-13: lets only one of two simultaneous starts of the same appointment win", async () => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });

    const responses = await Promise.all([
      post(`appointments/${appointment.id}/start`),
      post(`appointments/${appointment.id}/start`),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const loser = responses.find((response) => response.status === 409);
    expect(loser?.body.message).toBe(messages.errors.invalidStatusTransition);
    await expect(prisma.auditEvent.count({ where: { action: "SESSION_STARTED" } })).resolves.toBe(1);
  });

  it("RN-12: lets only one of two simultaneous starts of different appointments win", async () => {
    const ana = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T16:50:00Z" });
    const bruno = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:10:00Z" });

    const responses = await Promise.all([post(`appointments/${ana.id}/start`), post(`appointments/${bruno.id}/start`)]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    await expect(prisma.appointment.count({ where: { status: "IN_PROGRESS" } })).resolves.toBe(1);
  });

  it("RF-32: records who started and who finished the session", async () => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });

    await post(`appointments/${appointment.id}/start`).expect(201);
    await post("sessions/current/finish").expect(201);

    const events = await prisma.auditEvent.findMany({
      where: { entityId: appointment.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toEqual([
      expect.objectContaining({ action: "SESSION_STARTED", actorId: therapistUserId, entityType: "Appointment" }),
      expect.objectContaining({ action: "SESSION_FINISHED", actorId: therapistUserId, entityType: "Appointment" }),
    ]);
  });

  it("RF-33: marks a possible no-show as absent and speaks the next one", async () => {
    const absent = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "POSSIBLE_NO_SHOW",
    });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T18:00:00Z" });

    const response = await post(`appointments/${absent.id}/no-show`).expect(201);

    expect(response.body).toEqual({
      appointmentId: absent.id,
      status: "NO_SHOW",
      spokenText: "Ausência registrada. Próximo: Bruno, às 15h.",
    });
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: absent.id } })).resolves.toEqual(
      expect.objectContaining({ status: "NO_SHOW" }),
    );
  });

  it("RN-02: refuses to mark as absent an appointment still within the late tolerance", async () => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });

    const response = await post(`appointments/${appointment.id}/no-show`).expect(409);

    expect(response.body.message).toBe("Ainda está dentro da tolerância de atraso.");
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CONFIRMED" }),
    );
  });

  it.each<AppointmentStatus>(["BOOKED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"])(
    "RF-33: refuses to mark as absent an appointment in %s",
    async (status) => {
      const appointment = await createAppointment({
        employeeName: "Ana Souza",
        startsAt: "2026-10-23T16:50:00Z",
        status,
      });

      const response = await post(`appointments/${appointment.id}/no-show`).expect(409);

      expect(response.body.message).toBe(messages.errors.invalidStatusTransition);
      await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
        expect.objectContaining({ status }),
      );
    },
  );

  it("RN-13: answers no-show on another therapist's appointment as if it did not exist", async () => {
    const colleagueUser = await prisma.user.create({
      data: { email: "colleague@example.com", name: "Paula Dias", role: "THERAPIST" },
    });
    const colleague = await prisma.therapist.create({ data: { userId: colleagueUser.id } });
    const theirs = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "POSSIBLE_NO_SHOW",
      therapistId: colleague.id,
    });

    const response = await post(`appointments/${theirs.id}/no-show`).expect(404);
    const missing = await post(`appointments/${MISSING_APPOINTMENT_ID}/no-show`).expect(404);

    expect(response.body).toEqual(missing.body);
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: theirs.id } })).resolves.toEqual(
      expect.objectContaining({ status: "POSSIBLE_NO_SHOW" }),
    );
  });

  it("RF-33: records who marked the no-show and cancels the pending notices of the appointment", async () => {
    const appointment = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "POSSIBLE_NO_SHOW",
    });
    const notice = await prisma.notification.create({
      data: {
        recipientId: appointment.employeeId,
        appointmentId: appointment.id,
        kind: "REMINDER",
        scheduledFor: new Date("2026-10-23T17:30:00Z"),
      },
    });

    await post(`appointments/${appointment.id}/no-show`).expect(201);

    await expect(prisma.auditEvent.findMany({ where: { entityId: appointment.id } })).resolves.toEqual([
      expect.objectContaining({
        action: "APPOINTMENT_MARKED_NO_SHOW",
        actorId: therapistUserId,
        entityType: "Appointment",
      }),
    ]);
    await expect(prisma.notification.findUniqueOrThrow({ where: { id: notice.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CANCELLED" }),
    );
    const hr = await prisma.user.create({ data: { email: "hr@example.com", name: "Rita Alves", role: "HR" } });
    const audit = await request(app.getHttpServer()).get("/api/audit-events").set("x-user-id", hr.id).expect(200);
    expect(audit.body.items).toEqual([
      expect.objectContaining({
        action: "APPOINTMENT_MARKED_NO_SHOW",
        spokenText: expect.stringMatching(/^Ausência registrada pelo massoterapeuta, registrado em /),
      }),
    ]);
  });

  it("RN-13: lets only one of a simultaneous start and no-show of the same appointment win", async () => {
    const appointment = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "POSSIBLE_NO_SHOW",
    });

    const responses = await Promise.all([
      post(`appointments/${appointment.id}/start`),
      post(`appointments/${appointment.id}/no-show`),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const { status } = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    const winner = responses.find((response) => response.status === 201);
    expect(winner?.body.status).toBe(status);
  });

  it("RF-33: tells no-show listeners which appointment was marked, whose it is and who marked it", async () => {
    const appointment = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "POSSIBLE_NO_SHOW",
    });
    const received: AppointmentNoShowEvent[] = [];
    app.get(AppointmentEvents).onNoShow((event) => {
      received.push(event);
    });

    await post(`appointments/${appointment.id}/no-show`).expect(201);

    expect(received).toEqual([{ appointmentId: appointment.id, therapistId, markedById: therapistUserId }]);
  });

  it("RF-33: shows the marked appointment as absent in the agenda without counting it as remaining", async () => {
    const appointment = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T17:00:00Z",
      status: "POSSIBLE_NO_SHOW",
    });

    await post(`appointments/${appointment.id}/no-show`).expect(201);

    const agenda = await request(app.getHttpServer())
      .get("/api/therapists/me/agenda")
      .set("x-user-id", therapistUserId)
      .expect(200);
    expect(agenda.body.remainingCount).toBe(0);
    expect(agenda.body.items).toEqual([
      expect.objectContaining({ id: appointment.id, status: "NO_SHOW", spokenStatus: "ausente", actions: [] }),
    ]);
  });

  it.each(["start", "finish"])("TK-06.03: the legacy %s route no longer exists", async (action) => {
    const appointment = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });

    await request(app.getHttpServer())
      .post(`/api/therapist/appointments/${appointment.id}/${action}`)
      .set("x-user-id", therapistUserId)
      .expect(404);
  });
});
