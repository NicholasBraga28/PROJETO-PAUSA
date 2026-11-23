import { z } from "zod";
import { identify } from "@/shared/api/client";

const USER_KEY = "userId";
const StoredUserId = z.uuid();

export function readUser() {
  try {
    const parsed = StoredUserId.safeParse(localStorage.getItem(USER_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function rememberUser(userId: string | null) {
  identify(userId);
  try {
    if (userId) localStorage.setItem(USER_KEY, userId);
    else localStorage.removeItem(USER_KEY);
  } catch {
    return;
  }
}
