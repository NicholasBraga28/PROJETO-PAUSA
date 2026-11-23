import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const WORK_DAY = "2026-10-26";
const MONDAY_10_00_IN_SAO_PAULO = new Date(`${WORK_DAY}T10:00:00.000-03:00`);
const SESSION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

const local = (time: string, date = WORK_DAY): Date => new Date(`${date}T${time}:00.000-03:00`);

describe("Schedule blocks by HR (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;
  let hrId: string;
  let employeeId: string;
  let therapistId: string;
  let roomId: string;

  beforeAll(async () => {
    clock = new FakeClock(MONDAY_10_00_IN_SAO_PAULO);
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(MONDAY_10_00_IN_SAO_PAULO);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    const [hr, employee, therapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "hr@example.com", name: "Helena RH", role: "HR" } }),
      prisma.user.create({ data: { email: "employee@example.com", name: "Eduardo Colaborador", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Tereza Therapist", role: "THERAPIST" } }),
    ]);
    const [therapist, room] = await Promise.all([
      prisma.therapist.create({ data: { userId: therapistUser.id } }),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala A", checkInToken: "token-a" } }),
    ]);
    hrId = hr.id;
    employeeId = employee.id;
    therapistId = therapist.id;
    roomId = room.id;
    await prisma.scheduleSlot.create({
      data: { therapistId, roomId, startsAt: local("13:00"), endsAt: local("18:00") },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const block = (startsAt: Date, endsAt: Date, extra: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post("/api/schedule-blocks")
      .set("x-user-id", hrId)
      .send({ therapistId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), ...extra });

  const book = (startsAt: string, status: AppointmentStatus = "CONFIRMED") =>
    prisma.appointment.create({
      data: {
        employeeId,
        therapistId,
        roomId,
        startsAt: local(startsAt),
        endsAt: new Date(local(startsAt).getTime() + SESSION_MINUTES * MS_PER_MINUTE),
        status,
      },
    });

  const availableStarts = async (): Promise<string[]> => {
    const response = await request(app.getHttpServer())
      .get("/api/booking/availability")
      .query({ from: local("13:00").toISOString(), to: local("18:00").toISOString(), durationMinutes: 20 })
      .set("x-user-id", employeeId)
      .expect(200);
    return response.body.slots.map((slot: { startsAt: string }) => slot.startsAt);
  };

  it("TK-03.06 RF-23: creates a block on a free period, audits HR as the actor and hides it from availability", async () => {
    const response = await block(local("15:00"), local("16:00"), { reason: "Reunião de alinhamento" }).expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      therapistId,
      startsAt: local("15:00").toISOString(),
      endsAt: local("16:00").toISOString(),
      reason: "Reunião de alinhamento",
      createdById: hrId,
      createdAt: expect.any(String),
    });
    const audit = await prisma.auditEvent.findMany({ where: { entityId: response.body.id } });
    expect(audit).toEqual([
      expect.objectContaining({ actorId: hrId, action: "SCHEDULE_BLOCK_CREATED", entityType: "ScheduleBlock" }),
    ]);
    const starts = await availableStarts();
    expect(starts).toContain(local("14:40").toISOString());
    expect(starts).not.toContain(local("15:00").toISOString());
    expect(starts).not.toContain(local("15:40").toISOString());
    expect(starts).toContain(local("16:00").toISOString());
  });

  it("TK-03.06 D-04: refuses a period with active appointments, lists them in order and records nothing", async () => {
    const employee = { id: employeeId, name: "Eduardo Colaborador" };
    const later = await book("15:40");
    const earlier = await book("15:20");
    await book("15:00", "CANCELLED");

    const response = await block(local("15:00"), local("16:00")).expect(409);

    const spokenText = "Há 2 atendimentos nesse período, o primeiro às 15h20. Cancele-os antes de bloquear.";
    expect(response.body).toEqual({
      statusCode: 409,
      error: "Conflict",
      message: spokenText,
      spokenText,
      appointments: [
        { id: earlier.id, startsAt: local("15:20").toISOString(), endsAt: local("15:40").toISOString(), employee },
        { id: later.id, startsAt: local("15:40").toISOString(), endsAt: local("16:00").toISOString(), employee },
      ],
    });
    expect(await prisma.scheduleBlock.count()).toBe(0);
    expect(await prisma.auditEvent.count({ where: { action: "SCHEDULE_BLOCK_CREATED" } })).toBe(0);
  });

  it("TK-03.06 D-04: speaks a single conflicting appointment in the singular", async () => {
    await book("15:20");

    const response = await block(local("15:00"), local("16:00")).expect(409);

    expect(response.body.spokenText).toBe("Há 1 atendimento nesse período, às 15h20. Cancele-o antes de bloquear.");
  });

  it("TK-03.06 RF-23: refuses a period overlapping another block of the same therapist", async () => {
    await block(local("15:00"), local("16:00")).expect(201);

    const response = await block(local("15:30"), local("16:30")).expect(409);

    expect(response.body.message).toBe("Esse período já está bloqueado.");
    expect(await prisma.scheduleBlock.count()).toBe(1);
  });

  it.each([
    ["ends before it starts", local("16:00"), local("15:00"), messages.errors.invalidPeriod],
    ["starts in the past", local("09:30"), local("10:30"), messages.errors.scheduleBlockInPast],
    ["spans two days", local("17:00"), local("09:30", "2026-10-27"), messages.errors.scheduleBlockSpansDays],
    ["ends after closing time", local("17:00"), local("18:30"), messages.errors.scheduleBlockOutsideOperatingHours],
    [
      "falls on a Saturday",
      local("10:00", "2026-10-31"),
      local("11:00", "2026-10-31"),
      messages.errors.scheduleBlockOutsideOperatingHours,
    ],
  ])("TK-03.06 RN-08: refuses a period that %s, saying what to fix", async (_case, startsAt, endsAt, message) => {
    const response = await block(startsAt, endsAt).expect(400);

    expect(response.body.message).toBe(message);
    expect(await prisma.scheduleBlock.count()).toBe(0);
  });

  it("TK-03.06 RN-08: accepts a period covering lunch and outside any schedule period", async () => {
    await block(local("11:00"), local("14:00")).expect(201);
  });

  it("TK-03.06: answers 404 for a missing therapist and 400 for an inactive one", async () => {
    const missing = await block(local("15:00"), local("16:00"), {
      therapistId: "5d2c8e41-9b7a-4f36-8c1d-2e5f7a9b0c3d",
    }).expect(404);
    expect(missing.body.message).toBe(messages.errors.therapistNotFound);

    await prisma.user.updateMany({ where: { role: "THERAPIST" }, data: { status: "INACTIVE" } });
    const inactive = await block(local("15:00"), local("16:00")).expect(400);
    expect(inactive.body.message).toBe(messages.errors.therapistInactive);
  });

  it("TK-03.06: two simultaneous identical blocks create only one", async () => {
    const responses = await Promise.all([block(local("15:00"), local("16:00")), block(local("15:00"), local("16:00"))]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.scheduleBlock.count()).toBe(1);
  });

  it("TK-03.06: the legacy HR block route no longer exists", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/blocks")
      .set("x-user-id", hrId)
      .send({ therapistId, startsAt: local("15:00").toISOString(), endsAt: local("16:00").toISOString() })
      .expect(404);
    expect(await prisma.scheduleBlock.count()).toBe(0);
  });
});
