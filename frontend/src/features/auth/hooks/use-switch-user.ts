import { useNavigate } from "react-router";
import { useCurrentSession } from "@/features/auth/hooks/use-current-session";
import { SIGN_IN_PATH } from "@/features/auth/auth-paths";

export function useSwitchUser() {
  const { signOut } = useCurrentSession();
  const navigate = useNavigate();
  return () => {
    signOut();
    void navigate(SIGN_IN_PATH, { replace: true, flushSync: true });
  };
}
