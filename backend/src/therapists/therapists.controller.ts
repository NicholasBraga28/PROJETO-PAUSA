import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { QueryAgendaDto } from "./dto/query-agenda.dto";
import { TherapistBlockDto } from "./dto/therapist-block.dto";
import { TherapistActionsService } from "./therapist-actions.service";
import { TherapistAgendaService } from "./therapist-agenda.service";
import { TherapistProfileService } from "./therapist-profile.service";

@Controller("therapists/me")
@Roles("THERAPIST")
export class TherapistsController {
  constructor(
    private readonly profiles: TherapistProfileService,
    private readonly agenda: TherapistAgendaService,
    private readonly actions: TherapistActionsService,
  ) {}

  @Get("agenda")
  async getAgenda(@CurrentActor() actor: RequestActor, @Query() query: QueryAgendaDto) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.agenda.agendaOf(therapistId, query.date);
  }

  @Get("arrivals")
  async getArrivals(@CurrentActor() actor: RequestActor) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.agenda.arrivalsOf(therapistId);
  }

  @Post("appointments/:id/start")
  async startAppointment(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.start(therapistId, id);
  }

  @Post("sessions/current/start")
  async startCurrentSession(@CurrentActor() actor: RequestActor) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.startCurrent(therapistId);
  }

  @Post("appointments/:id/finish")
  async finishAppointment(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.finish(therapistId, id);
  }

  @Post("appointments/:id/no-show")
  async markNoShow(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.markNoShow(therapistId, id);
  }

  @Post("appointments/:id/cancel")
  async cancelAppointment(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.cancel(therapistId, id);
  }

  @Post("schedule-blocks/preview")
  @HttpCode(HttpStatus.OK)
  async previewScheduleBlock(@CurrentActor() actor: RequestActor, @Body() input: TherapistBlockDto) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.previewBlock(therapistId, {
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
  }

  @Post("schedule-blocks")
  async createScheduleBlock(@CurrentActor() actor: RequestActor, @Body() input: TherapistBlockDto) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.block(therapistId, actor.id, {
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: input.reason,
    });
  }

  @Post("sessions/current/finish")
  async finishCurrentSession(@CurrentActor() actor: RequestActor) {
    const therapistId = await this.profiles.therapistIdOf(actor.id);
    return this.actions.finishCurrent(therapistId);
  }
}
