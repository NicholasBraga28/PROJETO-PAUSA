import { Module } from "@nestjs/common";
import { AppointmentEventsModule } from "../booking/appointment-events.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DatabaseNotificationChannel } from "./database-notification-channel";
import { NOTIFICATION_CHANNEL } from "./notification-channel";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { TherapistCancellationNoticeListener } from "./therapist-cancellation-notice.listener";

@Module({
  imports: [AppointmentEventsModule, PrismaModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    TherapistCancellationNoticeListener,
    DatabaseNotificationChannel,
    { provide: NOTIFICATION_CHANNEL, useExisting: DatabaseNotificationChannel },
  ],
  exports: [NotificationService, NOTIFICATION_CHANNEL],
})
export class NotificationsModule {}
