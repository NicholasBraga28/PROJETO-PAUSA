import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const TODAY = "2026-10-26";
const TOMORROW = "2026-10-27";
const MONDAY_10_00_IN_SAO_PAULO = new Date(`${TODAY}T10:00:00.000-03:00`);
const SESSION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

const local = (time: string, date = TODAY): Date => new Date(`${date}T${time}:00.000-03:00`);

describe("Therapist schedule blocks (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;
  let therapistUserId: string;
  let therapistId: string;
  let otherTherapistId: string;
  let employee: { id: string; name: string };
  let roomId: string;

  beforeAll(async () => {
    clock = new FakeClock(MONDAY_10_00_IN_SAO_PAULO);
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(MONDAY_10_00_IN_SAO_PAULO);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    const [therapistUser, otherTherapistUser, employeeUser] = await Promise.all([
      prisma.user.create({ data: { email: "therapist@example.com", name: "Marcos Pereira", role: "THERAPIST" } }),
      prisma.user.create({ data: { email: "other.therapist@example.com", name: "Paula Reis", role: "THERAPIST" } }),
      prisma.user.create({ data: { email: "employee@example.com", name: "Ana Souza", role: "EMPLOYEE" } }),
    ]);
    const [therapist, otherTherapist, room] = await Promise.all([
      prisma.therapist.create({ data: { userId: therapistUser.id } }),
      prisma.therapist.create({ data: { userId: otherTherapistUser.id } }),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-sala-1" } }),
    ]);
    therapistUserId = therapistUser.id;
    therapistId = therapist.id;
    otherTherapistId = otherTherapist.id;
    employee = { id: employeeUser.id, name: employeeUser.name };
    roomId = room.id;
    await prisma.scheduleSlot.create({
      data: { therapistId, roomId, startsAt: local("13:00"), endsAt: local("18:00") },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const periodOf = (startsAt: Date, endsAt: Date) => ({
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  const preview = (startsAt: Date, endsAt: Date) =>
    request(app.getHttpServer())
      .post("/api/therapists/me/schedule-blocks/preview")
      .set("x-user-id", therapistUserId)
      .send(periodOf(startsAt, endsAt));

  const block = (startsAt: Date, endsAt: Date, extra: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post("/api/therapists/me/schedule-blocks")
      .set("x-user-id", therapistUserId)
      .send({ ...periodOf(startsAt, endsAt), ...extra });

  const book = (startsAt: string) =>
    prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId,
        roomId,
        startsAt: local(startsAt),
        endsAt: new Date(local(startsAt).getTime() + SESSION_MINUTES * MS_PER_MINUTE),
        status: "CONFIRMED",
      },
    });

  const availableStarts = async (): Promise<string[]> => {
    const response = await request(app.getHttpServer())
      .get("/api/booking/availability")
      .query({ from: local("13:00").toISOString(), to: local("18:00").toISOString(), durationMinutes: 20 })
      .set("x-user-id", employee.id)
      .expect(200);
    return response.body.slots.map((slot: { startsAt: string }) => slot.startsAt);
  };

  it("TK-06.07 RF-13 RN-13: previews a free period today without recording anything", async () => {
    const response = await preview(local("15:00"), local("16:00")).expect(200);

    expect(response.body).toEqual({ confirmationText: "Bloquear das 15h às 16h. Confirma?" });
    expect(await prisma.scheduleBlock.count()).toBe(0);
  });

  it("TK-06.07 RN-13: the preview accepts the same body as the creation, reason included", async () => {
    await request(app.getHttpServer())
      .post("/api/therapists/me/schedule-blocks/preview")
      .set("x-user-id", therapistUserId)
      .send({ ...periodOf(local("15:00"), local("16:00")), reason: "Consulta médica" })
      .expect(200);
  });

  it("TK-06.07 RN-13: the preview of a free period tomorrow says tomorrow", async () => {
    const response = await preview(local("15:00", TOMORROW), local("16:00", TOMORROW)).expect(200);

    expect(response.body.confirmationText).toBe("Bloquear amanhã, das 15h às 16h. Confirma?");
  });

  it("TK-06.07 RF-13: blocks a free period of their own, audits the therapist and hides it from availability", async () => {
    const response = await block(local("15:00"), local("16:00")).expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      startsAt: local("15:00").toISOString(),
      endsAt: local("16:00").toISOString(),
      reason: null,
      spokenText: "Bloqueado.",
    });
    const stored = await prisma.scheduleBlock.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored).toEqual(expect.objectContaining({ therapistId, createdById: therapistUserId }));
    const audit = await prisma.auditEvent.findMany({ where: { entityId: response.body.id } });
    expect(audit).toEqual([
      expect.objectContaining({
        actorId: therapistUserId,
        action: "SCHEDULE_BLOCK_CREATED",
        entityType: "ScheduleBlock",
      }),
    ]);
    const starts = await availableStarts();
    expect(starts).not.toContain(local("15:00").toISOString());
    expect(starts).toContain(local("16:00").toISOString());
  });

  it("TK-06.07 D-04: refuses the preview and the creation over two appointments, listing them", async () => {
    const first = await book("15:00");
    const second = await book("15:40");
    const spokenText = "Há 2 atendimentos nesse período, o primeiro às 15h. Cancele-os antes de bloquear.";
    const expected = {
      statusCode: 409,
      error: "Conflict",
      message: spokenText,
      spokenText,
      appointments: [
        { id: first.id, startsAt: local("15:00").toISOString(), endsAt: local("15:20").toISOString(), employee },
        { id: second.id, startsAt: local("15:40").toISOString(), endsAt: local("16:00").toISOString(), employee },
      ],
    };

    expect((await preview(local("15:00"), local("16:00")).expect(409)).body).toEqual(expected);
    expect((await block(local("15:00"), local("16:00")).expect(409)).body).toEqual(expected);
    expect(await prisma.scheduleBlock.count()).toBe(0);
  });

  it("TK-06.07 RN-13: a repeated yes is refused as already blocked and keeps a single block", async () => {
    await block(local("15:00"), local("16:00")).expect(201);

    const response = await block(local("15:00"), local("16:00")).expect(409);

    expect(response.body.message).toBe("Esse período já está bloqueado.");
    expect(await prisma.scheduleBlock.count()).toBe(1);
  });

  it("TK-06.07 RN-13: revalidates on creation when an appointment is booked after the preview", async () => {
    await preview(local("15:00"), local("16:00")).expect(200);
    await book("15:20");

    const response = await block(local("15:00"), local("16:00")).expect(409);

    expect(response.body.spokenText).toBe("Há 1 atendimento nesse período, às 15h20. Cancele-o antes de bloquear.");
    expect(await prisma.scheduleBlock.count()).toBe(0);
  });

  it.each([
    ["ends before it starts", local("16:00"), local("15:00"), messages.errors.invalidPeriod],
    ["starts in the past", local("09:30"), local("10:30"), messages.errors.scheduleBlockInPast],
    ["is outside opening hours", local("17:00"), local("18:30"), messages.errors.scheduleBlockOutsideOperatingHours],
    ["spans two days", local("17:00"), local("09:30", TOMORROW), messages.errors.scheduleBlockSpansDays],
  ])("TK-06.07 RN-08: the preview of a period that %s says what to fix", async (_case, startsAt, endsAt, message) => {
    const response = await preview(startsAt, endsAt).expect(400);

    expect(response.body.message).toBe(message);
  });

  it("TK-06.07: the body cannot choose another therapist", async () => {
    await block(local("15:00"), local("16:00"), { therapistId: otherTherapistId }).expect(400);

    expect(await prisma.scheduleBlock.count()).toBe(0);
  });

  it("TK-06.07: the legacy therapist block route no longer exists", async () => {
    await request(app.getHttpServer())
      .post("/api/therapist/blocks")
      .set("x-user-id", therapistUserId)
      .send({ therapistId, ...periodOf(local("15:00"), local("16:00")) })
      .expect(404);
    expect(await prisma.scheduleBlock.count()).toBe(0);
  });
});
