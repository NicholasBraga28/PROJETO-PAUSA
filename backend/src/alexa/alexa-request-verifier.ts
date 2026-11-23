import type { IncomingHttpHeaders } from "node:http";
import { Injectable, Logger } from "@nestjs/common";
import { SkillRequestSignatureVerifier } from "ask-sdk-express-adapter";

export interface AlexaRequestVerifier {
  verify(rawBody: string, headers: IncomingHttpHeaders): Promise<boolean>;
}

export const ALEXA_REQUEST_VERIFIER = Symbol("ALEXA_REQUEST_VERIFIER");

@Injectable()
export class AskSdkAlexaRequestVerifier implements AlexaRequestVerifier {
  private readonly signature = new SkillRequestSignatureVerifier();
  private readonly logger = new Logger(AskSdkAlexaRequestVerifier.name);

  async verify(rawBody: string, headers: IncomingHttpHeaders): Promise<boolean> {
    try {
      await this.signature.verify(rawBody, headers);
      return true;
    } catch (error) {
      this.logger.warn(`Signature check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
