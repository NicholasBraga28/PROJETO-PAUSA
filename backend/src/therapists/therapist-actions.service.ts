import { AppointmentStatus, Prisma } from "@prisma/client";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { assertTransitionAllowed } from "../appointments/appointment-status";
import { AuditService } from "../audit/audit.service";
import { AppointmentEvents } from "../booking/appointment-events";
import { BusinessRulesService } from "../business-rules/business-rules.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { localTodayOf } from "../common/clock/local-day";
import { messages } from "../messages/catalog";
import {
  blockConfirmationOf,
  noShowMarkedSpeechOf,
  scheduleBlockedSpeechOf,
  sessionFinishedSpeechOf,
  sessionStartedSpeechOf,
  SpokenAppointment,
  therapistCancelledSpeechOf,
} from "../notifications/therapist-agenda-speech";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";
import { ScheduleBlocksService } from "../schedule-blocks/schedule-blocks.service";
import { SessionStartRefusedException } from "./session-start-refused.exception";
import { StillWithinLateToleranceException } from "./still-within-late-tolerance.exception";
import {
  AGENDA_APPOINTMENT_INCLUDE,
  AWAITING_SESSION_STATUSES,
  spokenAppointmentOf,
  startWindowPositionOf,
} from "./therapist-agenda";
import { TherapistAgendaService } from "./therapist-agenda.service";

const ACTION_APPOINTMENT_INCLUDE = {
  ...AGENDA_APPOINTMENT_INCLUDE,
  therapist: { select: { userId: true } },
} satisfies Prisma.AppointmentInclude;

type ActionAppointment = Prisma.AppointmentGetPayload<{ include: typeof ACTION_APPOINTMENT_INCLUDE }>;

type StartTargetOf = (transaction: Prisma.TransactionClient, now: Date) => Promise<ActionAppointment>;

export type TherapistActionResult = Readonly<{
  appointmentId: string;
  status: AppointmentStatus;
  spokenText: string;
}>;

export type BlockPeriod = Readonly<{ startsAt: Date; endsAt: Date }>;

export type TherapistBlockInput = BlockPeriod & Readonly<{ reason?: string }>;

export type TherapistBlockPreview = Readonly<{ confirmationText: string }>;

export type TherapistBlockResult = BlockPeriod &
  Readonly<{
    id: string;
    reason: string | null;
    spokenText: string;
  }>;

