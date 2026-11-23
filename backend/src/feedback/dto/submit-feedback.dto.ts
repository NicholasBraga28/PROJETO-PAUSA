import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const trimComment = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class SubmitFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  bookingEase!: number;

  @IsInt()
  @Min(1)
  @Max(4)
  technologySatisfaction!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  serviceRating!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  recommendationScore!: number;

  @Transform(trimComment)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
