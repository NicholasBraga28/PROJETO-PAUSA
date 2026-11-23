import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AppointmentStatus, NotificationKind } from "@prisma/client";
import { assertTransitionAllowed } from "../../appointments/appointment-status";
import { BusinessRulesService } from "../../business-rules/business-rules.service";
import { CLOCK, Clock } from "../../common/clock/clock";
import { firstNameOf } from "../../common/names/first-name";
import { messages } from "../../messages/catalog";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../../notifications/notification-channel";
import { PrismaService } from "../../prisma/prisma.service";
import { atTimeOf } from "../../notifications/spoken-text";

type OverdueAppointment = Readonly<{
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  employee: Readonly<{ name: string }>;
  therapist: Readonly<{ user: Readonly<{ id: string }> }>;
  room: Readonly<{ name: string }>;
}>;

@Injectable()
export class AttendanceToleranceJob {
  private readonly logger = new Logger(AttendanceToleranceJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(NOTIFICATION_CHANNEL) private readonly notificationChannel: NotificationChannel,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.clock.now();
      const overdueAppointments = await this.findOverdueAppointments(now);
      for (const appointment of overdueAppointments) await this.markPossibleNoShow(appointment, now);
    } finally {
      this.running = false;
    }
  }

  private async findOverdueAppointments(now: Date): Promise<OverdueAppointment[]> {
    const lateArrivalToleranceMs = this.businessRules.current().lateArrivalToleranceMinutes * 60_000;
    const latestEligibleStart = new Date(now.getTime() - lateArrivalToleranceMs);
    return this.prisma.appointment.findMany({
      where: { status: "CONFIRMED", checkedInAt: null, startsAt: { lte: latestEligibleStart } },
      include: {
        employee: { select: { name: true } },
        therapist: { include: { user: { select: { id: true } } } },
        room: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
    });
  }

  private async markPossibleNoShow(appointment: OverdueAppointment, now: Date): Promise<void> {
    try {
      assertTransitionAllowed(appointment.id, { from: appointment.status, to: "POSSIBLE_NO_SHOW", actor: "SYSTEM" });
      const updated = await this.prisma.appointment.updateMany({
        where: { id: appointment.id, status: "CONFIRMED", checkedInAt: null },
        data: { status: "POSSIBLE_NO_SHOW" },
      });
      if (updated.count !== 1) return;
      const text = messages.notifications.possibleNoShow(
        firstNameOf(appointment.employee.name),
        atTimeOf(appointment.startsAt),
        appointment.room.name,
      );
      await this.notificationChannel.notify({
        appointmentId: appointment.id,
        recipientId: appointment.therapist.user.id,
        kind: NotificationKind.POSSIBLE_NO_SHOW,
        scheduledFor: now,
        message: text,
        spokenText: text,
      });
    } catch {
      this.logger.error(`Could not mark possible no-show appointmentId=${appointment.id}`);
    }
  }
}
