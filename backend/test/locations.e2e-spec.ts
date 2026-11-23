import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_LOCATION_ID = "00000000-0000-4000-8000-000000000002";

describe("Locations (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeeId: string;
  let hrId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    employeeId = (
      await prisma.user.create({
        data: { email: "employee@example.com", name: "Beatriz Lima", role: "EMPLOYEE" },
      })
    ).id;
    hrId = (await prisma.user.create({ data: { email: "hr@example.com", name: "Mariana Lima", role: "HR" } })).id;
    await prisma.location.create({
      data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-03.10 RF-01: lists active locations for an employee with only public fields", async () => {
    const response = await request(app.getHttpServer()).get("/api/locations").set("x-user-id", employeeId).expect(200);

    expect(response.body).toEqual([{ code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" }]);
  });

  it("TK-03.10 RF-01: sorts active locations by name", async () => {
    await prisma.location.createMany({
      data: [
        {
          id: SECOND_LOCATION_ID,
          code: "LONDRINA",
          name: "Londrina",
          timezone: "America/Sao_Paulo",
          active: true,
        },
      ],
    });

    const response = await request(app.getHttpServer()).get("/api/locations").set("x-user-id", employeeId).expect(200);

    expect(response.body).toEqual([
      { code: "LONDRINA", name: "Londrina", timezone: "America/Sao_Paulo" },
      { code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" },
    ]);
  });

  it("TK-03.10 RF-01: excludes inactive locations", async () => {
    await prisma.location.create({
      data: {
        id: SECOND_LOCATION_ID,
        code: "LONDRINA",
        name: "Londrina",
        timezone: "America/Sao_Paulo",
        active: false,
      },
    });

    const response = await request(app.getHttpServer()).get("/api/locations").set("x-user-id", employeeId).expect(200);

    expect(response.body).toEqual([{ code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" }]);
  });

  it("TK-03.10 RF-01: returns an empty list when there are no active locations", async () => {
    await prisma.location.update({ where: { id: LOCATION_ID }, data: { active: false } });

    const response = await request(app.getHttpServer()).get("/api/locations").set("x-user-id", employeeId).expect(200);

    expect(response.body).toEqual([]);
  });

  it("TK-12.02 RF-24: gives HR the location IDs and active state needed to create rooms", async () => {
    await prisma.location.create({
      data: {
        id: SECOND_LOCATION_ID,
        code: "LONDRINA",
        name: "Londrina",
        timezone: "America/Sao_Paulo",
        active: false,
      },
    });

    const response = await request(app.getHttpServer()).get("/api/locations/admin").set("x-user-id", hrId).expect(200);

    expect(response.body).toEqual([
      {
        id: SECOND_LOCATION_ID,
        code: "LONDRINA",
        name: "Londrina",
        timezone: "America/Sao_Paulo",
        active: false,
      },
      {
        id: LOCATION_ID,
        code: "SAO_PAULO",
        name: "São Paulo",
        timezone: "America/Sao_Paulo",
        active: true,
      },
    ]);
  });

  it("TK-12.02 RF-24: denies employees access to the administrative location contract", async () => {
    await request(app.getHttpServer()).get("/api/locations/admin").set("x-user-id", employeeId).expect(403);
  });
});
