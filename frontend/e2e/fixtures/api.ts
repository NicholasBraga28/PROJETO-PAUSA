import type { Page, Route } from "@playwright/test";
import {
  Role,
  type Appointment,
  type AppointmentStatus,
  type Availability,
  type AvailableSlot,
  type DemoUser,
  type Location,
  type MyAppointments,
  type NextAppointment,
  type Profile,
  type User,
} from "../../src/shared/api/schemas";

export type { Role };

export const NOW = new Date("2026-11-03T12:00:00-03:00");
const SESSION_MINUTES = 20;
const MINUTE_MS = 60_000;

const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Colaborador",
  THERAPIST: "Massoterapeuta",
  HR: "RH",
  ADMIN: "Suporte",
};

const USERS: Record<Role, { id: string; name: string; firstName: string }> = {
  EMPLOYEE: { id: "6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e01", name: "Ana Souza", firstName: "Ana" },
  THERAPIST: { id: "6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e02", name: "Bruno Lima", firstName: "Bruno" },
  HR: { id: "6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e03", name: "Carla Dias", firstName: "Carla" },
  ADMIN: { id: "6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e04", name: "Diego Alves", firstName: "Diego" },
};

export const userIdOf = (role: Role) => USERS[role].id;

const demoUsers: DemoUser[] = Role.options.map((role) => ({
  ...USERS[role],
  role,
  roleLabel: ROLE_LABEL[role],
  spokenText: `${USERS[role].name}, ${ROLE_LABEL[role]}.`,
}));

const hrUsers: User[] = [
  {
    id: "hr-user-1",
    email: "ana@example.com",
    name: "Ana Souza",
    role: "EMPLOYEE",
    status: "ACTIVE",
    therapistId: null,
    createdAt: "2026-11-02T12:00:00.000Z",
  },
];

const profileOf = (role: Role): Profile => ({
  ...USERS[role],
  role,
  effectiveRoles: role === "ADMIN" ? ["ADMIN", "HR"] : [role],
  therapistId: role === "THERAPIST" ? "therapist-1" : null,
  spokenText: `Você entrou como ${USERS[role].name}, ${ROLE_LABEL[role]}.`,
});

