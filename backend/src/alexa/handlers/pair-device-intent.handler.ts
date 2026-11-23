import { Injectable } from "@nestjs/common";
import { messages } from "../../messages/catalog";
import type { AlexaIntentHandler } from "../alexa-intent-handler";
import { AlexaReply, finalReplyOf, openReplyOf } from "../alexa-reply";
import { AlexaRequest, deviceIdOf, intentNameOf, slotValueOf } from "../alexa-request";
import { identifiedSpeakerAttributesOf } from "../alexa-session";
import { DevicePairingService } from "../device-pairing.service";
import { PairingCodeRejectedException } from "../pairing-code-rejected.exception";

const CODE_SLOT = "code";

@Injectable()
export class PairDeviceIntentHandler implements AlexaIntentHandler {
  constructor(private readonly pairings: DevicePairingService) {}

  canHandle({ envelope }: AlexaRequest): boolean {
    return intentNameOf(envelope) === "PairDeviceIntent";
  }

  async handle({ envelope }: AlexaRequest): Promise<AlexaReply> {
    const deviceId = deviceIdOf(envelope);
    if (!deviceId) return finalReplyOf(messages.alexa.pairingCodeRejected);
    try {
      const { therapistId, firstName } = await this.pairings.pair(deviceId, slotValueOf(envelope, CODE_SLOT));
      return openReplyOf(messages.alexa.devicePaired(firstName), identifiedSpeakerAttributesOf(therapistId));
    } catch (error) {
      if (error instanceof PairingCodeRejectedException) return finalReplyOf(messages.alexa.pairingCodeRejected);
      throw error;
    }
  }
}
