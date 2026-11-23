import { useCallback, useContext, useEffect, useState, type MouseEvent } from "react";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { errorMessage } from "@/shared/api/api-error";
import type { TherapistAgenda as TherapistAgendaData } from "@/shared/api/schemas";
import { getAgenda } from "./api";
import TherapistAppointment from "./TherapistAppointment";
import TherapistActions from "./TherapistActions";
import TherapistNotifications from "./TherapistNotifications";

type AgendaState =
  { status: "loading" } | { status: "ready"; agenda: TherapistAgendaData } | { status: "error"; message: string };

const REGIONS = [
  { id: "therapist-now", headingId: "therapist-now-heading", label: "Agora" },
  { id: "therapist-next", headingId: "therapist-next-heading", label: "Próximo" },
  { id: "therapist-agenda", headingId: "therapist-agenda-heading", label: "Agenda de hoje" },
  { id: "therapist-actions", headingId: "therapist-actions-heading", label: "Atendimentos" },
  { id: "therapist-block", headingId: "therapist-block-heading", label: "Horários" },
  { id: "therapist-notifications", headingId: "therapist-notifications-heading", label: "Avisos" },
] as const;

function focusRegion(event: MouseEvent<HTMLAnchorElement>, regionId: string) {
  const region = document.getElementById(regionId);
  if (!region) return;
  event.preventDefault();
  region.focus();
}

interface TherapistPageProps {
  notice?: string;
}

function TherapistPage({ notice }: TherapistPageProps) {
  const announce = useContext(AnnouncerContext);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<AgendaState>({ status: "loading" });
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    announce("Carregando sua agenda.");
    getAgenda().then(
      (agenda) => {
        if (cancelled) return;
        setState({ status: "ready", agenda });
        announce(agenda.spokenText);
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: errorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [announce, reloadKey]);

  return (
    <main id="conteudo" className="page therapist-page" aria-busy={state.status === "loading"}>
      <div className="page-in therapist-page-in">
        <h1 tabIndex={-1} className="display therapist-page-title">
          Agenda do massoterapeuta
        </h1>
        {notice ? <p className="therapist-route-notice">{notice}</p> : null}
        <nav className="therapist-region-nav" aria-label="Atalhos da agenda">
          {REGIONS.map(({ id, label }) => (
            <a className="therapist-region-link" href={`#${id}`} key={id} onClick={(event) => focusRegion(event, id)}>
              Ir para {label}
            </a>
          ))}
        </nav>

        {state.status === "loading" ? <p className="therapist-loading">Carregando sua agenda…</p> : null}

        {state.status === "error" ? (
          <div className="therapist-error" role="alert">
            <p>{state.message}</p>
            <button className="therapist-retry" type="button" onClick={retry}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <>
            <section
              id="therapist-now"
              className="therapist-region therapist-now"
              aria-labelledby="therapist-now-heading"
              tabIndex={-1}
            >
              <h2 id="therapist-now-heading">Agora</h2>
              {state.agenda.current ? (
                <TherapistAppointment appointment={state.agenda.current} />
              ) : (
                <p>Nenhum atendimento em andamento.</p>
              )}
            </section>

            <section
              id="therapist-next"
              className="therapist-region therapist-next"
              aria-labelledby="therapist-next-heading"
              tabIndex={-1}
            >
              <h2 id="therapist-next-heading">Próximo</h2>
              {state.agenda.next ? (
                <TherapistAppointment appointment={state.agenda.next} />
              ) : (
                <p>Não há atendimento próximo.</p>
              )}
            </section>

            <section
              id="therapist-agenda"
              className="therapist-region therapist-agenda"
              aria-labelledby="therapist-agenda-heading"
              tabIndex={-1}
            >
              <h2 id="therapist-agenda-heading">Agenda de hoje</h2>
              <p className="therapist-summary">{state.agenda.spokenText}</p>
              <ol className="therapist-appointments" aria-label="Atendimentos de hoje">
                {state.agenda.items.map((appointment) => (
                  <li key={appointment.id}>
                    <TherapistAppointment appointment={appointment} />
                  </li>
                ))}
              </ol>
            </section>
            <TherapistActions
              agenda={state.agenda}
              onAgendaRefresh={(updatedAgenda) => setState({ status: "ready", agenda: updatedAgenda })}
            />
            <TherapistNotifications agenda={state.agenda} />
          </>
        ) : null}
      </div>
    </main>
  );
}

export default TherapistPage;
