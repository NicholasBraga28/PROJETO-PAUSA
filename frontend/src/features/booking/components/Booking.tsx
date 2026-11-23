import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { motion, AnimatePresence, useReducedMotionConfig, type Variants } from "motion/react";
import { RadioGroup, Radio, Button } from "react-aria-components";
import { Link } from "react-router";
import { ArrowDown } from "lucide-react";
import { range, nextDays, dateLabel, hhmm, periodOf, minutesOf, localParts, TIMEZONE } from "@/shared/time/local-time";
import { ApiError, errorMessage } from "@/shared/api/api-error";
import type { Availability, AvailableSlot, LocationOption, Profile } from "@/shared/api/schemas";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { EASE, SPRING, FADE, revealIn } from "@/shared/ui/motion";
import { Step } from "@/shared/ui/Step";
import { Swap } from "@/shared/ui/Swap";
import { Chip } from "@/shared/ui/Chip";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { reserve } from "@/features/booking/api";
import {
  freeStarts,
  freeSlotsLabel,
  pickSlot,
  filterSlots,
  dayRange,
  locationsOf,
  type HourRange,
} from "@/features/booking/slots";

const TITLE: [word: string, isItalic?: boolean][] = [["Escolha"], ["o"], ["seu"], ["momento", true]];
const WORDS: Variants = { show: { transition: { staggerChildren: 0.09 } } };
const WORD: Variants = { hidden: { y: "110%" }, show: { y: 0, transition: { duration: 0.9, ease: EASE } } };

export const BOOKING_DAYS = 21;

export interface BookingPreset {
  day: string;
  start: number;
  key: number;
}

interface Booked {
  code: string;
  when: string;
  therapist: string;
  room: string;
  location?: string;
  spokenText: string;
}

interface BookingProps {
  profile: Profile;
  locations?: LocationOption[];
  data: Availability | null;
  sessionMinutes: number | null;
  loadError: string | null;
  onRetry: () => void;
  onBooked: () => void;
  onJoinWaitlist: (slot: AvailableSlot) => Promise<void>;
  preset: BookingPreset | null;
}

interface WaitlistAttempt {
  key: string;
  status: "joining" | "joined" | "error";
  message?: string;
}

