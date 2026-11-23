import { BadRequestException } from "@nestjs/common";
import { messages } from "../messages/catalog";

export class PairingCodeRejectedException extends BadRequestException {
  constructor() {
    super(messages.alexa.pairingCodeRejected);
  }
}
