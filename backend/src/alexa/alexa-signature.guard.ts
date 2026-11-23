import { BadRequestException, CanActivate, ExecutionContext, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RequestEnvelope } from "ask-sdk-model";
import type { Request } from "express";
import { CLOCK, Clock } from "../common/clock/clock";
import { ALEXA_REQUEST_VERIFIER, AlexaRequestVerifier } from "./alexa-request-verifier";

export const ALEXA_TIMESTAMP_TOLERANCE_MS = 150_000;

type AlexaRefusalReason = "signature_rejected" | "timestamp_out_of_tolerance" | "other_skill";

type AlexaHttpRequest = Request & { rawBody?: Buffer; body?: Partial<RequestEnvelope> };

const NO_ID = "none";

const applicationIdOf = (envelope: Partial<RequestEnvelope>): string | undefined =>
  envelope.context?.System?.application?.applicationId ?? envelope.session?.application?.applicationId;

@Injectable()
export class AlexaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(AlexaSignatureGuard.name);

  constructor(
    @Inject(ALEXA_REQUEST_VERIFIER) private readonly verifier: AlexaRequestVerifier,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AlexaHttpRequest>();
    const envelope = request.body ?? {};
    const reason = await this.refusalReasonOf(request, envelope);
    if (!reason) return true;
    this.logger.warn(
      `Alexa request refused: reason=${reason} requestId=${envelope.request?.requestId ?? NO_ID} applicationId=${applicationIdOf(envelope) ?? NO_ID}`,
    );
    throw new BadRequestException();
  }

  private async refusalReasonOf(
    request: AlexaHttpRequest,
    envelope: Partial<RequestEnvelope>,
  ): Promise<AlexaRefusalReason | undefined> {
    const verified = request.rawBody && (await this.verifier.verify(request.rawBody.toString("utf8"), request.headers));
    if (!verified) return "signature_rejected";
    if (!this.isOnTime(envelope.request?.timestamp)) return "timestamp_out_of_tolerance";
    if (!this.isThisSkill(applicationIdOf(envelope))) return "other_skill";
    return undefined;
  }

  private isThisSkill(applicationId: string | undefined): boolean {
    const skillId = this.config.get<string>("ALEXA_SKILL_ID");
    return Boolean(skillId) && applicationId === skillId;
  }

  private isOnTime(timestamp: string | undefined): boolean {
    const sentAt = Date.parse(timestamp ?? "");
    return Math.abs(this.clock.now().getTime() - sentAt) <= ALEXA_TIMESTAMP_TOLERANCE_MS;
  }
}
