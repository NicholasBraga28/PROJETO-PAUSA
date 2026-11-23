import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

describe("Feedback (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeeId: string;
  let hrId: string;

  const validResponse = {
    bookingEase: 1,
    technologySatisfaction: 1,
    serviceRating: 1,
    recommendationScore: 10,
    comment: "  Atendimento excelente.  ",
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    const employee = await prisma.user.create({
      data: { email: "employee-feedback@example.com", name: "Ana Souza", role: "EMPLOYEE" },
    });
    const hr = await prisma.user.create({ data: { email: "hr-feedback@example.com", name: "RH", role: "HR" } });
    employeeId = employee.id;
    hrId = hr.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-16.01 RF-34 RN-18: accepts employee feedback and stores only anonymous answers", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/feedback")
      .set("x-user-id", employeeId)
      .send(validResponse)
      .expect(201);

    expect(response.body).toEqual({ spokenText: "Obrigado por compartilhar sua experiência." });
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'feedback_responses'
      ORDER BY ordinal_position
    `;
    expect(columns.map(({ column_name }) => column_name)).toEqual([
      "id",
      "booking_ease",
      "technology_satisfaction",
      "service_rating",
      "recommendation_score",
      "comment",
    ]);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM feedback_responses`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      booking_ease: 1,
      technology_satisfaction: 1,
      service_rating: 1,
      recommendation_score: 10,
      comment: "Atendimento excelente.",
    });
  });

  it("TK-16.01 RF-34 RN-18: accepts repeated submissions without deduplication", async () => {
    const submit = () =>
      request(app.getHttpServer()).post("/api/feedback").set("x-user-id", employeeId).send(validResponse).expect(201);

    await submit();
    await submit();

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM feedback_responses`;
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it("TK-16.01 RF-34 RN-18: rejects values outside any question scale without saving", async () => {
    const invalidAnswers = [
      { ...validResponse, bookingEase: 0 },
      { ...validResponse, bookingEase: 6 },
      { ...validResponse, technologySatisfaction: 0 },
      { ...validResponse, technologySatisfaction: 5 },
      { ...validResponse, serviceRating: 0 },
      { ...validResponse, serviceRating: 6 },
      { ...validResponse, recommendationScore: -1 },
      { ...validResponse, recommendationScore: 11 },
    ];

    for (const answer of invalidAnswers) {
      await request(app.getHttpServer()).post("/api/feedback").set("x-user-id", employeeId).send(answer).expect(400);
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM feedback_responses`;
    expect(rows).toHaveLength(0);
  });

  it("TK-16.01 RF-34 RN-18: rejects extra fields and comments over the limit", async () => {
    await request(app.getHttpServer())
      .post("/api/feedback")
      .set("x-user-id", employeeId)
      .send({ ...validResponse, employeeId })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/feedback")
      .set("x-user-id", employeeId)
      .send({ ...validResponse, comment: "a".repeat(1001) })
      .expect(400);

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM feedback_responses`;
    expect(rows).toHaveLength(0);
  });

  it("TK-16.01 RF-34 RN-18: allows an absent or blank comment and rejects non-employees", async () => {
    await request(app.getHttpServer())
      .post("/api/feedback")
      .set("x-user-id", employeeId)
      .send({ ...validResponse, comment: undefined })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/feedback")
      .set("x-user-id", employeeId)
      .send({ ...validResponse, comment: "   " })
      .expect(201);
    await request(app.getHttpServer()).post("/api/feedback").set("x-user-id", hrId).send(validResponse).expect(403);
    await request(app.getHttpServer()).post("/api/feedback").send(validResponse).expect(401);

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM feedback_responses`;
    expect(rows).toHaveLength(2);
  });
});
