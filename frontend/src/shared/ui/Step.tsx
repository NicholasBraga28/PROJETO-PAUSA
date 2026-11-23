import type { ReactNode } from "react";
import { motion } from "motion/react";
import { revealIn } from "./motion";

interface StepProps {
  n: number;
  title: string;
  id: string;
  aside?: string;
  children: ReactNode;
}

export function Step({ n, title, id, aside, children }: StepProps) {
  return (
    <motion.section className="step" id={id} aria-labelledby={`${id}-t`} {...revealIn()}>
      <header className="step-head">
        <span className="step-n" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <h3 id={`${id}-t`} tabIndex={-1}>{title}</h3>
        {aside && <span className="step-aside">{aside}</span>}
      </header>
      {children}
    </motion.section>
  );
}
