import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Radio } from "react-aria-components";
import { SPRING } from "./motion";

interface ChipProps {
  group: string;
  value: string;
  children: ReactNode;
}

export function Chip({ group, value, children }: ChipProps) {
  return (
    <Radio value={value} className="chip">
      {({ isSelected }) => (
        <span className="chip-body">
          {isSelected && <motion.span layoutId={`pill-${group}`} className="pill" transition={SPRING} />}
          <span className="txt">{children}</span>
        </span>
      )}
    </Radio>
  );
}
