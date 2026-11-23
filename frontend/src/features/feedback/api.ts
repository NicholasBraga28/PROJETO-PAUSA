import { request } from "@/shared/api/client";
import { FeedbackResult } from "@/shared/api/schemas";

export interface SubmitFeedbackInput {
  bookingEase: number;
  technologySatisfaction: number;
  serviceRating: number;
  recommendationScore: number;
  comment?: string;
}

export const submitFeedback = (input: SubmitFeedbackInput) =>
  request("/feedback", FeedbackResult, { method: "POST", body: input });
