ALTER TYPE "waitlist_status" ADD VALUE 'DECLINED';

ALTER TABLE "waitlist_entries" ADD COLUMN "location_id" UUID;

UPDATE "waitlist_entries" AS entry
SET "location_id" = room."location_id"
FROM "schedule_slots" AS schedule
JOIN "rooms" AS room ON room."id" = schedule."room_id"
WHERE entry."location_id" IS NULL
  AND entry."therapist_id" = schedule."therapist_id"
  AND schedule."starts_at" <= entry."desired_starts_at"
  AND schedule."ends_at" >= entry."desired_ends_at";

ALTER TABLE "waitlist_entries"
ADD CONSTRAINT "waitlist_entries_location_id_fkey"
FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "waitlist_entries_location_id_idx" ON "waitlist_entries"("location_id");
