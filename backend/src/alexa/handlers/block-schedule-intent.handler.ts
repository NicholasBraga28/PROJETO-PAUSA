import { Inject, Injectable } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import { BusinessRulesService } from "../../business-rules/business-rules.service";
import { CLOCK, Clock } from "../../common/clock/clock";
import { messages } from "../../messages/catalog";
import { TherapistActionsService } from "../../therapists/therapist-actions.service";
import type { AlexaReply } from "../alexa-reply";
import { slotValueOf } from "../alexa-request";
import { PendingActionsService } from "../pending-actions.service";
import { spokenPeriodOf, todayAt } from "../spoken-time";
import { ConfirmableIntentHandler } from "./confirmable-intent.handler";

const START_TIME_SLOT = "startTime";
const END_TIME_SLOT = "endTime";

@Injectable()
export class BlockScheduleIntentHandler extends ConfirmableIntentHandler {
  protected readonly intentName = "BlockScheduleIntent";

  constructor(
    pendingActions: PendingActionsService,
    private readonly actions: TherapistActionsService,
    private readonly businessRules: BusinessRulesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(pendingActions);
  }

  protected async questionFor(therapistId: string, envelope: RequestEnvelope): Promise<AlexaReply> {
    const { workStartMinutes, workEndMinutes } = this.businessRules.current();
    const period = spokenPeriodOf(slotValueOf(envelope, START_TIME_SLOT), slotValueOf(envelope, END_TIME_SLOT), {
      startMinutes: workStartMinutes,
      endMinutes: workEndMinutes,
    });
    if (period.kind === "VAGUE") return this.replyOf(messages.alexa.vagueBlockPeriod, therapistId);
    if (period.kind === "REFUSED") return this.replyOf(messages.alexa.blockPeriodRefused, therapistId);
    const now = this.clock.now();
    const [startsAt, endsAt] = [todayAt(period.startsAt, now), todayAt(period.endsAt, now)];
    const { confirmationText } = await this.actions.previewBlock(therapistId, { startsAt, endsAt });
    return this.confirmationOf(confirmationText, envelope, {
      kind: "BLOCK",
      therapistId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  }
}
