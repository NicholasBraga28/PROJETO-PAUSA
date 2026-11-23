import { z } from "zod";
import { request } from "@/shared/api/client";
import { User } from "@/shared/api/schemas";

const AlexaPairingCode = z.object({
  code: z.string().regex(/^\d{6}$/),
  therapistId: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
});

export async function getActiveTherapists() {
  const users = await request("/users?role=THERAPIST&status=ACTIVE", z.array(User));
  return users.flatMap((user) => (user.therapistId ? [{ id: user.therapistId, name: user.name }] : []));
}

export async function generateAlexaPairingCode(therapistId: string) {
  const response = await request(
    `/therapists/${encodeURIComponent(therapistId)}/alexa-pairing-code`,
    AlexaPairingCode,
    {
      method: "POST",
    },
  );
  return AlexaPairingCode.parse(response);
}