@Injectable()
export class TherapistActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly businessRules: BusinessRulesService,
    private readonly agenda: TherapistAgendaService,
    private readonly events: AppointmentEvents,
    private readonly notifications: NotificationService,
    private readonly scheduleBlocks: ScheduleBlocksService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  start(therapistId: string, appointmentId: string): Promise<TherapistActionResult> {
    return this.startSession(therapistId, (transaction) =>
      this.ownedAppointmentOf(transaction, therapistId, appointmentId),
    );
  }

  startCurrent(therapistId: string): Promise<TherapistActionResult> {
    return this.startSession(therapistId, async (transaction, now) => {
      await this.assertNoSessionInProgress(transaction, therapistId);
      const target = await this.closestStartableOf(transaction, therapistId, now);
      if (!target) throw new NotFoundException(messages.errors.noAppointmentToStart);
      return target;
    });
  }

  async finish(therapistId: string, appointmentId: string): Promise<TherapistActionResult> {
    return this.finishAppointment(await this.ownedAppointmentOf(this.prisma, therapistId, appointmentId));
  }

  async finishCurrent(therapistId: string): Promise<TherapistActionResult> {
    const inProgress = await this.sessionInProgressOf(this.prisma, therapistId);
    if (!inProgress) throw new NotFoundException(messages.errors.noSessionInProgress);
    return this.finishAppointment(inProgress);
  }

  async markNoShow(therapistId: string, appointmentId: string): Promise<TherapistActionResult> {
    const appointment = await this.ownedAppointmentOf(this.prisma, therapistId, appointmentId);
    if (appointment.status === "CONFIRMED") throw new StillWithinLateToleranceException();
    assertTransitionAllowed(appointment.id, { from: appointment.status, to: "NO_SHOW", actor: "THERAPIST" });
    await this.prisma.$transaction(async (transaction) => {
      await this.transition(transaction, appointment, { status: "NO_SHOW" });
      await this.notifications.cancelPendingOf(appointment.id, transaction);
    });
    const markedById = appointment.therapist.userId;
    await this.audit.record(markedById, "APPOINTMENT_MARKED_NO_SHOW", "Appointment", appointment.id);
    await this.events.emitNoShow({ appointmentId: appointment.id, therapistId, markedById });
    return {
      appointmentId: appointment.id,
      status: "NO_SHOW",
      spokenText: noShowMarkedSpeechOf(await this.upcomingOf(therapistId)),
    };
  }

  async cancel(therapistId: string, appointmentId: string): Promise<TherapistActionResult> {
    const appointment = await this.ownedAppointmentOf(this.prisma, therapistId, appointmentId);
    assertTransitionAllowed(appointment.id, { from: appointment.status, to: "CANCELLED", actor: "THERAPIST" });
    const cancelledById = appointment.therapist.userId;
    const cancelledAt = this.clock.now();
    await this.prisma.$transaction(async (transaction) => {
      await this.transition(transaction, appointment, { status: "CANCELLED", cancelledAt, cancelledById });
      await this.notifications.cancelPendingOf(appointment.id, transaction);
    });
    await this.events.emitCancelled({
      appointmentId: appointment.id,
      employeeId: appointment.employeeId,
      cancelledById,
      cancelledByRole: "THERAPIST",
    });
    return { appointmentId: appointment.id, status: "CANCELLED", spokenText: therapistCancelledSpeechOf() };
  }

  async previewBlock(therapistId: string, period: BlockPeriod): Promise<TherapistBlockPreview> {
    await this.scheduleBlocks.preview({ therapistId, ...period });
    return { confirmationText: blockConfirmationOf(period.startsAt, period.endsAt, this.clock.now()) };
  }

  async block(therapistId: string, actorId: string, input: TherapistBlockInput): Promise<TherapistBlockResult> {
    const { id, startsAt, endsAt, reason } = await this.scheduleBlocks.create({ therapistId, actorId, ...input });
    return { id, startsAt, endsAt, reason, spokenText: scheduleBlockedSpeechOf() };
  }

  private async startSession(therapistId: string, targetOf: StartTargetOf): Promise<TherapistActionResult> {
    const now = this.clock.now();
    const started = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 FROM therapists WHERE id = ${therapistId}::uuid FOR UPDATE`;
      const appointment = await targetOf(transaction, now);
      this.assertCanStart(appointment, now);
      await this.assertNoSessionInProgress(transaction, therapistId);
      await this.transition(transaction, appointment, { status: "IN_PROGRESS", sessionStartedAt: now });
      return appointment;
    });
    await this.audit.record(started.therapist.userId, "SESSION_STARTED", "Appointment", started.id);
    return {
      appointmentId: started.id,
      status: "IN_PROGRESS",
      spokenText: sessionStartedSpeechOf(spokenAppointmentOf(started)),
    };
  }

  private async finishAppointment(appointment: ActionAppointment): Promise<TherapistActionResult> {
    assertTransitionAllowed(appointment.id, { from: appointment.status, to: "COMPLETED", actor: "THERAPIST" });
    await this.transition(this.prisma, appointment, { status: "COMPLETED", sessionEndedAt: this.clock.now() });
    await this.audit.record(appointment.therapist.userId, "SESSION_FINISHED", "Appointment", appointment.id);
    return {
      appointmentId: appointment.id,
      status: "COMPLETED",
      spokenText: sessionFinishedSpeechOf(await this.upcomingOf(appointment.therapistId)),
    };
  }

  private async upcomingOf(therapistId: string): Promise<SpokenAppointment | null> {
    const { current, next } = await this.agenda.agendaOf(therapistId);
    const upcoming = current ?? next;
    return (
      upcoming && {
        firstName: upcoming.employee.firstName,
        startsAt: new Date(upcoming.startsAt),
        endsAt: new Date(upcoming.endsAt),
      }
    );
  }

  private assertCanStart(appointment: ActionAppointment, now: Date): void {
    assertTransitionAllowed(appointment.id, { from: appointment.status, to: "IN_PROGRESS", actor: "THERAPIST" });
    const position = startWindowPositionOf(appointment, now, this.checkInEarlyMinutes());
    if (position === "BEFORE") throw new SessionStartRefusedException(messages.errors.sessionNotOpenYet);
    if (position === "AFTER") throw new SessionStartRefusedException(messages.errors.sessionTimeOver);
  }

  private async transition(
    client: Prisma.TransactionClient,
    appointment: ActionAppointment,
    data: Prisma.AppointmentUncheckedUpdateManyInput,
  ): Promise<void> {
    const result = await client.appointment.updateMany({
      where: { id: appointment.id, therapistId: appointment.therapistId, status: appointment.status },
      data,
    });
    if (result.count !== 1) throw new ConflictException(messages.errors.appointmentChangedMeanwhile);
  }

  private async closestStartableOf(
    client: Prisma.TransactionClient,
    therapistId: string,
    now: Date,
  ): Promise<ActionAppointment | null> {
    const today = localTodayOf(now);
    const awaiting = await client.appointment.findMany({
      where: {
        therapistId,
        status: { in: [...AWAITING_SESSION_STATUSES] },
        startsAt: { gte: today.startsAt, lt: today.endsAt },
        endsAt: { gt: now },
      },
      include: ACTION_APPOINTMENT_INCLUDE,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    const distanceOf = (appointment: ActionAppointment) => Math.abs(appointment.startsAt.getTime() - now.getTime());
    return awaiting
      .filter((appointment) => startWindowPositionOf(appointment, now, this.checkInEarlyMinutes()) === "INSIDE")
      .reduce<ActionAppointment | null>(
        (closest, candidate) => (closest && distanceOf(closest) <= distanceOf(candidate) ? closest : candidate),
        null,
      );
  }

  private async ownedAppointmentOf(
    client: Prisma.TransactionClient,
    therapistId: string,
    appointmentId: string,
  ): Promise<ActionAppointment> {
    const appointment = await client.appointment.findFirst({
      where: { id: appointmentId, therapistId },
      include: ACTION_APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundException(messages.errors.appointmentNotFound);
    return appointment;
  }

  private sessionInProgressOf(
    client: Prisma.TransactionClient,
    therapistId: string,
  ): Promise<ActionAppointment | null> {
    return client.appointment.findFirst({
      where: { therapistId, status: "IN_PROGRESS" },
      include: ACTION_APPOINTMENT_INCLUDE,
    });
  }

  private async assertNoSessionInProgress(client: Prisma.TransactionClient, therapistId: string): Promise<void> {
    const inProgress = await this.sessionInProgressOf(client, therapistId);
    if (inProgress) {
      throw new SessionStartRefusedException(
        messages.errors.anotherSessionInProgress(spokenAppointmentOf(inProgress).firstName),
      );
    }
  }

  private checkInEarlyMinutes(): number {
    return this.businessRules.current().checkInEarlyMinutes;
  }
}
