import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { errorMessage } from "@/shared/api/api-error";
import { actionLabel, dateTimeLabel, nextDate, startOfLocalDateUtc, statusLabel } from "./audit-format";
import { getAuditEvents, type AuditEvent, type AuditQuery } from "./api";
import { HrNavigation } from "@/features/hr/HrNavigation";

type Filters = { from: string; to: string; appointmentId: string; actorId: string; action: string };
type QueryState = "loading" | "ready" | "error";
type ErrorField = "from" | "to" | "appointmentId" | "actorId" | null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function currentMonthDates(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

const ACTIONS = [
  ["APPOINTMENT_CREATED", "Agendamento criado"],
  ["APPOINTMENT_CANCELLED", "Agendamento cancelado"],
  ["APPOINTMENT_CHECKED_IN", "Check-in registrado"],
  ["SESSION_STARTED", "Sessão iniciada"],
  ["SESSION_FINISHED", "Sessão finalizada"],
  ["SESSION_AUTO_COMPLETED", "Sessão concluída automaticamente"],
  ["APPOINTMENT_MARKED_NO_SHOW", "Ausência registrada"],
] as const;

function buildQuery(filters: Filters): AuditQuery {
  return {
    ...(filters.from ? { from: startOfLocalDateUtc(filters.from) } : {}),
    ...(filters.to ? { to: startOfLocalDateUtc(nextDate(filters.to)) } : {}),
    ...(filters.appointmentId.trim() ? { appointmentId: filters.appointmentId.trim() } : {}),
    ...(filters.actorId.trim() ? { actorId: filters.actorId.trim() } : {}),
    ...(filters.action ? { action: filters.action } : {}),
  };
}

export default function AuditPage() {
  const announce = useAnnounce();
  const [initialFilters] = useState<Filters>(() => ({
    ...currentMonthDates(),
    appointmentId: "",
    actorId: "",
    action: "",
  }));
  const [initialQuery] = useState<AuditQuery>(() => buildQuery(initialFilters));
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [lastQuery, setLastQuery] = useState<AuditQuery | null>(null);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [spokenSummary, setSpokenSummary] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<QueryState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const runQuery = useCallback(
    async (query: AuditQuery) => {
      setState("loading");
      setError(null);
      setErrorField(null);
      setLastQuery(query);
      setItems([]);
      setNextCursor(null);
      setSpokenSummary(null);
      try {
        const result = await getAuditEvents(query);
        setItems(result.items);
        setNextCursor(result.nextCursor);
        setSpokenSummary(result.spokenText);
        setState("ready");
        announce(result.spokenText);
      } catch (cause: unknown) {
        setError(errorMessage(cause));
        setState("error");
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    },
    [announce],
  );

  useEffect(() => {
    const requestId = window.setTimeout(() => void runQuery(initialQuery), 0);
    return () => window.clearTimeout(requestId);
  }, [initialQuery, runQuery]);

  async function loadMore() {
    if (!lastQuery || !nextCursor) return;
    setState("loading");
    setError(null);
    setErrorField(null);
    try {
      const result = await getAuditEvents({ ...lastQuery, cursor: nextCursor });
      setItems((current) => {
        const ids = new Set(current.map(({ id }) => id));
        return [...current, ...result.items.filter(({ id }) => !ids.has(id))];
      });
      setNextCursor(result.nextCursor);
      setSpokenSummary(result.spokenText);
      setState("ready");
      announce(result.spokenText);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
      setState("error");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filters.appointmentId.trim() && !UUID_PATTERN.test(filters.appointmentId.trim())) {
      setError("Confira o código do agendamento. Ele deve ter o formato apresentado no sistema.");
      setErrorField("appointmentId");
      setState("error");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (filters.actorId.trim() && !UUID_PATTERN.test(filters.actorId.trim())) {
      setError("Confira o código da pessoa responsável. Ele deve ter o formato apresentado no sistema.");
      setErrorField("actorId");
      setState("error");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (filters.from && filters.to && filters.from > filters.to) {
      setError("A data inicial deve ser igual ou anterior à data final.");
      setErrorField("to");
      setState("error");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    void runQuery(buildQuery(filters));
  }

  return (
    <main id="conteudo" className="page">
      <div className="page-in hr-page">
        <HrNavigation />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Histórico de alterações
          </h1>
          <p className="lede">Consulte alterações feitas nos agendamentos e quando elas ocorreram.</p>
        </header>

        <section className="hr-panel audit-filter-panel" aria-labelledby="audit-filters-title">
          <details className="audit-filter-disclosure">
            <summary id="audit-filters-title">Filtrar histórico</summary>
            <form className="audit-filters" onSubmit={submit}>
              <label className="hr-field">
                <span>Data inicial</span>
                <input
                  className="hr-input"
                  type="date"
                  value={filters.from}
                  aria-invalid={errorField === "from" || undefined}
                  aria-describedby={errorField === "from" ? "audit-query-error" : undefined}
                  onChange={(event) => setFilters({ ...filters, from: event.target.value })}
                />
              </label>
              <label className="hr-field">
                <span>Data final</span>
                <input
                  className="hr-input"
                  type="date"
                  value={filters.to}
                  aria-invalid={errorField === "to" || undefined}
                  aria-describedby={errorField === "to" ? "audit-query-error" : undefined}
                  onChange={(event) => setFilters({ ...filters, to: event.target.value })}
                />
              </label>
              <label className="hr-field">
                <span>Código do agendamento</span>
                <input
                  className="hr-input"
                  inputMode="text"
                  autoComplete="off"
                  value={filters.appointmentId}
                  aria-invalid={errorField === "appointmentId" || undefined}
                  aria-describedby={errorField === "appointmentId" ? "audit-query-error" : undefined}
                  onChange={(event) => setFilters({ ...filters, appointmentId: event.target.value })}
                />
              </label>
              <label className="hr-field">
                <span>Código da pessoa responsável</span>
                <input
                  className="hr-input"
                  inputMode="text"
                  autoComplete="off"
                  value={filters.actorId}
                  aria-invalid={errorField === "actorId" || undefined}
                  aria-describedby={errorField === "actorId" ? "audit-query-error" : undefined}
                  onChange={(event) => setFilters({ ...filters, actorId: event.target.value })}
                />
              </label>
              <label className="hr-field">
                <span>Ação</span>
                <select
                  className="hr-input"
                  value={filters.action}
                  onChange={(event) => setFilters({ ...filters, action: event.target.value })}
                >
                  <option value="">Todas as ações</option>
                  {ACTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="cta" type="submit" isDisabled={state === "loading"}>
                Aplicar filtros
              </Button>
            </form>
            <p className="hr-help">As datas seguem o horário de São Paulo.</p>
          </details>
        </section>

        <section className="hr-panel" aria-labelledby="audit-results-title" aria-busy={state === "loading"}>
          <h2 id="audit-results-title">Histórico do mês</h2>
          {state === "loading" && items.length === 0 && (
            <p role="status" className="hr-state">
              Carregando histórico…
            </p>
          )}
          {state === "error" && error && (
            <div className="hr-error" role="alert" tabIndex={-1} ref={errorRef}>
              <p id="audit-query-error">{error}</p>
              {lastQuery && (
                <Button className="cta" onPress={() => lastQuery && void runQuery(lastQuery)}>
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
          {state === "ready" && items.length === 0 && spokenSummary && <p className="hr-empty">{spokenSummary}</p>}
          {items.length > 0 && (
            <>
              {spokenSummary && <p className="hr-help">{spokenSummary}</p>}
              <table className="audit-table">
                <caption>Alterações nos agendamentos, das mais recentes às mais antigas</caption>
                <thead>
                  <tr>
                    <th scope="col">Ação</th>
                    <th scope="col">Data e hora</th>
                    <th scope="col">Autor</th>
                    <th scope="col">Situação registrada</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td aria-label={item.spokenText}>{actionLabel(item.action)}</td>
                      <td>
                        <time dateTime={item.createdAt}>{dateTimeLabel(item.createdAt)}</time>
                      </td>
                      <td>{item.actorId === null ? "Sistema" : "Usuário identificado"}</td>
                      <td>{statusLabel(item.data.status) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="audit-cards" aria-label="Histórico de alterações nos agendamentos">
                {items.map((item) => (
                  <li key={item.id} aria-label={item.spokenText}>
                    <strong>{actionLabel(item.action)}</strong>
                    <time dateTime={item.createdAt}>{dateTimeLabel(item.createdAt)}</time>
                    <span>{item.actorId === null ? "Sistema" : "Usuário identificado"}</span>
                    {statusLabel(item.data.status) && <span>{statusLabel(item.data.status)}</span>}
                  </li>
                ))}
              </ul>
              {state === "loading" && (
                <p role="status" className="hr-state">
                  Carregando mais eventos…
                </p>
              )}
              {nextCursor && (
                <Button className="cta" onPress={() => void loadMore()} isDisabled={state === "loading"}>
                  Carregar mais
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
