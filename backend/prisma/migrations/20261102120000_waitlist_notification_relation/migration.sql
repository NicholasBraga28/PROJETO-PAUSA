ALTER TABLE "notifications" ADD COLUMN "waitlist_entry_id" UUID;

CREATE INDEX "waitlist_entries_employee_id_created_at_idx"
  ON "waitlist_entries"("employee_id", "created_at");

CREATE INDEX "notifications_waitlist_entry_id_idx"
  ON "notifications"("waitlist_entry_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_waitlist_entry_id_fkey"
  FOREIGN KEY ("waitlist_entry_id") REFERENCES "waitlist_entries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
