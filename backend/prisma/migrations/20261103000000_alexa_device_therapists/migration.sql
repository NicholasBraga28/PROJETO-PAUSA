CREATE TABLE "alexa_device_therapists" (
    "alexa_device_id" UUID NOT NULL,
    "therapist_id" UUID NOT NULL,
    "paired_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alexa_device_therapists_pkey" PRIMARY KEY ("alexa_device_id","therapist_id")
);

CREATE INDEX "alexa_device_therapists_therapist_id_idx" ON "alexa_device_therapists"("therapist_id");

ALTER TABLE "alexa_device_therapists" ADD CONSTRAINT "alexa_device_therapists_alexa_device_id_fkey" FOREIGN KEY ("alexa_device_id") REFERENCES "alexa_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alexa_device_therapists" ADD CONSTRAINT "alexa_device_therapists_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "alexa_device_therapists" ("alexa_device_id", "therapist_id", "paired_at")
SELECT "id", "therapist_id", "paired_at" FROM "alexa_devices";

ALTER TABLE "alexa_devices" DROP CONSTRAINT "alexa_devices_therapist_id_fkey";
DROP INDEX "alexa_devices_therapist_id_idx";
ALTER TABLE "alexa_devices" DROP COLUMN "therapist_id";
ALTER TABLE "alexa_devices" RENAME COLUMN "paired_at" TO "created_at";
