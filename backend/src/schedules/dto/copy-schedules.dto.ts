import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsISO8601, IsOptional, IsUUID, Matches } from "class-validator";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TARGET_DATES = 31;

export class CopySchedulesDto {
  @Matches(LOCAL_DATE_PATTERN)
  @IsISO8601({ strict: true })
  readonly sourceDate!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_TARGET_DATES)
  @Matches(LOCAL_DATE_PATTERN, { each: true })
  @IsISO8601({ strict: true }, { each: true })
  readonly targetDates!: string[];

  @IsOptional()
  @IsUUID()
  readonly therapistId?: string;
}
