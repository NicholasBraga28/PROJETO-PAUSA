import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { errorMessage } from "@/shared/api/api-error";
import type { TherapistAgenda, TherapistNotification as Notification } from "@/shared/api/schemas";
import { whenLabel } from "@/shared/time/local-time";
import { getNotifications, markNotificationAsRead } from "./api";

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const configuredPollInterval = Number(import.meta.env.VITE_THERAPIST_NOTIFICATIONS_POLL_INTERVAL_MS);
const POLL_INTERVAL_MS =
  Number.isFinite(configuredPollInterval) && configuredPollInterval > 0
    ? configuredPollInterval
    : DEFAULT_POLL_INTERVAL_MS;

interface TherapistNotificationsProps {
  agenda: TherapistAgenda;
  pollIntervalMs?: number;
}

function TherapistNotifications({ agenda, pollIntervalMs = POLL_INTERVAL_MS }: TherapistNotificationsProps) {
  const announce = useContext(AnnouncerContext);
  const [items, setItems] = useState<Notification[]>([]);
  const [summary, setSummary] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const knownIds = useRef(new Set<string>());
  const inFlight = useRef(false);
  const latestScheduledFor = useRef<string | undefined>(undefined);
  const currentAppointmentId = agenda.current?.id;
  const nextAppointmentId = agenda.next?.id;

  const mergeItems = useCallback(
    (incoming: Notification[], shouldAnnounce: boolean) => {
      const fresh: Notification[] = [];
      for (const item of incoming) {
        if (knownIds.current.has(item.id)) continue;
        knownIds.current.add(item.id);
        fresh.push(item);
        if (!latestScheduledFor.current || item.scheduledFor > latestScheduledFor.current) {
          latestScheduledFor.current = item.scheduledFor;
        }
      }
      if (fresh.length) {
        setItems((current) => [...current, ...fresh].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)));
        if (shouldAnnounce) {
          const urgent = fresh.some(
            (item) =>
              item.appointmentId !== null && [currentAppointmentId, nextAppointmentId].includes(item.appointmentId),
          );
          announce(fresh.map((item) => item.spokenText).join(" "), { urgent });
        }
      }
    },
    [announce, currentAppointmentId, nextAppointmentId],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    announce("Carregando avisos.");
    try {
      const feed = await getNotifications({ limit: 50 });
      mergeItems(feed.items, false);
      setSummary(feed.spokenText);
      setNextCursor(feed.nextCursor);
      announce(feed.spokenText);
      setRefreshError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [announce, mergeItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInitial(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInitial]);

  const poll = useCallback(async () => {
    if (inFlight.current || loading || error) return;
    inFlight.current = true;
    try {
      const since = latestScheduledFor.current
        ? new Date(Date.parse(latestScheduledFor.current) - 1).toISOString()
        : new Date().toISOString();
      const updates: Notification[] = [];
      let cursor: string | undefined;
      do {
        const feed = await getNotifications({ since, cursor, limit: 50 });
        updates.push(...feed.items);
        const nextPage = feed.nextCursor ?? undefined;
        if (nextPage === cursor) break;
        cursor = nextPage;
      } while (cursor);
      mergeItems(updates, true);
      setRefreshError("");
    } catch (cause) {
      const message = errorMessage(cause);
      setRefreshError(message);
      if (!refreshError) announce(message);
    } finally {
      inFlight.current = false;
    }
  }, [announce, error, loading, mergeItems, refreshError]);

  useEffect(() => {
    const timer = window.setInterval(() => void poll(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [poll, pollIntervalMs]);

  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      const feed = await getNotifications({ cursor: nextCursor, limit: 50 });
      mergeItems(feed.items, false);
      setNextCursor(feed.nextCursor);
    } catch (cause) {
      setRefreshError(errorMessage(cause));
    }
  };

  const markRead = async (item: Notification) => {
    if (item.readAt || busyIds.has(item.id)) return;
    setBusyIds((current) => new Set(current).add(item.id));
    try {
      const result = await markNotificationAsRead(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === result.id ? { ...entry, readAt: result.readAt } : entry)),
      );
      announce(result.spokenText);
    } catch (cause) {
      const message = errorMessage(cause);
      setRefreshError(message);
      announce(message, { urgent: true });
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <section
      id="therapist-notifications"
      className="therapist-region therapist-notifications"
      aria-labelledby="therapist-notifications-heading"
      aria-busy={loading}
      tabIndex={-1}
    >
      <h2 id="therapist-notifications-heading">Avisos</h2>
      {loading ? <p>Carregando avisos…</p> : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadInitial()}>
            Tentar atualizar avisos
          </button>
        </div>
      ) : null}
      {refreshError ? <p className="therapist-notification-error">{refreshError}</p> : null}
      {!loading && !error && items.length === 0 ? <p>{summary}</p> : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="therapist-notification-list" aria-label="Histórico de avisos">
          {items.map((item) => (
            <li key={item.id}>
              <p>{item.spokenText}</p>
              <p className="therapist-notification-meta">
                {whenLabel(item.scheduledFor)} · {item.readAt ? "Lido" : "Não lido"}
              </p>
              <button
                type="button"
                aria-label={item.readAt ? "Lido. Aviso: " + item.spokenText : "Marcar como lido: " + item.spokenText}
                aria-disabled={Boolean(item.readAt) || busyIds.has(item.id)}
                onClick={() => void markRead(item)}
              >
                {item.readAt ? "Lido" : "Marcar como lido"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {nextCursor && !loading && !error ? (
        <button type="button" onClick={() => void loadMore()}>
          Carregar mais avisos
        </button>
      ) : null}
    </section>
  );
}

export default TherapistNotifications;
