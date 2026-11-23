import { useCallback, useEffect, useRef } from "react";

export function useFocusAfterRemoval<T extends HTMLElement = HTMLElement>(ids: readonly string[]) {
  const items = useRef(new Map<string, T>());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const removedIndex = useRef<number | null>(null);
  const lastIds = useRef(ids);

  const itemRef = useCallback(
    (id: string) => (element: T | null) => {
      if (element) items.current.set(id, element);
      else items.current.delete(id);
    },
    [],
  );

  const willRemove = useCallback((id: string) => {
    const index = lastIds.current.indexOf(id);
    removedIndex.current = index >= 0 ? index : null;
  }, []);

  useEffect(() => {
    const previous = lastIds.current;
    lastIds.current = ids;
    const index = removedIndex.current;
    if (index === null) return;
    removedIndex.current = null;
    if (ids.length >= previous.length) return;
    const next = ids[Math.min(index, ids.length - 1)];
    const target = next === undefined ? titleRef.current : items.current.get(next);
    target?.focus();
  }, [ids]);

  return { itemRef, titleRef, willRemove };
}