export default function Booking({
  profile,
  locations: availableLocations,
  data,
  sessionMinutes,
  loadError,
  onRetry,
  onBooked,
  onJoinWaitlist,
  preset,
}: BookingProps) {
  const announce = useAnnounce();
  const isMotionReduced = useReducedMotionConfig() ?? false;
  const [loc, setLoc] = useState("any");
  const [ther, setTher] = useState("any");
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [pickedStart, setPickedStart] = useState<number | null>(null);
  const [pickedKind, setPickedKind] = useState<"free" | "waitlist" | null>(null);
  const [done, setDone] = useState<Booked | null>(null);
  const [waitlistAttempt, setWaitlistAttempt] = useState<WaitlistAttempt | null>(null);
  const [waitlistTarget, setWaitlistTarget] = useState<AvailableSlot | null>(null);
  const [waitlistTargetError, setWaitlistTargetError] = useState<string | null>(null);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [applied, setApplied] = useState<BookingPreset | null>(null);
  if (preset && preset !== applied) {
    setApplied(preset);
    setLoc("any");
    setTher("any");
    setPickedDay(preset.day);
    setPickedStart(preset.start);
    setPickedKind("free");
    setDone(null);
  }

  const all = useMemo(() => data?.slots ?? [], [data]);
  const allWaitlist = useMemo(() => data?.waitlistSlots ?? [], [data]);
  const locations = useMemo(() => availableLocations ?? locationsOf(all), [availableLocations, all]);
  const defaultLocation = locations.length === 1 ? (locations[0]?.code ?? "any") : "any";
  const location = locations.some((l) => l.code === loc) ? loc : defaultLocation;
  const timezone = locations.find((l) => l.code === location)?.timezone ?? TIMEZONE;
  const days = useMemo(() => nextDays(BOOKING_DAYS, new Date(), timezone), [timezone]);
  const atLocation = useMemo(() => filterSlots(all, { location }), [all, location]);
  const atLocationWaitlist = useMemo(() => filterSlots(allWaitlist, { location }), [allWaitlist, location]);
  const therapists = useMemo(
    () =>
      (data?.therapists ?? []).filter(
        (t) => atLocation.some((s) => s.therapistId === t.id) || atLocationWaitlist.some((s) => s.therapistId === t.id),
      ),
    [data, atLocation, atLocationWaitlist],
  );
  const therapist = therapists.some((t) => t.id === ther) ? ther : "any";
  const slots = useMemo(() => filterSlots(atLocation, { therapist }), [atLocation, therapist]);
  const waitlistSlots = useMemo(() => filterSlots(atLocationWaitlist, { therapist }), [atLocationWaitlist, therapist]);

  const counts = useMemo(() => days.map((d) => freeStarts(d, slots, timezone).length), [days, slots, timezone]);
  const waitlistStartsByDay = useMemo(
    () => days.map((d) => freeStarts(d, waitlistSlots, timezone)),
    [days, waitlistSlots, timezone],
  );
  const waitlistCounts = useMemo(() => waitlistStartsByDay.map((starts) => starts.length), [waitlistStartsByDay]);
  const hasSlotsOnDay = (index: number) => (counts[index] ?? 0) + (waitlistCounts[index] ?? 0) > 0;
  const day =
    pickedDay && hasSlotsOnDay(days.indexOf(pickedDay))
      ? pickedDay
      : (days.find((_, index) => hasSlotsOnDay(index)) ?? null);
  const free = useMemo(() => (day ? freeStarts(day, slots, timezone) : []), [day, slots, timezone]);
  const selectedStarts = pickedKind === "waitlist" ? (waitlistStartsByDay[days.indexOf(day ?? "")] ?? []) : free;
  const start = pickedStart != null && selectedStarts.includes(pickedStart) ? pickedStart : null;
  const chosen = day ? pickSlot(day, start, pickedKind === "waitlist" ? waitlistSlots : slots, timezone) : null;
  const hours = day ? dayRange(day, [...atLocation, ...atLocationWaitlist], timezone) : null;
  const waitlistKey = chosen ? `${chosen.startsAt}:${chosen.therapistId}` : "";
  const currentWaitlistAttempt = waitlistAttempt?.key === waitlistKey ? waitlistAttempt : null;
  const waitlistState =
    currentWaitlistAttempt?.status === "joining"
      ? "joining"
      : currentWaitlistAttempt?.status === "joined"
        ? "joined"
        : "idle";
  const waitlistError = currentWaitlistAttempt?.status === "error" ? (currentWaitlistAttempt.message ?? null) : null;

  function chooseDay(d: string) {
    setPickedDay(d);
    setPickedStart(null);
    setPickedKind(null);
  }
  function goToForm() {
    const f = document.getElementById("confirmar");
    f?.scrollIntoView({ behavior: "smooth", block: "center" });
    f?.focus({ preventScroll: true });
  }

  async function confirm() {
    if (!chosen || !day || start == null) throw new Error("Esse horário não está mais livre. Escolha outro.");
    const created = await reserve(chosen);
    setDone({
      code: String(created.id).slice(0, 8).toUpperCase(),
      when: `${dateLabel(day, { weekday: "long", day: "numeric", month: "long" })} às ${hhmm(start)}`,
      therapist: created.therapistName ?? chosen.therapistName,
      room: created.roomName ?? chosen.roomName,
      location: chosen.location?.name,
      spokenText: created.spokenText,
    });
    announce(created.spokenText);
    onBooked();
  }

  async function joinCurrentWaitlist() {
    if (!chosen) return;
    await joinWaitlistSlot(chosen);
  }

  function selectTime(value: string) {
    const [kind, minute] = value.split(":");
    if ((kind === "free" || kind === "waitlist") && minute) {
      setPickedKind(kind);
      setPickedStart(Number(minute));
    }
  }

  function requestWaitlist() {
    if (pickedKind === "waitlist" && chosen) {
      setWaitlistTargetError(null);
      setWaitlistTarget(chosen);
    }
  }

  async function joinWaitlistSlot(slot: AvailableSlot) {
    const key = `${slot.startsAt}:${slot.therapistId}`;
    setWaitlistAttempt({ key, status: "joining" });
    try {
      await onJoinWaitlist(slot);
      setWaitlistAttempt({ key, status: "joined" });
      return true;
    } catch (cause) {
      const message = errorMessage(cause);
      setWaitlistAttempt({ key, status: "error", message });
      if (waitlistTarget?.startsAt === slot.startsAt) setWaitlistTargetError(message);
      return false;
    }
  }

  const steps = [locations.length > 0 && "unidade", "terapeutas", "horarios", "horario"].filter(Boolean);
  const nOf = (id: string) => steps.indexOf(id) + 1;

  return (
    <section id="agenda" className="agenda" aria-labelledby="agenda-t">
      <motion.div
        className="agenda-head"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <span className="badge">Horários das próximas 3 semanas</span>
        <motion.h2
          id="agenda-t"
          className="display"
          aria-label="Escolha o seu momento"
          variants={WORDS}
          initial={isMotionReduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.6 }}
        >
          {TITLE.map(([w, italic]) => (
            <span key={w} className="word" aria-hidden="true">
              <motion.span variants={WORD}>{italic ? <em>{w}</em> : w}</motion.span>
            </span>
          ))}
        </motion.h2>
        <p className="lede">
          Sessões de massoterapia{sessionMinutes ? ` de ${sessionMinutes} minutos` : ""}. Escolha a unidade, o terapeuta
          e um horário livre.
        </p>
      </motion.div>

      <div className="stage">
        {!data ? (
          <div className="notice" role={loadError ? "alert" : "status"}>
            {loadError ? (
              <>
                <p>Não foi possível carregar os horários: {loadError}</p>
                <Button className="ghost-btn" onPress={onRetry}>
                  Tentar de novo
                </Button>
              </>
            ) : (
              <p>Carregando horários…</p>
            )}
          </div>
        ) : !day ? (
          <div className="notice" role="status">
            <p>
              Nenhum horário livre nas próximas 3 semanas
              {location !== "any" || therapist !== "any" ? " com esses filtros" : ""}.
            </p>
            {(location !== "any" || therapist !== "any") && (
              <Button
                className="ghost-btn"
                onPress={() => {
                  setLoc("any");
                  setTher("any");
                }}
              >
                Ver todas as unidades e terapeutas
              </Button>
            )}
          </div>
        ) : (
          <div className="booking">
            <div className="flow">
              {locations.length > 0 && (
                <Step n={nOf("unidade")} title="Unidade" id="unidade">
                  <RadioGroup
                    className="chips"
                    aria-labelledby="unidade-t"
                    orientation="horizontal"
                    value={location}
                    onChange={setLoc}
                  >
                    {(locations.length > 1 ? [{ code: "any", name: "Todas" }, ...locations] : locations).map((l) => (
                      <Chip key={l.code} group="loc" value={l.code}>
                        {l.name}
                      </Chip>
                    ))}
                  </RadioGroup>
                </Step>
              )}

              <Step n={nOf("terapeutas")} title="Terapeuta" id="terapeutas">
                <RadioGroup
                  className="chips"
                  aria-labelledby="terapeutas-t"
                  orientation="horizontal"
                  value={therapist}
                  onChange={setTher}
                >
                  {[{ id: "any", name: "Sem preferência" }, ...therapists].map((t) => (
                    <Chip key={t.id} group="ther" value={t.id}>
                      {t.name}
                    </Chip>
                  ))}
                </RadioGroup>
              </Step>

              <Step
                n={nOf("horarios")}
                title="Dia"
                id="horarios"
                aside={dateLabel(day, { month: "long", year: "numeric" })}
              >
                <DayStrip day={day} days={days} counts={counts} waitlistCounts={waitlistCounts} onPick={chooseDay} />
              </Step>

              <Step
                n={nOf("horario")}
                title="Horário"
                id="horario"
                aside={`${dateLabel(day, { weekday: "long", day: "numeric" })}${hours ? ` · ${hours[0]}h às ${hours[1]}h` : ""}`}
              >
                {hours && (
                  <div className="bar-wrap">
                    <DayBar
                      day={day}
                      hours={hours}
                      minutes={sessionMinutes}
                      free={free}
                      start={start}
                      onPick={(minute) => {
                        setPickedKind("free");
                        setPickedStart(minute);
                      }}
                      timezone={timezone}
                    />
                    <div className="legend" aria-hidden="true">
                      <span>
                        <i className="l-free" />
                        Livre
                      </span>
                      <span>
                        <i className="l-busy" />
                        Indisponível
                      </span>
                      <span>
                        <i className="l-sel" />
                        Sua sessão
                      </span>
                    </div>
                  </div>
                )}
                <Slots
                  key={`${day}-${location}-${therapist}`}
                  day={day}
                  availableSlots={slots}
                  occupiedSlots={waitlistSlots}
                  timezone={timezone}
                  free={free}
                  start={start}
                  onPick={selectTime}
                  occupied={waitlistStartsByDay[days.indexOf(day)] ?? []}
                  pickedKind={pickedKind}
                />

                <AnimatePresence>
                  {start != null && !done && (
                    <motion.div key="to-form" className="to-form" {...FADE}>
                      <Button className="ghost-btn" onPress={goToForm}>
                        Seguir para a confirmação <ArrowDown className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Step>
            </div>

            <motion.aside
              className="summary"
              id="dados"
              aria-labelledby={done ? "done-t" : "confirmar-t"}
              {...revealIn(0.15)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.div key="done" {...FADE}>
                    <Done
                      booking={done}
                      firstName={profile.firstName}
                      onAgain={() => {
                        setDone(null);
                        setPickedStart(null);
                        setPickedKind(null);
                        window.requestAnimationFrame(() => document.getElementById("horario-t")?.focus());
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="form" {...FADE}>
                    <Summary
                      n={steps.length + 1}
                      day={day}
                      start={start}
                      slot={chosen}
                      sessionMinutes={sessionMinutes}
                      therapistName={therapists.find((t) => t.id === therapist)?.name}
                      profile={profile}
                      onConfirm={confirm}
                      isWaitlistSelection={pickedKind === "waitlist"}
                      onRequestWaitlist={requestWaitlist}
                      onJoinWaitlist={joinCurrentWaitlist}
                      waitlistState={waitlistState}
                      waitlistError={waitlistError}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.aside>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={waitlistTarget !== null}
        onOpenChange={(open) => {
          if (!open && !joiningWaitlist) setWaitlistTarget(null);
        }}
        title="Entrar na lista de espera?"
        confirmLabel="Entrar na lista"
        busyLabel="Entrando..."
        busy={joiningWaitlist}
        error={waitlistTargetError}
        onConfirm={async () => {
          if (!waitlistTarget) return;
          setJoiningWaitlist(true);
          const joined = await joinWaitlistSlot(waitlistTarget);
          setJoiningWaitlist(false);
          if (joined) setWaitlistTarget(null);
        }}
      >
        {waitlistTarget && (
          <p>
            Você vai aguardar uma oferta para{" "}
            {dateLabel(localParts(waitlistTarget.startsAt, timezone).date, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            , às {hhmm(localParts(waitlistTarget.startsAt, timezone).minutes)}, com {waitlistTarget.therapistName}, na
            unidade {waitlistTarget.location.name}.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}

interface DayStripProps {
  day: string;
  days: string[];
  counts: number[];
  waitlistCounts: number[];
  onPick: (day: string) => void;
}

function DayStrip({ day, days, counts, waitlistCounts, onPick }: DayStripProps) {
  return (
    <RadioGroup className="days" aria-labelledby="horarios-t" orientation="horizontal" value={day} onChange={onPick}>
      {days.map((d, k) => {
        const c = counts[k];
        const w = waitlistCounts[k] ?? 0;
        return (
          <motion.div
            key={d}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: EASE, delay: Math.min(k, 10) * 0.035 }}
          >
            <Radio
              value={d}
              isDisabled={!c && !w}
              className="day"
              aria-label={`${dateLabel(d, { weekday: "long", day: "numeric", month: "long" })}, ${c ? `${c} ${c === 1 ? "horário livre" : "horários livres"}` : "sem horários livres"}${w ? `, ${w} ${w === 1 ? "horário ocupado para lista de espera" : "horários ocupados para lista de espera"}` : ""}`}
            >
              {({ isSelected }) => (
                <>
                  <span className="wd">{dateLabel(d, { weekday: "short" }).replace(".", "")}</span>
                  <span className="dn">
                    {isSelected && <motion.span layoutId="pill-day" className="pill" transition={SPRING} />}
                    <span className="txt">{Number(d.slice(8))}</span>
                  </span>
                  <span className="av">{freeSlotsLabel(c ?? 0)}</span>
                </>
              )}
            </Radio>
          </motion.div>
        );
      })}
    </RadioGroup>
  );
}

interface DayBarProps {
  day: string;
  hours: HourRange;
  minutes: number | null;
  free: number[];
  start: number | null;
  onPick: (start: number) => void;
  timezone: string;
}

function DayBar({ day, hours, minutes, free, start, onPick, timezone }: DayBarProps) {
  const [hover, setHover] = useState<number | null>(null);
  const lo = hours[0] * 60,
    span = (hours[1] - hours[0]) * 60,
    len = minutes ?? 0;
  const pct = (m: number) => `${((m - lo) / span) * 100}%`;
  const width = (m: number) => `${(m / span) * 100}%`;
  const nowMin = day === nextDays(1, new Date(), timezone)[0] ? minutesOf(new Date(), timezone) : null;
  const past = nowMin == null ? 0 : Math.max(0, Math.min(span, nowMin - lo));
  const freeStartUnderPointer = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = lo + ((e.clientX - r.left) / r.width) * span;
    const covering = free.filter((s) => s <= m && m < s + len);
    return covering.at(-1) ?? null;
  };

  return (
    <>
      <div
        className="bar"
        aria-hidden="true"
        onMouseMove={(e) => setHover(freeStartUnderPointer(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const s = freeStartUnderPointer(e);
          if (s != null) onPick(s);
        }}
      >
        {range(hours[1] - hours[0] - 1).map((k) => (
          <div key={`h${k}`} className="hr" style={{ left: pct(lo + (k + 1) * 60) }} />
        ))}
        <div key={`${day}-${free.join()}`} className="bar-layer">
          {free.map((s) => (
            <div key={s} className="free" style={{ left: pct(s), width: width(len) }} />
          ))}
          {past > 0 && <div className="past" style={{ width: width(past) }} />}
        </div>
        {hover != null && hover !== start && <div className="ghost" style={{ left: pct(hover), width: width(len) }} />}
        <AnimatePresence>
          {start != null && (
            <motion.div
              key="sel"
              className="sel"
              initial={{ opacity: 0, scaleY: 0.6 }}
              animate={{ opacity: 1, scaleY: 1, left: pct(start), width: width(len) }}
              exit={{ opacity: 0, scaleY: 0.6 }}
              transition={SPRING}
              style={{ left: pct(start), width: width(len) }}
            >
              {hhmm(start)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="axis" aria-hidden="true">
        {range(hours[1] - hours[0] + 1)
          .filter((k) => k % 2 === 0 || k === hours[1] - hours[0])
          .map((k) => (
            <span key={k} style={{ left: pct(lo + k * 60) }}>
              {hours[0] + k}h
            </span>
          ))}
      </div>
    </>
  );
}

const LIST: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const ITEM: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

interface SlotsProps {
  day: string;
  availableSlots: AvailableSlot[];
  occupiedSlots: AvailableSlot[];
  occupied: number[];
  timezone: string;
  free: number[];
  start: number | null;
  pickedKind: "free" | "waitlist" | null;
  onPick: (value: string) => void;
}

function Slots({
  day,
  availableSlots,
  occupiedSlots,
  occupied,
  timezone,
  free,
  start,
  pickedKind,
  onPick,
}: SlotsProps) {
  const groups = ["Manhã", "Tarde", "Noite"];
  return (
    <RadioGroup
      aria-labelledby="horario-t"
      value={start == null || pickedKind == null ? null : `${pickedKind}:${start}`}
      onChange={onPick}
    >
      <motion.div
        className="periods"
        variants={LIST}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {groups.map((name) => {
          const availableInPeriod = free.filter((m) => periodOf(m) === name);
          const occupiedInPeriod = occupied.filter((m) => periodOf(m) === name);
          const g = [...new Set([...availableInPeriod, ...occupiedInPeriod])].sort((a, b) => a - b);
          if (!g.length && name === "Noite") return null;
          return (
            <div className="period" key={name}>
              <h4 aria-hidden="true">{name}</h4>
              {g.length ? (
                <div className="slots">
                  {g.map((m) => (
                    <div key={m} className="slot-options">
                      {availableInPeriod.includes(m) && (
                        <motion.div variants={ITEM}>
                          <Radio
                            value={`free:${m}`}
                            className="slot"
                            aria-label={slotAccessibleName(day, m, name, availableSlots, timezone)}
                          >
                            {({ isSelected }) => (
                              <>
                                {isSelected && (
                                  <motion.span layoutId="pill-slot" className="pill" transition={SPRING} />
                                )}
                                <span className="txt">{hhmm(m)}</span>
                              </>
                            )}
                          </Radio>
                        </motion.div>
                      )}
                      {occupiedInPeriod.includes(m) && (
                        <motion.div variants={ITEM}>
                          <Radio
                            value={`waitlist:${m}`}
                            className="slot slot-busy"
                            aria-label={occupiedSlotAccessibleName(day, m, name, occupiedSlots, timezone)}
                          >
                            {({ isSelected }) => (
                              <>
                                {isSelected && (
                                  <motion.span layoutId="pill-slot" className="pill" transition={SPRING} />
                                )}
                                <span className="txt">{hhmm(m)}</span>
                                <span className="slot-status">Indisponível</span>
                              </>
                            )}
                          </Radio>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <motion.p variants={ITEM} className="none">
                  Nenhum horário livre {name === "Manhã" ? "de manhã" : "à tarde"}.
                </motion.p>
              )}
            </div>
          );
        })}
      </motion.div>
    </RadioGroup>
  );
}

function slotAccessibleName(day: string, minute: number, period: string, slots: AvailableSlot[], timezone: string) {
  const slot = pickSlot(day, minute, slots, timezone);
  return `${dateLabel(day, { weekday: "long", day: "numeric", month: "long" })}, ${period}, ${hhmm(minute)}, ${slot?.therapistName}, ${slot?.roomName}`;
}

function occupiedSlotAccessibleName(
  day: string,
  minute: number,
  period: string,
  slots: AvailableSlot[],
  timezone: string,
) {
  const slot = pickSlot(day, minute, slots, timezone);
  return `${dateLabel(day, { weekday: "long", day: "numeric", month: "long" })}, ${period}, ${hhmm(minute)}, indisponível; aguardar uma vaga com ${slot?.therapistName}, ${slot?.roomName}, ${slot?.location.name}`;
}

interface SummaryProps {
  n: number;
  day: string;
  start: number | null;
  slot: AvailableSlot | null;
  sessionMinutes: number | null;
  therapistName: string | undefined;
  profile: Profile;
  onConfirm: () => Promise<void>;
  isWaitlistSelection: boolean;
  onRequestWaitlist: () => void;
  onJoinWaitlist: () => Promise<void>;
  waitlistState: "idle" | "joining" | "joined";
  waitlistError: string | null;
}

function Summary({
  n,
  day,
  start,
  slot,
  sessionMinutes,
  therapistName,
  profile,
  onConfirm,
  isWaitlistSelection,
  onRequestWaitlist,
  onJoinWaitlist,
  waitlistState,
  waitlistError,
}: SummaryProps) {
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<{ key: string; message: string; unavailable: boolean } | null>(null);
  const current = `${day}-${start}`;
  const sendError = failure?.key === current ? failure.message : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setFailure(null);
    try {
      await onConfirm();
    } catch (err) {
      setFailure({
        key: current,
        message: errorMessage(err),
        unavailable: err instanceof ApiError && err.status === 409,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="sum" onSubmit={submit} aria-labelledby="confirmar-t">
      <header className="step-head">
        <span className="step-n" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <h3 id="confirmar-t" tabIndex={-1}>
          Confirmação
        </h3>
      </header>
      <div className="recap">
        <p className="sum-line">
          Massoterapia{sessionMinutes ? `, ${sessionMinutes} min` : ""}
          <br />
          <Swap k={start == null ? "none" : `${day}-${start}`}>
            {start != null ? (
              <span>
                {dateLabel(day, { weekday: "long", day: "numeric", month: "short" })}, {hhmm(start)}
              </span>
            ) : (
              <span className="dim">escolha um horário</span>
            )}
          </Swap>
        </p>
        <p className="sum-meta">
          {slot
            ? `com ${slot.therapistName} · ${slot.roomName}${slot.location ? `, ${slot.location.name}` : ""}`
            : therapistName
              ? `com ${therapistName}`
              : "terapeuta disponível no horário"}
        </p>
      </div>
      <p className="who">
        Reservando como <strong>{profile.name}</strong>
      </p>
      {sendError && (
        <div className="field-error" role="alert">
          {failure?.unavailable && <p>Este horário já está reservado ou ficou indisponível.</p>}
          <p>{sendError}</p>
          {failure?.unavailable && waitlistState === "idle" && (
            <p>Lista de espera: você pode entrar para receber uma oferta se este horário for liberado.</p>
          )}
          {failure?.unavailable && waitlistState === "idle" && (
            <Button className="ghost-btn" type="button" onPress={() => void onJoinWaitlist()}>
              Entrar na lista de espera para este horário
            </Button>
          )}
          {waitlistState === "joining" && <p role="status">Entrando na lista de espera...</p>}
          {waitlistError && <p>{waitlistError}</p>}
          {waitlistState === "joined" && (
            <p>
              <Link className="link" to="/sessions#lista-de-espera">
                Ver lista de espera em Suas sessões
              </Link>
            </p>
          )}
        </div>
      )}
      {isWaitlistSelection ? (
        <Button
          id="confirmar"
          className="cta"
          type="button"
          onPress={onRequestWaitlist}
          isDisabled={start == null || waitlistState !== "idle"}
        >
          {waitlistState === "joined" ? "Na lista de espera" : "Aguardar uma vaga"}
        </Button>
      ) : (
        <Button id="confirmar" className="cta" type="submit" isDisabled={start == null || sending}>
          {start == null ? "Escolha um horário para confirmar" : sending ? "Reservando…" : "Confirmar reserva"}
        </Button>
      )}
    </form>
  );
}

interface DoneProps {
  booking: Booked;
  firstName: string;
  onAgain: () => void;
}

function Done({ booking, firstName, onAgain }: DoneProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="done">
      <span className="badge">RESERVA {booking.code}</span>
      <h3 id="done-t" ref={ref} tabIndex={-1} className="sum-line">
        Até {booking.when}, {firstName}.
      </h3>
      <p className="sum-meta">
        com {booking.therapist} · {booking.room}
        {booking.location ? `, ${booking.location}` : ""}
      </p>
      <p className="hint">Ao chegar, faça o check-in lendo o QR Code da sala.</p>
      <div className="row">
        <Link className="ghost-btn" to="/sessions">
          Ver suas sessões
        </Link>
        <Button className="ghost-btn" onPress={onAgain}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
