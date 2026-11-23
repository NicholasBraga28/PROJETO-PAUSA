import { useEffect, useRef } from "react";

export function useFocusOnMount<T extends HTMLElement = HTMLHeadingElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
