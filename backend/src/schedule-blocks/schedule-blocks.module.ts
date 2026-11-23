import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { BusinessRulesModule } from "../business-rules/business-rules.module";
import { ClockModule } from "../common/clock/clock.module";
import { PolicyService } from "../domain/policy.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ScheduleBlocksController } from "./schedule-blocks.controller";
import { ScheduleBlocksService } from "./schedule-blocks.service";

@Module({
  imports: [BusinessRulesModule, ClockModule, PrismaModule],
  controllers: [ScheduleBlocksController],
  providers: [AuditService, PolicyService, ScheduleBlocksService],
  exports: [ScheduleBlocksService],
})
export class ScheduleBlocksModule {}
