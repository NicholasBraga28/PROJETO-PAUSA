import type { Transition } from "motion/react";

export const EASE = [0.16, 1, 0.3, 1] as const;
export const SPRING: Transition = { type: "spring", stiffness: 500, damping: 38 };
export const FADE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.25, ease: EASE },
};
const REVEAL = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
};
export const revealIn = (delay = 0) => ({ ...REVEAL, transition: { duration: 0.9, ease: EASE, delay } });
