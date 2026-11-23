import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button } from "react-aria-components";
import { errorMessage } from "@/shared/api/api-error";
import { useAnnounce } from "@/shared/a11y/use-announce";
import type { Availability, AvailableSlot, LocationOption } from "@/shared/api/schemas";
import { useProfile } from "@/features/auth/hooks/use-current-session";
import { getAvailability, getLocations } from "@/features/booking/api";
import { BOOKING_DAYS, default as Booking } from "@/features/booking/components/Booking";
import { getWaitlist, joinWaitlist } from "@/features/waitlist/api";
import { useScenePaused } from "@/shared/visuals/use-scene-paused";
import { PauseAnimationButton } from "@/shared/visuals/PauseAnimationButton";
import LogoWire from "@/shared/visuals/LogoWire";
import Hero from "@/features/booking/components/Hero";

const DAY_MS = 86_400_000;

type BookingPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; locations: LocationOption[]; availability: Availability; refreshError?: string };

interface BookingPageProps {
  isHome?: boolean;
  notice?: string;
}

export default function BookingPage({ isHome = false, notice }: BookingPageProps) {
  const profile = useProfile();
  const announce = useAnnounce();
  const [isScenePaused, setScenePaused] = useScenePaused();
  const [state, setState] = useState<BookingPageState>({ status: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadingAnnouncement = window.setTimeout(() => announce("Carregando unidades e horários disponíveis."), 600);
    const from = new Date();
    const to = new Date(from.getTime() + BOOKING_DAYS * DAY_MS);

    Promise.all([getLocations(), getAvailability(from, to)])
      .then(([locations, availability]) => {
        if (cancelled) return;
        window.clearTimeout(loadingAnnouncement);
        setState({ status: "ready", locations, availability });
        announce(availability.spokenText);
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
    setReload((value) => value + 1);
  };

  const joinWaitlistForSlot = async (slot: AvailableSlot) => {
    const created = await joinWaitlist({
      desiredStartsAt: slot.startsAt,
      desiredEndsAt: slot.endsAt,
      therapistId: slot.therapistId,
      locationId: slot.location.id,
    });
    const waitlist = await getWaitlist();
    announce(waitlist.items.find((entry) => entry.id === created.id)?.spokenText ?? waitlist.spokenText);
  };

  const refreshAvailability = async () => {
    const from = new Date();
    const to = new Date(from.getTime() + BOOKING_DAYS * DAY_MS);
    try {
      const availability = await getAvailability(from, to);
      setState((current) =>
        current.status === "ready" ? { ...current, availability, refreshError: undefined } : current,
      );
    } catch (cause) {
      setState((current) => (current.status === "ready" ? { ...current, refreshError: errorMessage(cause) } : current));
    }
  };

  const scrollToAgenda = () => {
    document.getElementById("agenda")?.scrollIntoView({ block: "start" });
  };

  return (
    <main id="conteudo" tabIndex={-1} className="booking-page">
      {isHome ? (
        <Hero firstName="" next={null} reminder={null} notice={notice} onReserve={scrollToAgenda} />
      ) : (
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
                tabIndex={-1}
                className="hero-title text-4xl md:text-[4rem] font-normal tracking-[-0.01em] leading-[1.1]"
              >
                Reservar
              </h1>
            </div>
          </div>
          <PauseAnimationButton isPaused={isScenePaused} onChange={setScenePaused} />
        </header>
      )}
      <div className="booking-page-content">
        {state.status === "loading" && <p>Carregando unidades e horários disponíveis…</p>}
        {state.status === "error" && (
          <div className="notice booking-page-notice" role="alert">
            <p>Não foi possível carregar os dados da reserva: {state.message}</p>
            <Button className="cta" onPress={retry}>
              Tentar novamente
            </Button>
          </div>
        )}
        {state.status === "ready" && (
          <>
            {state.refreshError && (
              <div className="notice booking-page-notice" role="alert">
                <p>A reserva foi confirmada, mas não foi possível atualizar os horários: {state.refreshError}</p>
                <Button className="cta" onPress={retry}>
                  Atualizar horários
                </Button>
              </div>
            )}
            <Booking
              profile={profile}
              locations={state.locations}
              data={state.availability}
              sessionMinutes={state.availability.sessionDurationMinutes}
              loadError={null}
              onRetry={retry}
              onBooked={() => void refreshAvailability()}
              onJoinWaitlist={joinWaitlistForSlot}
              preset={null}
            />
          </>
        )}
      </div>
    </main>
  );
}
