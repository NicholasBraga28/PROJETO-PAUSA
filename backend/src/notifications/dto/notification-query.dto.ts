import { NotificationStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, isISO8601, Max, Min, ValidateBy } from "class-validator";
import { messages } from "../../messages/catalog";

const INSTANT_WITH_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const isInstantWithOffset = (value: unknown): boolean =>
  typeof value === "string" && isISO8601(value, { strict: true }) && INSTANT_WITH_OFFSET.test(value);

const IsInstantWithOffset = () =>
  ValidateBy({
    name: "isInstantWithOffset",
    validator: {
      validate: isInstantWithOffset,
      defaultMessage: () => messages.errors.invalidNotificationsSince,
    },
  });

export class NotificationQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  readonly status?: NotificationStatus;

  @IsOptional()
  @IsInstantWithOffset()
  readonly since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;

  @IsOptional()
  @IsUUID()
  readonly cursor?: string;
}
