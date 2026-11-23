import { IsDateString, IsUUID } from "class-validator";

export class JoinWaitlistDto {
  @IsUUID() therapistId!: string;
  @IsUUID() locationId!: string;
  @IsDateString() desiredStartsAt!: string;
  @IsDateString() desiredEndsAt!: string;
}
