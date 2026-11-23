import { Inject, Injectable } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import { CLOCK, Clock } from "../common/clock/clock";
import { AlexaRequestContext, SPEAKER_NAME_SLOT, deviceIdOf, resolvedSlotIdOf, slotValueOf } from "./alexa-request";
import { identifiedSpeakerOf } from "./alexa-session";
import { AlexaSpeakerResolver } from "./alexa-speaker-resolver";

@Injectable()
export class AlexaRequestContextResolver {
  constructor(
    private readonly speakers: AlexaSpeakerResolver,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async contextOf(envelope: RequestEnvelope): Promise<AlexaRequestContext> {
    const speaker = await this.speakers.resolve({
      deviceId: deviceIdOf(envelope),
      identifiedTherapistId: identifiedSpeakerOf(envelope),
      spokenName: {
        value: slotValueOf(envelope, SPEAKER_NAME_SLOT),
        resolvedId: resolvedSlotIdOf(envelope, SPEAKER_NAME_SLOT),
      },
      now: this.clock.now(),
    });
    return { speaker };
  }
}
