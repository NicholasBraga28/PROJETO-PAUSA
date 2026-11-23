import { Body, Controller, Post } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { CreateScheduleBlockDto } from "./dto/create-schedule-block.dto";
import { ScheduleBlocksService } from "./schedule-blocks.service";

@Controller("schedule-blocks")
@Roles("HR", "ADMIN")
export class ScheduleBlocksController {
  constructor(private readonly scheduleBlocks: ScheduleBlocksService) {}

  @Post()
  create(@CurrentActor() actor: RequestActor, @Body() input: CreateScheduleBlockDto) {
    return this.scheduleBlocks.create({
      therapistId: input.therapistId,
      actorId: actor.id,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: input.reason,
    });
  }
}
