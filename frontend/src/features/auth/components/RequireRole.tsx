import { Navigate, Outlet } from "react-router";
import type { Role } from "@/shared/api/schemas";
import { ROLE_LABEL } from "@/features/auth/hooks/use-session";
import { useProfile } from "@/features/auth/hooks/use-current-session";
import type { RouteState } from "@/features/auth/hooks/use-route-state";
import { ROLE_HOME } from "@/features/auth/auth-paths";

interface RequireRoleProps {
  requiredRole: Role;
}

export default function RequireRole({ requiredRole }: RequireRoleProps) {
  const profile = useProfile();
  if (profile.effectiveRoles.includes(requiredRole)) return <Outlet />;
  const notice = `A página que você abriu é da área de ${ROLE_LABEL[requiredRole]}; esta é a sua área.`;
  return <Navigate to={ROLE_HOME[profile.role]} replace state={{ notice } satisfies RouteState} />;
}
