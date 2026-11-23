import { createContext, useContext } from "react";
import type { Session, SessionProfile } from "@/features/auth/hooks/use-session";

export const SessionContext = createContext<Session | null>(null);

export function useCurrentSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useCurrentSession must be used inside SessionContext.");
  return session;
}

export function useProfile(): SessionProfile {
  const { profile } = useCurrentSession();
  if (!profile) throw new Error("useProfile must be used inside RequireSignIn.");
  return profile;
}
