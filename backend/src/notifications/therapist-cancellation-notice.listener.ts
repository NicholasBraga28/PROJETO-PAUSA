import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { AppointmentCancelledEvent, AppointmentEvents } from "../booking/appointment-events";
import { CLOCK, Clock } from "../common/clock/clock";
import { firstNameOf } from "../common/names/first-name";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "./notification-channel";
import { cancelledByTherapistNoticeOf } from "./therapist-agenda-speech";

@Injectable()
export class TherapistCancellationNoticeListener implements OnModuleInit {
  constructor(
    private readonly events: AppointmentEvents,
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private readonly notificationChannel: NotificationChannel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.events.onCancelled((event) => this.noticeEmployee(event));
  }

  private async noticeEmployee(event: AppointmentCancelledEvent): Promise<void> {
    const isCancelledByTherapist = event.cancelledByRole === "THERAPIST";
    if (!isCancelledByTherapist) return;
    const appointment = await this.prisma.appointment.findUniqueOrThrow({
      where: { id: event.appointmentId },
      select: { startsAt: true, therapist: { select: { user: { select: { name: true } } } } },
    });
    const notice = cancelledByTherapistNoticeOf(appointment.startsAt, firstNameOf(appointment.therapist.user.name));
    await this.notificationChannel.notify({
      recipientId: event.employeeId,
      appointmentId: event.appointmentId,
      kind: "APPOINTMENT_CANCELLED_BY_THERAPIST",
      message: notice,
      spokenText: notice,
      scheduledFor: this.clock.now(),
    });
  }
}
