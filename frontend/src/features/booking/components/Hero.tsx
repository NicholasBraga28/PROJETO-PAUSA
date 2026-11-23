import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotionConfig, useScroll, useTransform } from "motion/react";
import { Button } from "react-aria-components";
import { Link } from "react-router";
import { ArrowRight, Check, ChevronDown, CalendarCheck } from "lucide-react";
import LogoWire from "@/shared/visuals/LogoWire";
import { PauseAnimationButton } from "@/shared/visuals/PauseAnimationButton";
import { useScenePaused } from "@/shared/visuals/use-scene-paused";
import type { Appointment } from "@/shared/api/schemas";
import { localParts, dateLabel, hhmm } from "@/shared/time/local-time";
import { LOCATION_LABEL } from "@/shared/ui/location-label";
import { EASE } from "@/shared/ui/motion";
import { useFocusOnMount } from "@/shared/a11y/use-focus-on-mount";
import { VisuallyHidden } from "@/shared/a11y/VisuallyHidden";

export interface NextFree {
  day: string;
  start: number;
  label: string;
}

function useTypewriter(text: string, speed = 60) {
  const [typed, setTyped] = useState({ text, count: 0 });
  if (typed.text !== text) setTyped({ text, count: 0 });
  useEffect(() => {
    if (!text || speed <= 0) return;
    const id = setInterval(() => {
      setTyped((t) => (t.text === text && t.count < text.length ? { text, count: t.count + 1 } : t));
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  if (speed <= 0) return text;
  return typed.text === text ? text.slice(0, typed.count) : "";
}

interface NextSlotCtaProps {
  next: NextFree | null;
  onReserve: (next: NextFree | null) => void;
}

function NextSlotCta({ next, onReserve }: NextSlotCtaProps) {
  const [mode, setMode] = useState<"button" | "open" | "done">("button");
  const full =
    mode === "open"
      ? `Próximo horário livre: ${next?.label}`
      : mode === "done"
        ? "Horário separado, é só confirmar"
        : "";
  const typed = useTypewriter(full);

  useEffect(() => {
    if (mode !== "done") return;
    const go = setTimeout(() => onReserve(next), 700);
    const reset = setTimeout(() => setMode("button"), 4000);
    return () => {
      clearTimeout(go);
      clearTimeout(reset);
    };
  }, [mode, next, onReserve]);

  const pop = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 },
  };
  return (
    <AnimatePresence mode="wait">
      {mode === "button" ? (
        <motion.div key="button" {...pop}>
          <Button onPress={() => (next ? setMode("open") : onReserve(null))} className="hero-btn">
            Reservar uma sessão
          </Button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          {...pop}
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "open") setMode("done");
          }}
          className="hero-pill"
        >
          <span aria-hidden="true" className="flex-1 min-w-0 text-left break-words">
            {typed}
            <span className="animate-pulse motion-reduce:animate-none opacity-60">|</span>
          </span>
          <VisuallyHidden id="hero-next">{full}</VisuallyHidden>
          <GoButton done={mode === "done"} />
        </motion.form>
      )}
    </AnimatePresence>
  );
}

interface GoButtonProps {
  done: boolean;
}

function GoButton({ done }: GoButtonProps) {
  const ref = useFocusOnMount<HTMLButtonElement>();
  return (
    <Button ref={ref} type="submit" aria-label="Reservar este horário" aria-describedby="hero-next" className="hero-go">
      {done ? <Check className="w-4 h-4" aria-hidden="true" /> : <ArrowRight className="w-4 h-4" aria-hidden="true" />}
    </Button>
  );
}

interface ReminderProps {
  appointment: Appointment;
}

function Reminder({ appointment }: ReminderProps) {
  const { date, minutes } = localParts(appointment.startsAt);
  const location = LOCATION_LABEL[appointment.locationCode] ?? appointment.locationCode;
  return (
    <section className="reminder" aria-labelledby="reminder-t">
      <CalendarCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
      <div className="text-left">
        <h2 id="reminder-t" className="reminder-t">
          Sua próxima sessão
        </h2>
        <p>
          <span className="cap">{dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}</span>, às{" "}
          {hhmm(minutes)} com {appointment.therapistName} · {appointment.roomName}
          {location ? `, ${location}` : ""}
        </p>
      </div>
      <a href="#sessoes" className="reminder-link" aria-label="Ver suas sessões">
        Ver
      </a>
    </section>
  );
}

interface HeroProps {
  firstName: string;
  next: NextFree | null;
  reminder: Appointment | null;
  notice?: string;
  onReserve: (next: NextFree | null) => void;
}

export default function Hero({ firstName, next, reminder, notice, onReserve }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const logoY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const [isScenePaused, setScenePaused] = useScenePaused();
  const isMotionReduced = useReducedMotionConfig() ?? false;
  const chatPrompt = useTypewriter("Pergunte com base nos documentos oficiais", isMotionReduced ? 0 : 45);

  return (
    <header
      id="top"
      ref={ref}
      className="hero relative min-h-[max(100svh,38.75rem)] w-full flex flex-col overflow-hidden shrink-0"
    >
      <motion.div
        style={{ y: logoY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.4 }}
        className="hero-logo absolute inset-0 pointer-events-none"
      >
        <LogoWire className="w-full h-full" isPaused={isScenePaused} />
      </motion.div>
      <div className="hero-shield absolute inset-0 pointer-events-none" />

      <motion.div
        style={{ y: contentY }}
        className="relative flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-10"
      >
        <div className="relative z-10 text-center max-w-5xl mx-auto flex flex-col items-center justify-center w-full gap-8">
          <div className="hero-copy flex flex-col items-center gap-8">
            {firstName && <p className="hero-hello">Olá, {firstName}</p>}
            <motion.h1
              tabIndex={-1}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE }}
              className="hero-title text-4xl md:text-[4rem] font-normal tracking-[-0.01em] leading-[1.1] mb-6 max-w-4xl"
            >
              Uma <em>pausa</em> no seu dia, marcada <br className="hidden md:block" />
              em poucos segundos
            </motion.h1>
            <Link
              to="/chat"
              className="home-chat-prompt"
              aria-label="Pergunte com base nos documentos oficiais"
            >
              <span aria-hidden="true">
                {chatPrompt}
                {!isMotionReduced && <span className="chat-prompt-caret">|</span>}
              </span>
              <ArrowRight className="home-chat-prompt-arrow" aria-hidden="true" />
            </Link>
            {notice && <p className="hero-notice">{notice}</p>}
          </div>

          {reminder && <Reminder appointment={reminder} />}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2 w-full flex flex-col items-center gap-3"
          >
            <div className="min-h-[50px] w-full flex justify-center">
              <NextSlotCta next={next} onReserve={onReserve} />
            </div>
            <motion.a
              href="#agenda"
              aria-label="Ver todos os horários"
              className="hero-arrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.span
                animate={isScenePaused ? { y: 0 } : { y: [0, 4, 0] }}
                transition={{ duration: 1.8, repeat: isScenePaused ? 0 : Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-5 h-5" aria-hidden="true" />
              </motion.span>
            </motion.a>
          </motion.div>
        </div>
      </motion.div>
      <PauseAnimationButton isPaused={isScenePaused} onChange={setScenePaused} />
    </header>
  );
}
