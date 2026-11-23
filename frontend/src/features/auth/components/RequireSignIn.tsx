import { Navigate, Outlet, useLocation } from "react-router";
import { useCurrentSession } from "@/features/auth/hooks/use-current-session";
import type { RouteState } from "@/features/auth/hooks/use-route-state";
import { SIGN_IN_PATH } from "@/features/auth/auth-paths";

export default function RequireSignIn() {
  const { profile } = useCurrentSession();
  const { pathname } = useLocation();
  if (!profile) return <Navigate to={SIGN_IN_PATH} replace state={{ from: pathname } satisfies RouteState} />;
  return <Outlet />;
}
