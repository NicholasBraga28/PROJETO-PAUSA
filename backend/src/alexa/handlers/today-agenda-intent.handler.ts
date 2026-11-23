import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import { offersFullAgenda, todaySummarySpeechOf } from "../../notifications/therapist-agenda-speech";
import { spokenAgendaItemOf } from "../../therapists/therapist-agenda";
import { TherapistAgendaService } from "../../therapists/therapist-agenda.service";
import { AlexaReply, questionReplyOf, repeatableReplyOf } from "../alexa-reply";
import { identifiedSpeakerAttributesOf, pendingActionAttributesOf } from "../alexa-session";
import { SpeakerIntentHandler } from "./speaker-intent.handler";

@Injectable()
export class TodayAgendaIntentHandler extends SpeakerIntentHandler {
  protected readonly intentName = "TodayAgendaIntent";

  constructor(private readonly agenda: TherapistAgendaService) {
    super();
  }

  protected async replyFor(therapistId: string): Promise<AlexaReply> {
    const { current, next, remainingCount, items } = await this.agenda.agendaOf(therapistId);
    const speech = todaySummarySpeechOf({
      current: current && spokenAgendaItemOf(current),
      next: next && spokenAgendaItemOf(next),
      remainingCount,
      isEmpty: items.length === 0,
    });
    const attributes = identifiedSpeakerAttributesOf(therapistId);
    if (!offersFullAgenda(remainingCount)) return repeatableReplyOf(speech, attributes);
    return questionReplyOf(speech, messages.therapistAgenda.offerFullAgenda, {
      ...attributes,
      ...pendingActionAttributesOf({ kind: "READ_AGENDA", therapistId }),
    });
  }
}
