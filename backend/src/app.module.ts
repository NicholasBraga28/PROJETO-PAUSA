import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateEnvironment } from "./config/env.validation";
import { ClockModule } from "./common/clock/clock.module";
import { BusinessRulesModule } from "./business-rules/business-rules.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PolicyService } from "./domain/policy.service";
import { AuditService } from "./audit/audit.service";
import { AuthModule } from "./auth/auth.module";
import { BookingService } from "./booking/booking.service";
import { BookingController } from "./booking/booking.controller";
import { AdminService } from "./admin/admin.service";
import { AdminController } from "./admin/admin.controller";
import { HealthController } from "./health.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { AppointmentEventsModule } from "./booking/appointment-events.module";
import { WaitlistService } from "./waitlist/waitlist.service";
import { AppointmentAuditListener } from "./audit/appointment-audit.listener";
import { AttendanceModule } from "./attendance/attendance.module";
import { ReportsModule } from "./reports/reports.module";
import { AuditEventsModule } from "./audit/audit-events.module";
import { TherapistsModule } from "./therapists/therapists.module";
import { UsersModule } from "./users/users.module";
import { RoomsModule } from "./rooms/rooms.module";
import { AlexaModule } from "./alexa/alexa.module";
import { ScheduleBlocksModule } from "./schedule-blocks/schedule-blocks.module";
import { LocationsModule } from "./locations/locations.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { ChatModule } from "./chat/chat.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ClockModule,
    PrismaModule,
    BusinessRulesModule,
    AppointmentEventsModule,
    AuthModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    SchedulesModule,
    NotificationsModule,
    AttendanceModule,
    ReportsModule,
    AuditEventsModule,
    TherapistsModule,
    UsersModule,
    RoomsModule,
    AlexaModule,
    ScheduleBlocksModule,
    LocationsModule,
    FeedbackModule,
    ChatModule,
  ],
  controllers: [HealthController, BookingController, AdminController],
  providers: [PolicyService, AuditService, BookingService, AppointmentAuditListener, WaitlistService, AdminService],
})
export class AppModule {}
