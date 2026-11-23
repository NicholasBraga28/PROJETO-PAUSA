import type { ComponentPropsWithoutRef } from "react";

export function VisuallyHidden(props: Omit<ComponentPropsWithoutRef<"span">, "className">) {
  return <span {...props} className="sr-only" />;
}
