CREATE TABLE "feedback_responses" (
    "id" UUID NOT NULL,
    "booking_ease" INTEGER NOT NULL,
    "technology_satisfaction" INTEGER NOT NULL,
    "service_rating" INTEGER NOT NULL,
    "recommendation_score" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);
