import { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

describe("Feedback report (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let adminId: string;
  let employeeId: string;
  let therapistId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    const users = await Promise.all([
      prisma.user.create({ data: { email: "feedback-hr@example.com", name: "HR", role: "HR" } }),
      prisma.user.create({ data: { email: "feedback-admin@example.com", name: "Admin", role: "ADMIN" } }),
      prisma.user.create({ data: { email: "feedback-employee@example.com", name: "Employee", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "feedback-therapist@example.com", name: "Therapist", role: "THERAPIST" } }),
    ]);
    [hrId, adminId, employeeId, therapistId] = users.map(({ id }) => id);
  });

  afterAll(async () => {
    await app.close();
  });

  async function insertResponse(
    bookingEase: number,
    technologySatisfaction: number,
    serviceRating: number,
    recommendationScore: number,
    comment: string | null,
  ) {
    await prisma.$executeRaw`
      INSERT INTO feedback_responses (
        id, booking_ease, technology_satisfaction, service_rating, recommendation_score, comment
      ) VALUES (
        ${randomUUID()}::uuid, ${bookingEase}, ${technologySatisfaction}, ${serviceRating},
        ${recommendationScore}, ${comment}
      )
    `;
  }

  it("TK-16.02 RF-34 RN-18: returns zero distributions and no average or comments when empty", async () => {
    const response = await request(app.getHttpServer()).get("/api/reports/feedback").set("x-user-id", hrId).expect(200);

    expect(response.body).toEqual({
      totalResponses: 0,
      bookingEase: [1, 2, 3, 4, 5].map((value) => ({ value, count: 0 })),
      technologySatisfaction: [1, 2, 3, 4].map((value) => ({ value, count: 0 })),
      serviceRating: [1, 2, 3, 4, 5].map((value) => ({ value, count: 0 })),
      recommendation: Array.from({ length: 11 }, (_, value) => ({ value, count: 0 })),
      recommendationAverage: null,
      comments: [],
    });
  });

  it("TK-16.02 RF-34 RN-18: returns aggregate distributions, recommendation average and anonymous comments", async () => {
    await insertResponse(1, 1, 5, 10, "<script>alert('x')</script>");
    await insertResponse(1, 2, 4, 8, "Melhorar a comunicação.");
    await insertResponse(5, 4, 1, 6, null);

    const response = await request(app.getHttpServer()).get("/api/reports/feedback").set("x-user-id", hrId).expect(200);

    expect(response.body.totalResponses).toBe(3);
    expect(response.body.bookingEase).toEqual([
      { value: 1, count: 2 },
      { value: 2, count: 0 },
      { value: 3, count: 0 },
      { value: 4, count: 0 },
      { value: 5, count: 1 },
    ]);
    expect(response.body.technologySatisfaction).toEqual([
      { value: 1, count: 1 },
      { value: 2, count: 1 },
      { value: 3, count: 0 },
      { value: 4, count: 1 },
    ]);
    expect(response.body.serviceRating).toEqual([
      { value: 1, count: 1 },
      { value: 2, count: 0 },
      { value: 3, count: 0 },
      { value: 4, count: 1 },
      { value: 5, count: 1 },
    ]);
    expect(response.body.recommendation).toEqual(
      Array.from({ length: 11 }, (_, value) => ({ value, count: [6, 8, 10].includes(value) ? 1 : 0 })),
    );
    expect(response.body.recommendationAverage).toBe(8);
    expect(response.body.comments).toEqual(["<script>alert('x')</script>", "Melhorar a comunicação."]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /employeeId|appointmentId|therapistId|locationId|createdAt|userId/,
    );
  });

  it("TK-16.02 RF-34 RN-18: includes repeated responses and comments without correlating them", async () => {
    await insertResponse(2, 3, 4, 7, "Mesmo comentário.");
    await insertResponse(2, 3, 4, 7, "Mesmo comentário.");

    const response = await request(app.getHttpServer())
      .get("/api/reports/feedback")
      .set("x-user-id", adminId)
      .expect(200);

    expect(response.body.totalResponses).toBe(2);
    expect(response.body.recommendationAverage).toBe(7);
    expect(response.body.comments).toEqual(["Mesmo comentário.", "Mesmo comentário."]);
    for (const distribution of [
      response.body.bookingEase,
      response.body.technologySatisfaction,
      response.body.serviceRating,
    ]) {
      expect(distribution.every((entry: { count: number }) => entry.count === 0 || entry.count === 2)).toBe(true);
    }
    expect(response.body.recommendation.find((entry: { value: number }) => entry.value === 7)).toEqual({
      value: 7,
      count: 2,
    });
    expect(Object.keys(response.body).sort()).toEqual([
      "bookingEase",
      "comments",
      "recommendation",
      "recommendationAverage",
      "serviceRating",
      "technologySatisfaction",
      "totalResponses",
    ]);
  });

  it("TK-16.02 RF-34 RN-18: allows HR and ADMIN and rejects other roles or unidentified users", async () => {
    await request(app.getHttpServer()).get("/api/reports/feedback").set("x-user-id", hrId).expect(200);
    await request(app.getHttpServer()).get("/api/reports/feedback").set("x-user-id", adminId).expect(200);
    await request(app.getHttpServer()).get("/api/reports/feedback").set("x-user-id", employeeId).expect(403);
    await request(app.getHttpServer()).get("/api/reports/feedback").set("x-user-id", therapistId).expect(403);
    await request(app.getHttpServer()).get("/api/reports/feedback").expect(401);
  });
});
