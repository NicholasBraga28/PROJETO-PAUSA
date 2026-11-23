import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const MONDAY = "2026-10-26";
const TUESDAY = "2026-10-27";
const WEDNESDAY = "2026-10-28";
const THURSDAY = "2026-10-29";
const SATURDAY = "2026-10-31";
const SATURDAY_BEFORE = new Date("2026-10-24T12:00:00.000Z");

const local = (date: string, time: string): Date => new Date(`${date}T${time}:00.000-03:00`);

type ListedSlot = Readonly<{ therapistId: string; roomId: string; startsAt: string; endsAt: string }>;

describe("Schedule copy (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let therapistId: string;
  let otherTherapistId: string;
  let roomId: string;
  let secondRoomId: string;

  const createTherapist = async (email: string, name: string) => {
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return prisma.therapist.create({ data: { userId: user.id } });
  };

  const createSlot = (therapist: string, room: string, date: string, startsAt: string, endsAt: string) =>
    prisma.scheduleSlot.create({
      data: { therapistId: therapist, roomId: room, startsAt: local(date, startsAt), endsAt: local(date, endsAt) },
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(SATURDAY_BEFORE) }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    const hr = await prisma.user.create({ data: { email: "hr@example.com", name: "Helena RH", role: "HR" } });
    const [therapist, otherTherapist, room, secondRoom] = await Promise.all([
      createTherapist("therapist@example.com", "Tereza Therapist"),
      createTherapist("other.therapist@example.com", "Otávio Therapist"),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala A", checkInToken: "token-a" } }),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala B", checkInToken: "token-b" } }),
    ]);
    hrId = hr.id;
    therapistId = therapist.id;
    otherTherapistId = otherTherapist.id;
    roomId = room.id;
    secondRoomId = secondRoom.id;
    await createSlot(therapistId, roomId, MONDAY, "09:00", "12:00");
    await createSlot(therapistId, roomId, MONDAY, "13:00", "17:00");
    await createSlot(otherTherapistId, secondRoomId, MONDAY, "10:00", "14:00");
  });

  afterAll(async () => {
    await app.close();
  });

  const copy = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post("/api/schedules/copy").set("x-user-id", hrId).send(body);

  const slotsOn = async (date: string): Promise<ListedSlot[]> => {
    const response = await request(app.getHttpServer())
      .get("/api/schedules")
      .query({ date })
      .set("x-user-id", hrId)
      .expect(200);
    return response.body.map(({ therapistId, roomId, startsAt, endsAt }: ListedSlot) => ({
      therapistId,
      roomId,
      startsAt,
      endsAt,
    }));
  };

  const expectedCopyOn = (date: string): ListedSlot[] => [
    { therapistId, roomId, startsAt: local(date, "09:00").toISOString(), endsAt: local(date, "12:00").toISOString() },
    {
      therapistId: otherTherapistId,
      roomId: secondRoomId,
      startsAt: local(date, "10:00").toISOString(),
      endsAt: local(date, "14:00").toISOString(),
    },
    { therapistId, roomId, startsAt: local(date, "13:00").toISOString(), endsAt: local(date, "17:00").toISOString() },
  ];

  it("TK-03.05 RF-26 D-02: copies a model day to the other days keeping the local times and rooms", async () => {
    const response = await copy({ sourceDate: MONDAY, targetDates: [TUESDAY, WEDNESDAY, THURSDAY] }).expect(201);

    expect(response.body.skipped).toEqual([]);
    expect(response.body.created).toHaveLength(9);
    expect(response.body.created[0]).toEqual({
      id: expect.any(String),
      ...expectedCopyOn(TUESDAY)[0],
      createdAt: expect.any(String),
    });
    for (const date of [TUESDAY, WEDNESDAY, THURSDAY]) expect(await slotsOn(date)).toEqual(expectedCopyOn(date));
    expect(await prisma.auditEvent.count({ where: { actorId: hrId, action: "SCHEDULE_SLOT_CREATED" } })).toBe(9);
  });

  it("TK-03.05 D-02: leaves out a whole day with a conflict, says why, and creates the other days", async () => {
    await createSlot(therapistId, secondRoomId, WEDNESDAY, "16:00", "18:00");

    const response = await copy({ sourceDate: MONDAY, targetDates: [TUESDAY, WEDNESDAY] }).expect(201);

    expect(response.body.skipped).toEqual([{ date: WEDNESDAY, message: messages.errors.scheduleConflictTherapist }]);
    expect(response.body.created).toHaveLength(3);
    expect(await slotsOn(TUESDAY)).toEqual(expectedCopyOn(TUESDAY));
    expect(await slotsOn(WEDNESDAY)).toHaveLength(1);
  });

  it("TK-03.05 RN-08: leaves out a day outside the work days", async () => {
    const response = await copy({ sourceDate: MONDAY, targetDates: [SATURDAY] }).expect(201);

    expect(response.body).toEqual({
      created: [],
      skipped: [{ date: SATURDAY, message: messages.errors.outsideOperatingHours }],
    });
    expect(await slotsOn(SATURDAY)).toEqual([]);
  });

  it("TK-03.05: copies only the periods of the given therapist", async () => {
    const response = await copy({ sourceDate: MONDAY, targetDates: [TUESDAY], therapistId: otherTherapistId }).expect(
      201,
    );

    expect(response.body.created).toHaveLength(1);
    expect(await slotsOn(TUESDAY)).toEqual([expectedCopyOn(TUESDAY)[1]]);
  });

  it("TK-03.05: answers 404 for a missing therapist and 400 for an inactive one", async () => {
    const missing = await copy({
      sourceDate: MONDAY,
      targetDates: [TUESDAY],
      therapistId: "5d2c8e41-9b7a-4f36-8c1d-2e5f7a9b0c3d",
    }).expect(404);
    expect(missing.body.message).toBe(messages.errors.therapistNotFound);

    await prisma.user.updateMany({ where: { email: "other.therapist@example.com" }, data: { status: "INACTIVE" } });
    const inactive = await copy({ sourceDate: MONDAY, targetDates: [TUESDAY], therapistId: otherTherapistId }).expect(
      400,
    );
    expect(inactive.body.message).toBe(messages.errors.therapistInactive);
    expect(await prisma.scheduleSlot.count()).toBe(3);
  });

  it.each([
    ["a source day without periods", { sourceDate: "2026-10-23", targetDates: [TUESDAY] }, "scheduleCopyEmptySource"],
    [
      "a target day that is not in the future",
      { sourceDate: MONDAY, targetDates: ["2026-10-24"] },
      "scheduleCopyInvalidTargets",
    ],
    ["a repeated target day", { sourceDate: MONDAY, targetDates: [TUESDAY, TUESDAY] }, "scheduleCopyInvalidTargets"],
    ["the source day as a target", { sourceDate: MONDAY, targetDates: [MONDAY] }, "scheduleCopyInvalidTargets"],
  ] as const)("TK-03.05: refuses %s with the catalog message", async (_case, body, message) => {
    const response = await copy(body).expect(400);

    expect(response.body.message).toBe(messages.errors[message]);
    expect(await prisma.scheduleSlot.count()).toBe(3);
  });
});
