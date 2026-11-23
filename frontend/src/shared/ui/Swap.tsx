import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SwapProps {
  k: string;
  children: ReactNode;
}

export function Swap({ k, children }: SwapProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={k}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}
