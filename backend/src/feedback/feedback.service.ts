import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(input: SubmitFeedbackDto) {
    await this.prisma.$executeRaw`
      INSERT INTO feedback_responses (
        id,
        booking_ease,
        technology_satisfaction,
        service_rating,
        recommendation_score,
        comment
      ) VALUES (
        ${randomUUID()}::uuid,
        ${input.bookingEase},
        ${input.technologySatisfaction},
        ${input.serviceRating},
        ${input.recommendationScore},
        ${input.comment ?? null}
      )
    `;

    return { spokenText: messages.feedback.submitted };
  }
}
