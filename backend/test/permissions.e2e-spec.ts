import { INestApplication, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as request from "supertest";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

type Caller = UserRole | "ANONYMOUS";
type Access = "ALLOWED" | 400 | 401 | 403;
type HttpMethod = "get" | "post" | "patch" | "delete";

type MatrixRow = Readonly<{
  group: string;
  method: HttpMethod;
  path: string;
  access: Readonly<Record<Caller, Access>>;
}>;

const ROLES = Object.values(UserRole);
const ACCESS_DENIED_STATUSES: readonly number[] = [401, 403];
const MISSING_USER_ID = "8b0e2f51-7c1a-4d55-9b0e-2f517c1a4d55";
const SOME_APPOINTMENT_ID = "3d6f9a1c-2b4e-4c7d-8e1f-5a6b7c8d9e0f";
const SOME_NOTIFICATION_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const MISSING_ROOM_ID = "3f6c1d2e-5a4b-4c3d-8e2f-1a0b9c8d7e6f";
const MISSING_SCHEDULE_SLOT_ID = "6a1f0c9e-2b3d-4e5f-8a7b-9c0d1e2f3a4b";
const MISSING_BUSINESS_RULE_KEY = "COFFEE_BREAK_MINUTES";
const MISSING_THERAPIST_ID = "5d2c8e41-9b7a-4f36-8c1d-2e5f7a9b0c3d";

const PERMISSION_MATRIX: readonly MatrixRow[] = [
  {
    group: "locations",
    method: "get",
    path: "/api/locations",
    access: { ANONYMOUS: 401, EMPLOYEE: "ALLOWED", THERAPIST: 403, HR: 403, ADMIN: 403 },
  },
  {
    group: "health",
    method: "get",
    path: "/api/health",
    access: { ANONYMOUS: "ALLOWED", EMPLOYEE: "ALLOWED", THERAPIST: "ALLOWED", HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "health",
    method: "get",
    path: "/api/health/ready",
    access: { ANONYMOUS: "ALLOWED", EMPLOYEE: "ALLOWED", THERAPIST: "ALLOWED", HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "demo users",
    method: "get",
    path: "/api/auth/demo-users",
    access: { ANONYMOUS: "ALLOWED", EMPLOYEE: "ALLOWED", THERAPIST: "ALLOWED", HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "profile",
    method: "get",
    path: "/api/me",
    access: { ANONYMOUS: 401, EMPLOYEE: "ALLOWED", THERAPIST: "ALLOWED", HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "legacy booking",
    method: "get",
    path: "/api/booking/appointments",
    access: { ANONYMOUS: 401, EMPLOYEE: "ALLOWED", THERAPIST: 403, HR: 403, ADMIN: 403 },
  },
  {
    group: "employee waitlist",
    method: "get",
    path: "/api/booking/waitlist",
    access: { ANONYMOUS: 401, EMPLOYEE: "ALLOWED", THERAPIST: 403, HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist agenda",
    method: "get",
    path: "/api/therapists/me/agenda",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist arrivals",
    method: "get",
    path: "/api/therapists/me/arrivals",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist start by ID",
    method: "post",
    path: `/api/therapists/me/appointments/${SOME_APPOINTMENT_ID}/start`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist start current",
    method: "post",
    path: "/api/therapists/me/sessions/current/start",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist finish by ID",
    method: "post",
    path: `/api/therapists/me/appointments/${SOME_APPOINTMENT_ID}/finish`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist mark no-show",
    method: "post",
    path: `/api/therapists/me/appointments/${SOME_APPOINTMENT_ID}/no-show`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist cancel",
    method: "post",
    path: `/api/therapists/me/appointments/${SOME_APPOINTMENT_ID}/cancel`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist block preview",
    method: "post",
    path: "/api/therapists/me/schedule-blocks/preview",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist block",
    method: "post",
    path: "/api/therapists/me/schedule-blocks",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "therapist finish current",
    method: "post",
    path: "/api/therapists/me/sessions/current/finish",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "notifications feed",
    method: "get",
    path: "/api/notifications",
    access: { ANONYMOUS: 401, EMPLOYEE: "ALLOWED", THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "notification read",
    method: "post",
    path: `/api/notifications/${SOME_NOTIFICATION_ID}/read`,
    access: { ANONYMOUS: 401, EMPLOYEE: "ALLOWED", THERAPIST: "ALLOWED", HR: 403, ADMIN: 403 },
  },
  {
    group: "legacy admin",
    method: "get",
    path: "/api/admin/audit",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "rooms",
    method: "get",
    path: "/api/rooms",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "rooms",
    method: "post",
    path: "/api/rooms",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "rooms",
    method: "post",
    path: `/api/rooms/${MISSING_ROOM_ID}/regenerate-token`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "users",
    method: "get",
    path: "/api/users",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "users",
    method: "post",
    path: "/api/users",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "users",
    method: "patch",
    path: `/api/users/${MISSING_USER_ID}/status`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "schedules",
    method: "get",
    path: "/api/schedules",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "schedules",
    method: "post",
    path: "/api/schedules",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "schedules",
    method: "patch",
    path: `/api/schedules/${MISSING_SCHEDULE_SLOT_ID}`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "schedules",
    method: "delete",
    path: `/api/schedules/${MISSING_SCHEDULE_SLOT_ID}`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "schedules",
    method: "post",
    path: "/api/schedules/copy",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "schedule blocks",
    method: "post",
    path: "/api/schedule-blocks",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "business rules",
    method: "get",
    path: "/api/business-rules",
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "business rules",
    method: "patch",
    path: `/api/business-rules/${MISSING_BUSINESS_RULE_KEY}`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "alexa pairing",
    method: "post",
    path: `/api/therapists/${MISSING_THERAPIST_ID}/alexa-pairing-code`,
    access: { ANONYMOUS: 401, EMPLOYEE: 403, THERAPIST: 403, HR: "ALLOWED", ADMIN: "ALLOWED" },
  },
  {
    group: "alexa skill",
    method: "post",
    path: "/api/alexa",
    access: { ANONYMOUS: 400, EMPLOYEE: 400, THERAPIST: 400, HR: 400, ADMIN: 400 },
  },
];

const MATRIX_CASES = PERMISSION_MATRIX.flatMap((row) =>
  (["ANONYMOUS", ...ROLES] as Caller[]).map((caller) => ({ ...row, caller, expected: row.access[caller] })),
);

const IDENTIFICATION_MESSAGES = [
  messages.errors.notIdentified,
  messages.errors.identificationNotRecognized,
  messages.errors.accessDenied,
];

describe("Permissions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (role: UserRole, status: "ACTIVE" | "INACTIVE" = "ACTIVE") =>
    prisma.user.create({
      data: { email: `${role.toLowerCase()}-${status.toLowerCase()}@example.com`, name: "Ana Souza", role, status },
    });

  const call = (method: HttpMethod, path: string, userId?: string) => {
    const pending = request(app.getHttpServer())[method](path);
    return userId ? pending.set("x-user-id", userId) : pending;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(MATRIX_CASES)(
    "TK-02.01: $method $path as $caller is $expected",
    async ({ method, path, caller, expected }) => {
      const userId = caller === "ANONYMOUS" ? undefined : (await createUser(caller)).id;

      const response = await call(method, path, userId);

      if (expected === "ALLOWED") {
        expect(ACCESS_DENIED_STATUSES).not.toContain(response.status);
        return;
      }
      expect(response.status).toBe(expected);
      if (expected === 400) return;
      expect(response.body.message).toBe(
        expected === 401 ? messages.errors.notIdentified : messages.errors.accessDenied,
      );
    },
  );

  it("TK-02.01: lets ADMIN use HR routes by inheritance", async () => {
    const admin = await createUser("ADMIN");

    const response = await call("get", "/api/users", admin.id).expect(200);

    expect(response.body).toEqual([expect.objectContaining({ id: admin.id, role: "ADMIN" })]);
  });

  it("TK-02.01: answers a missing identification with what to do", async () => {
    const response = await call("get", "/api/users").expect(401);

    expect(response.body.message).toBe("Você ainda não se identificou: escolha um usuário na tela de entrada.");
  });

  it("TK-02.01: refuses an x-user-id that is not a UUID without querying the database", async () => {
    const findUnique = jest.spyOn(prisma.user, "findUnique");

    const response = await call("get", "/api/users", "not-a-uuid").expect(401);

    expect(response.body.message).toBe(
      "Não encontramos um usuário ativo com essa identificação: escolha um usuário na tela de entrada.",
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("TK-02.01: gives the same answer to an unknown and to an inactive user", async () => {
    const inactive = await createUser("HR", "INACTIVE");

    const unknownResponse = await call("get", "/api/users", MISSING_USER_ID).expect(401);
    const inactiveResponse = await call("get", "/api/users", inactive.id).expect(401);

    expect(unknownResponse.body.message).toBe(messages.errors.identificationNotRecognized);
    expect(inactiveResponse.body.message).toBe(messages.errors.identificationNotRecognized);
  });

  it("TK-02.01: answers a role without access with what to do", async () => {
    const employee = await createUser("EMPLOYEE");

    const response = await call("get", "/api/users", employee.id).expect(403);

    expect(response.body.message).toBe("Seu perfil não tem acesso a esta função: volte para a página inicial.");
  });

  it.each(IDENTIFICATION_MESSAGES)(
    "TK-02.01: says what happened and what to do in one Portuguese sentence, without jargon: %s",
    (message) => {
      expect(message.match(/[.!?]/g)).toHaveLength(1);
      expect(message).toMatch(/\.$/);
      expect(message).not.toMatch(/cabeçalho|token|x-user-id|header|\d/i);
    },
  );

  it("RNF-04: logs a refused request with only the user ID, method, route and reason", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const employee = await createUser("EMPLOYEE");

    await call("get", "/api/users", employee.id).expect(403);

    expect(warn).toHaveBeenCalledTimes(1);
    const [entry] = warn.mock.calls[0];
    expect(entry).toEqual(expect.stringContaining(employee.id));
    expect(entry).toEqual(expect.stringContaining("GET"));
    expect(entry).toEqual(expect.stringContaining("/api/users"));
    expect(entry).toEqual(expect.stringContaining("role_not_allowed"));
    expect(entry).not.toMatch(/Ana|Souza|@example\.com/);
  });

  it("RNF-04: logs a request without identification with its method, route and reason", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await call("get", "/api/booking/appointments").expect(401);

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/GET.*\/api\/booking\/appointments.*not_identified/));
  });

  it("RNF-04: logs the ID of an unknown user", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await call("get", "/api/users", MISSING_USER_ID).expect(401);

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`not_recognized.*${MISSING_USER_ID}`)));
  });

  it("RNF-04: logs the route pattern, never the values in the path", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const therapist = await createUser("THERAPIST");

    await call("post", "/api/booking/check-in/secret-check-in-token", therapist.id).expect(403);

    const [entry] = warn.mock.calls[0];
    expect(entry).toEqual(expect.stringContaining("route=/api/booking/check-in/:token "));
    expect(entry).not.toContain("secret-check-in-token");
  });
});
