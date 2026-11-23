import { ConflictException } from "@nestjs/common";
import { messages } from "../messages/catalog";

export class StillWithinLateToleranceException extends ConflictException {
  constructor() {
    super(messages.errors.stillWithinLateTolerance);
  }
}
