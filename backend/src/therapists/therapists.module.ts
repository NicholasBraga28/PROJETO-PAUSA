import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AppointmentEventsModule } from "../booking/appointment-events.module";
import { BusinessRulesModule } from "../business-rules/business-rules.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ScheduleBlocksModule } from "../schedule-blocks/schedule-blocks.module";
import { TherapistActionsService } from "./therapist-actions.service";
import { TherapistAgendaService } from "./therapist-agenda.service";
import { TherapistProfileService } from "./therapist-profile.service";
import { TherapistsController } from "./therapists.controller";

@Module({
  imports: [AppointmentEventsModule, BusinessRulesModule, NotificationsModule, PrismaModule, ScheduleBlocksModule],
  controllers: [TherapistsController],
  providers: [AuditService, TherapistActionsService, TherapistAgendaService, TherapistProfileService],
  exports: [TherapistActionsService, TherapistAgendaService, TherapistProfileService],
})
export class TherapistsModule {}
