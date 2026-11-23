import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export const MAX_BLOCK_REASON_LENGTH = 200;

export class CreateScheduleBlockDto {
  @IsUUID()
  readonly therapistId!: string;

  @IsDateString()
  readonly startsAt!: string;

  @IsDateString()
  readonly endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_BLOCK_REASON_LENGTH)
  readonly reason?: string;
}
