import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type { RequestEnvelope, ResponseEnvelope } from "ask-sdk-model";
import { Public } from "../auth/decorators/public.decorator";
import { AlexaDispatcher } from "./alexa-dispatcher";
import { AlexaResponseBuilder } from "./alexa-response-builder";
import { AlexaSignatureGuard } from "./alexa-signature.guard";

@Public()
@UseGuards(AlexaSignatureGuard)
@Controller("alexa")
export class AlexaController {
  constructor(
    private readonly dispatcher: AlexaDispatcher,
    private readonly responses: AlexaResponseBuilder,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(@Body() envelope: RequestEnvelope): Promise<ResponseEnvelope> {
    return this.responses.responseOf(await this.dispatcher.dispatch(envelope));
  }
}
