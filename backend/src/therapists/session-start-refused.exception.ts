import { ConflictException } from "@nestjs/common";

export class SessionStartRefusedException extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}
