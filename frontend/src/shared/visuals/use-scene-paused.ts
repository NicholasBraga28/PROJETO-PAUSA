import { useCallback, useState } from "react";
import { z } from "zod";

const STORAGE_KEY = "scene-paused";
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const STORED_CHOICE = z.enum(["true", "false"]).transform((choice) => choice === "true");

function readChoice(): boolean | null {
  try {
    const stored: unknown = localStorage.getItem(STORAGE_KEY);
    const choice = STORED_CHOICE.safeParse(stored);
    return choice.success ? choice.data : null;
  } catch {
    return null;
  }
}

function rememberChoice(isPaused: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(isPaused));
  } catch {
    return;
  }
}

export function useScenePaused(): [isPaused: boolean, setPaused: (isPaused: boolean) => void] {
  const [isPaused, setIsPaused] = useState(() => readChoice() ?? window.matchMedia(REDUCED_MOTION).matches);
  const setPaused = useCallback((next: boolean) => {
    setIsPaused(next);
    rememberChoice(next);
  }, []);
  return [isPaused, setPaused];
}
