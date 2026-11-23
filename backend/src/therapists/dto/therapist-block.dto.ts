import { IsOptional, IsString, MaxLength } from "class-validator";
import { PeriodDto } from "../../common/dto";
import { MAX_BLOCK_REASON_LENGTH } from "../../schedule-blocks/dto/create-schedule-block.dto";

export class TherapistBlockDto extends PeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BLOCK_REASON_LENGTH)
  readonly reason?: string;
}
