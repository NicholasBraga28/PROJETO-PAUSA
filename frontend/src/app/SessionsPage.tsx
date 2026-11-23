import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { motion } from "motion/react";
import { errorMessage } from "@/shared/api/api-error";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { getMyAppointments } from "@/features/appointments/api";
import type { MyAppointments, Profile } from "@/shared/api/schemas";
import Sessions from "@/features/appointments/components/Sessions";
import { WaitlistSection } from "@/features/waitlist/components/WaitlistSection";
import { revealIn } from "@/shared/ui/motion";
import { useScenePaused } from "@/shared/visuals/use-scene-paused";
import { PauseAnimationButton } from "@/shared/visuals/PauseAnimationButton";
import LogoWire from "@/shared/visuals/LogoWire";
import { localParts, dateLabel, hhmm } from "@/shared/time/local-time";
import { LOCATION_LABEL } from "@/shared/ui/location-label";
import { FeedbackSurvey } from "@/features/feedback/FeedbackSurvey";

interface SessionsPageProps {
  profile: Profile;
}

type SessionsPageState =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; appointments: MyAppointments };

export default function SessionsPage({ profile }: SessionsPageProps) {
  const announce = useAnnounce();
  const [isScenePaused, setScenePaused] = useScenePaused();
  const [state, setState] = useState<SessionsPageState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const announceOnNextLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const loadingAnnouncement = window.setTimeout(() => announce("Carregando suas sessões."), 600);

    getMyAppointments()
      .then((appointments) => {
        if (cancelled) return;
        window.clearTimeout(loadingAnnouncement);
        setState({ status: "ready", appointments });
        if (announceOnNextLoad.current) announce(appointments.spokenText);
        announceOnNextLoad.current = false;
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        window.clearTimeout(loadingAnnouncement);
        setState({ status: "error", message: errorMessage(cause) });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingAnnouncement);
    };
  }, [announce, profile.id, reload]);

  const retry = () => {
    setState({ status: "loading" });
    announceOnNextLoad.current = true;
    setReload((value) => value + 1);
  };

  const refresh = () => setReload((value) => value + 1);
  const upcoming = state.status === "ready" ? state.appointments.upcoming : [];
  const nextAppointment = upcoming[0];
  const nextDate = nextAppointment ? localParts(nextAppointment.startsAt) : null;
  const nextLocation = nextAppointment?.locationCode
    ? (LOCATION_LABEL[nextAppointment.locationCode] ?? nextAppointment.locationCode)
    : null;

  return (
    <main id="conteudo" tabIndex={-1} className="sessions-page">
      <header className="hero relative min-h-[max(100svh,38.75rem)] w-full flex flex-col overflow-hidden shrink-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.4 }}
          aria-hidden="true"
          className="hero-logo absolute inset-0 pointer-events-none"
        >
          <LogoWire className="w-full h-full" isPaused={isScenePaused} />
        </motion.div>
        <div aria-hidden="true" className="hero-shield absolute inset-0 pointer-events-none" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-10">
          <div className="hero-copy flex flex-col items-center justify-center rounded-3xl px-8 py-6 text-center">
            <h1
              id="sessions-page-title"
              tabIndex={-1}
              className="hero-title text-4xl md:text-[4rem] font-normal tracking-[-0.01em] leading-[1.1]"
            >
              Suas sessões
            </h1>
          </div>
        </div>
        <PauseAnimationButton isPaused={isScenePaused} onChange={setScenePaused} />
      </header>
      <section id="sessoes" className="sessions" aria-labelledby="sessions-page-title">
        <motion.div className="sessions-in" {...revealIn()}>
          <header className="sessions-head">
            {state.status === "ready" && (
              <>
                <p className="sr-only">{state.appointments.spokenText}</p>
                <div className="sessions-overview" aria-hidden="true">
                  <div className="sessions-count">
                    <span className="sessions-overview-label">
                      {upcoming.length === 1 ? "Agendamento futuro" : "Agendamentos futuros"}
                    </span>
                    <strong>{upcoming.length}</strong>
                  </div>
                  {nextAppointment && nextDate ? (
                    <div className="sessions-next">
                      <span className="sessions-overview-label">Próximo atendimento</span>
                      <p className="sessions-next-time">
                        <time dateTime={nextAppointment.startsAt}>
                          {dateLabel(nextDate.date, { weekday: "long", day: "numeric", month: "long" })} · {hhmm(nextDate.minutes)}
                        </time>
                      </p>
                      <p className="sessions-next-place">
                        {nextAppointment.therapistName} · {nextAppointment.roomName}
                        {nextLocation ? `, ${nextLocation}` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </header>
          {state.status === "loading" && <p>Carregando suas sessões…</p>}
          {state.status === "error" && (
            <div className="notice" role="alert">
              <p>Não foi possível carregar suas sessões: {state.message}</p>
              <Button className="ghost-btn" onPress={retry}>
                Tentar novamente
              </Button>
            </div>
          )}
          {state.status === "ready" && <Sessions mine={state.appointments} onChanged={refresh} />}
          {state.status === "ready" && state.appointments.past.some(({ status }) => status === "COMPLETED") && (
            <FeedbackSurvey />
          )}
          <WaitlistSection employeeId={profile.id} onAppointmentChanged={refresh} />
        </motion.div>
      </section>
    </main>
  );
}
