import { z } from "zod";

const MAX_TOKEN_LENGTH = 128;
const CheckInToken = z
  .string()
  .max(MAX_TOKEN_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

export function parseCheckInToken(raw: string) {
  const parsed = CheckInToken.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
