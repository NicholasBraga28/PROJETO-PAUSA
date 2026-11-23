import { createContext, useCallback, useState, type ReactNode } from "react";

export interface AnnounceOptions {
  urgent?: boolean;
}

export type Announce = (text: string | null | undefined, options?: AnnounceOptions) => void;

export const AnnouncerContext = createContext<Announce>(() => {});

interface AnnouncerProps {
  children: ReactNode;
}

export function Announcer({ children }: AnnouncerProps) {
  const [polite, setPolite] = useState("");
  const [urgent, setUrgent] = useState("");
  const announce = useCallback<Announce>((text, options) => {
    const setMessage = options?.urgent ? setUrgent : setPolite;
    setMessage("");
    requestAnimationFrame(() => setMessage(text ?? ""));
  }, []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {urgent}
      </div>
    </AnnouncerContext.Provider>
  );
}
