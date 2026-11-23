import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { TherapistAgendaService } from "../src/therapists/therapist-agenda.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const FRIDAY_14_10_IN_SAO_PAULO = new Date("2026-10-23T17:10:00Z");
const FRIDAY_23_30_IN_SAO_PAULO = new Date("2026-10-24T02:30:00Z");
const SESSION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;
const MAX_SENTENCES = 2;
const SENTENCE_END = /[.?!](\s|$)/g;
const MACHINE_FORMATS = /\d{4}-\d{2}-\d{2}|T\d{2}:|UTC|Z\b|\d{2}:\d{2}/;

function expectSpeakable(text: string): void {
  expect(text.match(SENTENCE_END)?.length).toBeLessThanOrEqual(MAX_SENTENCES);
  expect(text).not.toMatch(MACHINE_FORMATS);
  expect(text).not.toMatch(/Souza|Lima|Rocha|Alves|@/);
}

type AppointmentInput = Readonly<{
  employeeName: string;
  startsAt: string;
  status?: AppointmentStatus;
  checkedInAt?: string;
  therapistId?: string;
}>;

describe("Therapist agenda (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;
  let therapistUserId: string;
  let therapistId: string;
  let roomId: string;

  beforeAll(async () => {
    clock = new FakeClock(FRIDAY_14_10_IN_SAO_PAULO);
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(FRIDAY_14_10_IN_SAO_PAULO);
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
        checkedInAt: input.checkedInAt ? new Date(input.checkedInAt) : null,
      },
    });
  }

  const getAgenda = (query = "", userId = therapistUserId) =>
    request(app.getHttpServer()).get(`/api/therapists/me/agenda${query}`).set("x-user-id", userId);

  const getArrivals = (userId = therapistUserId) =>
    request(app.getHttpServer()).get("/api/therapists/me/arrivals").set("x-user-id", userId);

  it("RF-30 RF-11: speaks the session in progress and the next one first", async () => {
    const current = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T17:00:00Z",
      status: "IN_PROGRESS",
    });
    const next = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:30:00Z" });

    const response = await getAgenda().expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        date: "2026-10-23",
        isToday: true,
        current: expect.objectContaining({ id: current.id, employee: { firstName: "Ana" } }),
        next: expect.objectContaining({ id: next.id, employee: { firstName: "Bruno" } }),
        spokenText: "Agora: Ana, até 14h20. Próximo: Bruno, às 14h30.",
      }),
    );
  });

  it("RF-30: takes the appointment whose time contains now as current when no session is in progress", async () => {
    const current = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T17:00:00Z",
      status: "CHECKED_IN",
      checkedInAt: "2026-10-23T16:55:00Z",
    });
    const next = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:30:00Z" });

    const response = await getAgenda().expect(200);

    expect(response.body.current).toEqual(expect.objectContaining({ id: current.id }));
    expect(response.body.next).toEqual(expect.objectContaining({ id: next.id }));
    expect(response.body.spokenText).toBe("Agora: Ana, até 14h20. Próximo: Bruno, às 14h30.");
  });

  it("RF-11 RN-02: counts an appointment in POSSIBLE_NO_SHOW as the next one", async () => {
    await createAppointment({ employeeName: "Carla Rocha", startsAt: "2026-10-23T16:00:00Z", status: "COMPLETED" });
    const next = await createAppointment({
      employeeName: "Bruno Lima",
      startsAt: "2026-10-23T17:30:00Z",
      status: "POSSIBLE_NO_SHOW",
    });

    const response = await getAgenda().expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        current: null,
        next: expect.objectContaining({ id: next.id }),
        remainingCount: 1,
        spokenText: "Hoje, 1 atendimento. Próximo: Bruno, às 14h30.",
      }),
    );
  });

  it("RF-30: says there is nothing left today when every appointment has passed", async () => {
    await createAppointment({ employeeName: "Carla Rocha", startsAt: "2026-10-23T16:00:00Z", status: "COMPLETED" });

    const response = await getAgenda().expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        current: null,
        next: null,
        remainingCount: 0,
        spokenText: "Você não tem mais atendimentos hoje.",
      }),
    );
  });

  it("RF-30: says the day is empty when there is no appointment today", async () => {
    const response = await getAgenda().expect(200);

    expect(response.body).toEqual({
      date: "2026-10-23",
      isToday: true,
      current: null,
      next: null,
      remainingCount: 0,
      items: [],
      spokenText: "Você não tem atendimentos hoje.",
    });
  });

  it("RNF-05: answers the agenda and arrivals about the São Paulo day at 23h30 (02h30 UTC of the next day)", async () => {
    clock.set(FRIDAY_23_30_IN_SAO_PAULO);
    const friday = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T22:00:00Z",
      status: "COMPLETED",
      checkedInAt: "2026-10-23T21:55:00Z",
    });
    await createAppointment({
      employeeName: "Bruno Lima",
      startsAt: "2026-10-24T12:00:00Z",
      status: "CONFIRMED",
      checkedInAt: "2026-10-24T11:50:00Z",
    });

    const agenda = await getAgenda().expect(200);
    const arrivals = await getArrivals().expect(200);

    expect(agenda.body.date).toBe("2026-10-23");
    expect(agenda.body.items.map((item: { id: string }) => item.id)).toEqual([friday.id]);
    expect(agenda.body.spokenText).toBe("Você não tem mais atendimentos hoje.");
    expect(arrivals.body.items.map((item: { id: string }) => item.id)).toEqual([friday.id]);
    expect(arrivals.body.spokenText).toBe("Ana chegou às 18h55.");
  });

  it("RF-10: speaks the day, the count and the first appointment of another date, without current or next", async () => {
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-26T13:00:00Z" });
    const first = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-26T12:00:00Z" });
    await createAppointment({ employeeName: "Carla Rocha", startsAt: "2026-10-26T14:00:00Z", status: "BOOKED" });
    await createAppointment({ employeeName: "Davi Alves", startsAt: "2026-10-26T15:00:00Z" });

    const response = await getAgenda("?date=2026-10-26").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        date: "2026-10-26",
        isToday: false,
        current: null,
        next: null,
        remainingCount: 4,
        spokenText: "Na segunda-feira, 26 de outubro, 4 atendimentos. Primeiro: Ana, às 9h.",
      }),
    );
    expect(response.body.items[0].id).toBe(first.id);
    expectSpeakable(response.body.spokenText);
  });

  it("RF-10: says when another date has no appointment", async () => {
    const response = await getAgenda("?date=2026-10-24").expect(200);

    expect(response.body.spokenText).toBe("Amanhã, você não tem atendimentos.");
  });

  it.each(["2026-02-30", "amanhã", "26/10/2026"])(
    "RNF-01: refuses the invalid date %s with a sentence from the catalog",
    async (date) => {
      const response = await getAgenda(`?date=${encodeURIComponent(date)}`).expect(400);

      expect(response.body.message).toBe(messages.errors.invalidAgendaDate);
    },
  );

  it("RF-30: hides cancelled and released appointments and keeps completed and no-show out of the remaining count", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T12:00:00Z", status: "CANCELLED" });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T13:00:00Z", status: "RELEASED" });
    const completed = await createAppointment({
      employeeName: "Carla Rocha",
      startsAt: "2026-10-23T14:00:00Z",
      status: "COMPLETED",
    });
    const noShow = await createAppointment({
      employeeName: "Davi Alves",
      startsAt: "2026-10-23T15:00:00Z",
      status: "NO_SHOW",
    });
    const upcoming = await createAppointment({ employeeName: "Elisa Moura", startsAt: "2026-10-23T19:00:00Z" });

    const response = await getAgenda().expect(200);

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([completed.id, noShow.id, upcoming.id]);
    expect(response.body.remainingCount).toBe(1);
  });

  it("RNF-01 RNF-04: describes each item with spoken time and status, the first name and only the actions allowed now", async () => {
    const possibleNoShow = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T17:00:00Z",
      status: "POSSIBLE_NO_SHOW",
    });
    const later = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T19:00:00Z" });

    const response = await getAgenda().expect(200);

    expect(response.body.items).toEqual([
      {
        id: possibleNoShow.id,
        startsAt: "2026-10-23T17:00:00.000Z",
        endsAt: "2026-10-23T17:20:00.000Z",
        spokenTime: "às 14h",
        status: "POSSIBLE_NO_SHOW",
        spokenStatus: "possível ausência",
        employee: { firstName: "Ana" },
        room: { name: "Sala 1" },
        checkedInAt: null,
        actions: [
          { kind: "START" },
          { kind: "MARK_NO_SHOW", confirmationText: "Marcar Ana como ausente no atendimento das 14h. Confirma?" },
        ],
        spokenText: "Ana, às 14h, possível ausência.",
      },
      {
        id: later.id,
        startsAt: "2026-10-23T19:00:00.000Z",
        endsAt: "2026-10-23T19:20:00.000Z",
        spokenTime: "às 16h",
        status: "CONFIRMED",
        spokenStatus: "confirmado",
        employee: { firstName: "Bruno" },
        room: { name: "Sala 1" },
        checkedInAt: null,
        actions: [{ kind: "CANCEL", confirmationText: "Cancelar o atendimento de Bruno às 16h. Confirma?" }],
        spokenText: "Bruno, às 16h, confirmado.",
      },
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/Souza|Lima|@example\.com/);
    response.body.items.forEach((item: { spokenText: string }) => expectSpeakable(item.spokenText));
    expectSpeakable(response.body.spokenText);
  });

  it("RN-09 RN-12: offers START only inside the start window and never while another session is in progress", async () => {
    const inProgress = await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T16:50:00Z",
      status: "IN_PROGRESS",
    });
    const insideWindow = await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T17:20:00Z" });

    const withSession = await getAgenda().expect(200);
    await prisma.appointment.update({ where: { id: inProgress.id }, data: { status: "COMPLETED" } });
    const withoutSession = await getAgenda().expect(200);
    clock.set(new Date("2026-10-23T17:04:00Z"));
    const beforeWindow = await getAgenda().expect(200);

    const actionsOf = (body: { items: { id: string; actions: { kind: string }[] }[] }, id: string) =>
      body.items.find((item) => item.id === id)?.actions.map((action) => action.kind);
    expect(actionsOf(withSession.body, inProgress.id)).toEqual(["FINISH"]);
    expect(actionsOf(withSession.body, insideWindow.id)).toEqual(["CANCEL"]);
    expect(actionsOf(withoutSession.body, insideWindow.id)).toEqual(["START", "CANCEL"]);
    expect(actionsOf(beforeWindow.body, insideWindow.id)).toEqual(["CANCEL"]);
  });

  it("RN-13: never shows an appointment of another therapist", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other-therapist@example.com", name: "Paula Reis", role: "THERAPIST" },
    });
    const other = await prisma.therapist.create({ data: { userId: otherUser.id } });
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:30:00Z", therapistId: other.id });
    await createAppointment({
      employeeName: "Bruno Lima",
      startsAt: "2026-10-23T17:00:00Z",
      therapistId: other.id,
      checkedInAt: "2026-10-23T16:55:00Z",
    });

    const agenda = await getAgenda().expect(200);
    const arrivals = await getArrivals().expect(200);

    expect(agenda.body.items).toEqual([]);
    expect(arrivals.body).toEqual({ items: [], spokenText: "Ninguém chegou ainda." });
  });

  it("RF-15 RN-14: speaks the latest arrival and the total, ignoring cancelled check-ins", async () => {
    await createAppointment({
      employeeName: "Ana Souza",
      startsAt: "2026-10-23T17:00:00Z",
      status: "IN_PROGRESS",
      checkedInAt: "2026-10-23T16:50:00Z",
    });
    await createAppointment({
      employeeName: "Carla Rocha",
      startsAt: "2026-10-23T17:30:00Z",
      status: "CHECKED_IN",
      checkedInAt: "2026-10-23T17:05:00Z",
    });
    await createAppointment({
      employeeName: "Bruno Lima",
      startsAt: "2026-10-23T16:00:00Z",
      status: "COMPLETED",
      checkedInAt: "2026-10-23T15:55:00Z",
    });
    await createAppointment({
      employeeName: "Davi Alves",
      startsAt: "2026-10-23T18:00:00Z",
      status: "CANCELLED",
      checkedInAt: "2026-10-23T17:08:00Z",
    });

    const response = await getArrivals().expect(200);

    expect(response.body.items.map((item: { employee: { firstName: string } }) => item.employee.firstName)).toEqual([
      "Bruno",
      "Ana",
      "Carla",
    ]);
    expect(response.body.spokenText).toBe("Carla chegou às 14h05. Hoje, 3 pessoas chegaram.");
    expectSpeakable(response.body.spokenText);
  });

  it("RF-15: says nobody arrived yet", async () => {
    await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:30:00Z" });

    const response = await getArrivals().expect(200);

    expect(response.body).toEqual({ items: [], spokenText: "Ninguém chegou ainda." });
  });

  it("RF-30: refuses a therapist user without a therapist profile with what to do", async () => {
    const withoutProfile = await prisma.user.create({
      data: { email: "no-profile@example.com", name: "Rui Costa", role: "THERAPIST" },
    });

    const agenda = await getAgenda("", withoutProfile.id).expect(404);
    const arrivals = await getArrivals(withoutProfile.id).expect(404);

    expect(agenda.body.message).toBe(messages.errors.therapistProfileUnavailable);
    expect(arrivals.body.message).toBe(messages.errors.therapistProfileUnavailable);
  });

  it.each(["/api/therapist/agenda", "/api/therapist/next", "/api/therapist/arrivals"])(
    "TK-06.02: the legacy route %s no longer exists",
    async (path) => {
      await request(app.getHttpServer()).get(path).set("x-user-id", therapistUserId).expect(404);
    },
  );

  it("TK-06.02: finds today's appointments that start at one of the spoken local times and allow the action", async () => {
    const atTwoPm = await createAppointment({ employeeName: "Ana Souza", startsAt: "2026-10-23T17:00:00Z" });
    await createAppointment({ employeeName: "Bruno Lima", startsAt: "2026-10-23T18:00:00Z" });
    await createAppointment({ employeeName: "Carla Rocha", startsAt: "2026-10-26T17:00:00Z" });
    const agendaService = app.get(TherapistAgendaService);
    const twoOClock = [
      { hour: 2, minute: 0 },
      { hour: 14, minute: 0 },
    ];

    const toCancel = await agendaService.findTodayAppointments(therapistId, {
      localTimes: twoOClock,
      action: "CANCEL",
    });
    const toMarkNoShow = await agendaService.findTodayAppointments(therapistId, {
      localTimes: twoOClock,
      action: "MARK_NO_SHOW",
    });

    expect(toCancel.map((item) => item.id)).toEqual([atTwoPm.id]);
    expect(toMarkNoShow).toEqual([]);
  });
});