const SAO_PAULO: Location = { id: "loc-sp", code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" };
const LONDRINA: Location = { id: "loc-ld", code: "LONDRINA", name: "Londrina", timezone: "America/Sao_Paulo" };

const BRUNO = { therapistId: "therapist-1", therapistName: "Bruno Lima" };
const ELISA = { therapistId: "therapist-2", therapistName: "Elisa Rocha" };

const endOf = (startsAt: string) => new Date(new Date(startsAt).getTime() + SESSION_MINUTES * MINUTE_MS).toISOString();

interface SlotFixture {
  startsAt: string;
  therapist: typeof BRUNO;
  roomName: string;
  location: Location;
}

const slot = ({ startsAt, therapist, roomName, location }: SlotFixture): AvailableSlot => ({
  startsAt,
  endsAt: endOf(startsAt),
  ...therapist,
  roomId: `room-${roomName}`,
  roomName,
  location,
});

const availability: Availability = {
  sessionDurationMinutes: SESSION_MINUTES,
  therapists: [
    { id: BRUNO.therapistId, name: BRUNO.therapistName },
    { id: ELISA.therapistId, name: ELISA.therapistName },
  ],
  slots: [
    slot({ startsAt: "2026-11-04T13:00:00.000Z", therapist: BRUNO, roomName: "Sala 1", location: SAO_PAULO }),
    slot({ startsAt: "2026-11-04T17:00:00.000Z", therapist: BRUNO, roomName: "Sala 1", location: SAO_PAULO }),
    slot({ startsAt: "2026-11-05T14:00:00.000Z", therapist: ELISA, roomName: "Sala Ipê", location: LONDRINA }),
  ],
  waitlistSlots: [],
  spokenText: "3 horários livres nas próximas 3 semanas.",
};

const appointment = (id: string, startsAt: string, status: AppointmentStatus): Appointment => ({
  id,
  ...BRUNO,
  roomId: "room-Sala 1",
  startsAt,
  endsAt: endOf(startsAt),
  status,
  roomName: "Sala 1",
  locationCode: "SAO_PAULO",
});

const upcoming = appointment("a1b2c3d4-0000-4000-8000-000000000001", "2026-11-06T13:00:00.000Z", "BOOKED");
const past = appointment("a1b2c3d4-0000-4000-8000-000000000002", "2026-10-28T13:00:00.000Z", "COMPLETED");

const myAppointments: MyAppointments = { upcoming: [upcoming], past: [past], spokenText: "Você tem 1 sessão marcada." };
const nextAppointment: NextAppointment = {
  appointment: upcoming,
  spokenText: "Sua próxima sessão é sexta-feira às 10h.",
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const roleOf = (userId: string | undefined) => Role.options.find((role) => USERS[role].id === userId);

export async function mockApi(page: Page) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    const role = roleOf(route.request().headers()["x-user-id"]);

    if (path === "/chat/messages" && route.request().method() === "POST")
      return json(route, {
        answer: "O cancelamento segue as regras oficiais do sistema.",
        topic: "rag",
        sources: ["requisitos.md"],
        suggestions: ["Como faço uma reserva?"],
      });
    if (path === "/auth/demo-users") return json(route, demoUsers);
    if (!role) return json(route, { message: "Usuário não identificado." }, 401);
    if (path === "/me") return json(route, profileOf(role));
    if (path === "/users" && route.request().method() === "GET") {
      if (url.searchParams.get("role") === "THERAPIST")
        return json(route, [
          {
            id: "therapist-user-1",
            email: "bruno@example.com",
            name: "Bruno Lima",
            role: "THERAPIST",
            status: "ACTIVE",
            therapistId: "therapist-1",
            createdAt: "2026-11-02T12:00:00.000Z",
          },
        ]);
      return json(route, hrUsers);
    }
    if (path === "/therapists/therapist-1/alexa-pairing-code" && route.request().method() === "POST")
      return json(route, { code: "004821", therapistId: "therapist-1", expiresAt: "2026-11-03T18:00:00.000Z" }, 201);
    if (path === "/therapists/me/agenda")
      return json(route, {
        date: "2026-11-03",
        isToday: true,
        current: {
          id: "appointment-current",
          startsAt: "2026-11-03T14:00:00.000Z",
          endsAt: "2026-11-03T14:20:00.000Z",
          spokenTime: "às 11h",
          status: "IN_PROGRESS",
          spokenStatus: "em andamento",
          employee: { firstName: "Ana" },
          room: { name: "Sala 1" },
          checkedInAt: "2026-11-03T13:55:00.000Z",
          actions: [{ kind: "FINISH" }],
          spokenText: "Ana, às 11h, em andamento.",
        },
        next: {
          id: "appointment-next",
          startsAt: "2026-11-03T14:30:00.000Z",
          endsAt: "2026-11-03T14:50:00.000Z",
          spokenTime: "às 11h30",
          status: "CONFIRMED",
          spokenStatus: "confirmada",
          employee: { firstName: "Bia" },
          room: { name: "Sala 2" },
          checkedInAt: null,
          actions: [{ kind: "CANCEL", confirmationText: "Cancelar o atendimento de Bia às 11h30. Confirma?" }],
          spokenText: "Bia, às 11h30, confirmada.",
        },
        remainingCount: 1,
        items: [
          {
            id: "appointment-current",
            startsAt: "2026-11-03T14:00:00.000Z",
            endsAt: "2026-11-03T14:20:00.000Z",
            spokenTime: "às 11h",
            status: "IN_PROGRESS",
            spokenStatus: "em andamento",
            employee: { firstName: "Ana" },
            room: { name: "Sala 1" },
            checkedInAt: "2026-11-03T13:55:00.000Z",
            actions: [{ kind: "FINISH" }],
            spokenText: "Ana, às 11h, em andamento.",
          },
          {
            id: "appointment-next",
            startsAt: "2026-11-03T14:30:00.000Z",
            endsAt: "2026-11-03T14:50:00.000Z",
            spokenTime: "às 11h30",
            status: "CONFIRMED",
            spokenStatus: "confirmada",
            employee: { firstName: "Bia" },
            room: { name: "Sala 2" },
            checkedInAt: null,
            actions: [{ kind: "CANCEL", confirmationText: "Cancelar o atendimento de Bia às 11h30. Confirma?" }],
            spokenText: "Bia, às 11h30, confirmada.",
          },
        ],
        spokenText: "Agora: Ana, até 11h20. Próximo: Bia, às 11h30.",
      });
    if (path === "/notifications" && route.request().method() === "GET")
      return json(route, {
        items: [
          {
            id: "notification-1",
            appointmentId: "appointment-current",
            kind: "EMPLOYEE_CHECKED_IN",
            status: "SENT",
            scheduledFor: "2026-11-03T13:55:00.000Z",
            readAt: null,
            spokenText: "Ana chegou para o atendimento atual.",
          },
        ],
        nextCursor: null,
        spokenText: "Você tem 1 aviso não lido.",
      });
    if (path === "/notifications/notification-1/read" && route.request().method() === "POST")
      return json(route, {
        id: "notification-1",
        readAt: "2026-11-03T14:00:00.000Z",
        spokenText: "Aviso marcado como lido.",
      });
    if (path === "/schedules" && route.request().method() === "GET")
      return json(route, [
        {
          id: "schedule-1",
          therapistId: "therapist-1",
          roomId: "room-1",
          startsAt: "2026-11-03T12:00:00.000Z",
          endsAt: "2026-11-03T13:00:00.000Z",
          createdAt: "2026-11-02T12:00:00.000Z",
        },
      ]);
    if (path === "/schedule-blocks" && route.request().method() === "POST")
      return json(
        route,
        {
          id: "block-1",
          therapistId: "therapist-1",
          startsAt: "2026-11-05T12:00:00.000Z",
          endsAt: "2026-11-05T13:00:00.000Z",
          reason: null,
          createdById: "hr-user",
          createdAt: "2026-11-03T12:00:00.000Z",
        },
        201,
      );
    if (path === "/business-rules" && route.request().method() === "GET")
      return json(route, [
        {
          key: "SESSION_DURATION_MINUTES",
          value: "20",
          type: "MINUTES",
          description: "Duração de cada sessão, em minutos.",
        },
      ]);
    if (path === "/business-rules/SESSION_DURATION_MINUTES" && route.request().method() === "PATCH")
      return json(route, {
        key: "SESSION_DURATION_MINUTES",
        value: "30",
        type: "MINUTES",
        description: "Duração de cada sessão, em minutos.",
      });
    if (path === "/audit-events")
      return json(route, {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000011",
            actorId: null,
            action: "APPOINTMENT_CREATED",
            entityType: "Appointment",
            entityId: "00000000-0000-4000-8000-000000000012",
            createdAt: "2026-11-03T12:00:00.000Z",
            data: { status: "BOOKED" },
            spokenText: "Evento do sistema: Agendamento criado, registrado em 3 de novembro às 9h.",
          },
        ],
        nextCursor: null,
        spokenText: "1 evento de auditoria no período consultado.",
      });
    if (path === "/reports/kpis")
      return json(route, {
        range: {
          from: "2026-10-01",
          to: "2026-10-31",
          granularity: url.searchParams.get("granularity") ?? "DAY",
          timezone: "America/Sao_Paulo",
        },
        filters: { locationId: url.searchParams.get("locationId"), therapistId: url.searchParams.get("therapistId") },
        demand: {
          byShift: [
            { shift: "MORNING", appointmentCount: 2 },
            { shift: "AFTERNOON", appointmentCount: 1 },
          ],
          mostRequestedShift: "MORNING",
          byWeekday: [
            { weekday: "MONDAY", appointmentCount: 1 },
            { weekday: "TUESDAY", appointmentCount: 1 },
            { weekday: "WEDNESDAY", appointmentCount: 0 },
            { weekday: "THURSDAY", appointmentCount: 1 },
            { weekday: "FRIDAY", appointmentCount: 0 },
            { weekday: "SATURDAY", appointmentCount: 0 },
            { weekday: "SUNDAY", appointmentCount: 0 },
          ],
          mostRequestedWeekday: "MONDAY",
          byStartTime: [
            { time: "09:00", appointmentCount: 2 },
            { time: "14:00", appointmentCount: 1 },
          ],
          mostRequestedStartTime: "09:00",
        },
        cancellations: [
          {
            periodStart: "2026-10-01",
            periodEnd: "2026-10-01",
            scheduledAppointmentCount: 3,
            cancelledAppointmentCount: 1,
            cancellationRatePercent: 33.33,
          },
        ],
        spokenText: "Relatório de 1 a 31 de outubro. Turno mais procurado: manhã. Cancelamentos: 1 de 3 agendamentos.",
      });
    if (path === "/reports/feedback")
      return json(route, {
        totalResponses: 3,
        bookingEase: [1, 2, 3, 4, 5].map((value) => ({ value, count: value === 1 ? 2 : value === 2 ? 1 : 0 })),
        technologySatisfaction: [1, 2, 3, 4].map((value) => ({ value, count: value === 1 ? 2 : value === 3 ? 1 : 0 })),
        serviceRating: [1, 2, 3, 4, 5].map((value) => ({ value, count: value === 1 ? 1 : value === 4 ? 2 : 0 })),
        recommendation: Array.from({ length: 11 }, (_, value) => ({ value, count: value === 8 ? 1 : value === 9 ? 2 : 0 })),
        recommendationAverage: 8.7,
        comments: ["A navegação foi simples.", "O atendimento foi bom."],
      });
    if (path === "/rooms" && route.request().method() === "GET")
      return json(route, [
        {
          id: "room-1",
          name: "Sala 1",
          locationId: "loc-sp",
          locationCode: "SAO_PAULO",
          active: true,
          checkInToken: "fixture-token",
        },
      ]);
    if (path === "/locations/admin")
      return json(
        route,
        [SAO_PAULO, LONDRINA].map(({ id, code, name, timezone }) => ({ id, code, name, timezone, active: true })),
      );
    if (path === "/locations")
      return json(
        route,
        [SAO_PAULO, LONDRINA].map(({ code, name, timezone }) => ({ code, name, timezone })),
      );
    if (path === "/booking/availability") {
      return url.searchParams.has("from")
        ? json(route, availability)
        : json(route, { message: "A duração informada é inválida." }, 400);
    }
    if (path === "/booking/appointments") return json(route, myAppointments);
    if (path === "/feedback" && route.request().method() === "POST")
      return json(route, { spokenText: "Obrigado por compartilhar sua experiência." }, 201);
    if (path === "/booking/appointments/next") return json(route, nextAppointment);
    if (path === "/booking/waitlist")
      return json(route, {
        items: [
          {
            id: "waitlist-1",
            desiredStartsAt: "2026-11-10T17:00:00.000Z",
            desiredEndsAt: "2026-11-10T17:20:00.000Z",
            status: "WAITING",
            offeredAt: null,
            offerExpiresAt: null,
            spokenText: "Aguardando vaga para terça-feira, 10 de novembro, às 14h.",
          },
        ],
        spokenText: "Você tem 1 entrada na lista de espera.",
      });
    return json(route, { message: "Rota não simulada." }, 404);
  });
}
