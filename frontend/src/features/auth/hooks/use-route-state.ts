import { useLocation } from "react-router";
import { z } from "zod";

const RouteState = z.object({ from: z.string().optional(), notice: z.string().optional() });
export type RouteState = z.infer<typeof RouteState>;

export function useRouteState(): RouteState {
  const parsed = RouteState.safeParse(useLocation().state);
  return parsed.success ? parsed.data : {};
}
