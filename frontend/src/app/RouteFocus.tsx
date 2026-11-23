import { useEffect, useRef } from "react";
import { useLocation, useMatches } from "react-router";
import { z } from "zod";
import { usePageTitle } from "@/shared/a11y/use-page-title";

const RouteHandle = z.object({ title: z.string() });
export type RouteHandle = z.infer<typeof RouteHandle>;

const titleOf = (handle: unknown) => {
  const parsed = RouteHandle.safeParse(handle);
  return parsed.success ? parsed.data.title : undefined;
};

const INTERACTIONS = ["pointerdown", "keydown"] as const;

function useHasInteracted() {
  const hasInteracted = useRef(false);
  useEffect(() => {
    const mark = () => {
      hasInteracted.current = true;
    };
    INTERACTIONS.forEach((type) => document.addEventListener(type, mark, true));
    return () => INTERACTIONS.forEach((type) => document.removeEventListener(type, mark, true));
  }, []);
  return hasInteracted;
}

export function RouteFocus() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const title = matches
    .map((m) => titleOf(m.handle))
    .filter((t) => t !== undefined)
    .at(-1);
  const focusedPath = useRef<string | null>(null);
  const hasInteracted = useHasInteracted();
  usePageTitle(title);

  useEffect(() => {
    if (focusedPath.current === pathname) return;
    const heading = document.querySelector<HTMLElement>("h1");
    if (!heading) return;
    focusedPath.current = pathname;
    if (hasInteracted.current) heading.focus({ preventScroll: true });
  }, [pathname, hasInteracted]);

  return null;
}
