import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { BusinessRulesService } from "../business-rules/business-rules.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { LOCAL_TIMEZONE, LocalDay, localDateOf, localDayOf, localTodayOf } from "../common/clock/local-day";
import { messages } from "../messages/catalog";
import {
  arrivalsSpeechOf,
  otherDayAgendaSpeechOf,
  todayAgendaSpeechOf,
} from "../notifications/therapist-agenda-speech";
import { PrismaService } from "../prisma/prisma.service";
import { datePartsAt, isValidLocalDate } from "../reports/report-date";
import {
  AGENDA_APPOINTMENT_INCLUDE,
  AgendaActionContext,
  AgendaActionKind,
  AgendaAppointment,
  AgendaItem,
  agendaItemOf,
  currentOf,
  HIDDEN_FROM_AGENDA_STATUSES,
  isRemaining,
  nextOf,
  spokenAppointmentOf,
  TherapistAgenda,
  TherapistArrivals,
} from "./therapist-agenda";

export type LocalTime = Readonly<{ hour: number; minute: number }>;

export type TodayAppointmentsQuery = Readonly<{
  localTimes: readonly LocalTime[];
  action: AgendaActionKind;
}>;

type DayAgenda = Readonly<{
  day: LocalDay;
  now: Date;
  appointments: readonly AgendaAppointment[];
  context: AgendaActionContext;
}>;

@Injectable()
export class TherapistAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async agendaOf(therapistId: string, date?: string): Promise<TherapistAgenda> {
    const now = this.clock.now();
    const day = localDayOf(this.agendaDateOf(date, now));
    const appointments = await this.findAppointments(therapistId, day);
    const dayAgenda = { day, now, appointments, context: await this.actionContextOf(therapistId, now) };
    return day.date === localDateOf(now) ? this.todayAgendaOf(dayAgenda) : this.otherDayAgendaOf(dayAgenda);
  }

  async arrivalsOf(therapistId: string): Promise<TherapistArrivals> {
    const now = this.clock.now();
    const today = localTodayOf(now);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        therapistId,
        startsAt: { gte: today.startsAt, lt: today.endsAt },
        checkedInAt: { not: null },
        status: { not: "CANCELLED" },
      },
      include: AGENDA_APPOINTMENT_INCLUDE,
      orderBy: [{ checkedInAt: "asc" }, { id: "asc" }],
    });
    const context = await this.actionContextOf(therapistId, now);
    const latest = appointments.at(-1);
    return {
      items: appointments.map((appointment) => agendaItemOf(appointment, context)),
      spokenText: arrivalsSpeechOf(
        latest?.checkedInAt ? { ...spokenAppointmentOf(latest), checkedInAt: latest.checkedInAt } : null,
        appointments.length,
      ),
    };
  }

  async findTodayAppointments(therapistId: string, query: TodayAppointmentsQuery): Promise<AgendaItem[]> {
    const { items } = await this.agendaOf(therapistId);
    return items.filter(
      (item) => startsAtOneOf(item, query.localTimes) && item.actions.some((action) => action.kind === query.action),
    );
  }

  private agendaDateOf(date: string | undefined, now: Date): string {
    if (date === undefined) return localDateOf(now);
    if (!isValidLocalDate(date)) throw new BadRequestException(messages.errors.invalidAgendaDate);
    return date;
  }

  private findAppointments(therapistId: string, day: LocalDay): Promise<AgendaAppointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        therapistId,
        startsAt: { gte: day.startsAt, lt: day.endsAt },
        status: { notIn: [...HIDDEN_FROM_AGENDA_STATUSES] },
      },
      include: AGENDA_APPOINTMENT_INCLUDE,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
  }

  private async actionContextOf(therapistId: string, now: Date): Promise<AgendaActionContext> {
    const sessionsInProgress = await this.prisma.appointment.count({ where: { therapistId, status: "IN_PROGRESS" } });
    return {
      now,
      checkInEarlyMinutes: this.businessRules.current().checkInEarlyMinutes,
      hasSessionInProgress: sessionsInProgress > 0,
    };
  }

  private todayAgendaOf({ day, now, appointments, context }: DayAgenda): TherapistAgenda {
    const current = currentOf(appointments, now);
    const next = nextOf(appointments, now, current);
    const remainingCount = appointments.filter((appointment) => isRemaining(appointment, now, true)).length;
    const itemOf = (appointment: AgendaAppointment) => agendaItemOf(appointment, context);
    return {
      date: day.date,
      isToday: true,
      current: current && itemOf(current),
      next: next && itemOf(next),
      remainingCount,
      items: appointments.map(itemOf),
      spokenText: todayAgendaSpeechOf({
        current: current && spokenAppointmentOf(current),
        next: next && spokenAppointmentOf(next),
        remainingCount,
        isEmpty: appointments.length === 0,
      }),
    };
  }

  private otherDayAgendaOf({ day, now, appointments, context }: DayAgenda): TherapistAgenda {
    const [first] = appointments;
    return {
      date: day.date,
      isToday: false,
      current: null,
      next: null,
      remainingCount: appointments.filter((appointment) => isRemaining(appointment, now, false)).length,
      items: appointments.map((appointment) => agendaItemOf(appointment, context)),
      spokenText: otherDayAgendaSpeechOf({
        dayStartsAt: day.startsAt,
        now,
        count: appointments.length,
        first: first ? spokenAppointmentOf(first) : null,
      }),
    };
  }
}

function startsAtOneOf(item: AgendaItem, localTimes: readonly LocalTime[]): boolean {
  const { hour, minute } = datePartsAt(new Date(item.startsAt), LOCAL_TIMEZONE);
  return localTimes.some((localTime) => localTime.hour === hour && localTime.minute === minute);
}
