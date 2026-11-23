import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class PeriodDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}

export class CreateAppointmentDto extends PeriodDto {
  @IsUUID() therapistId!: string;
  @IsUUID() roomId!: string;
}

export class AvailabilityDto extends PeriodDto {
  @IsUUID() roomId!: string;
}

export class JoinWaitlistDto extends PeriodDto {
  @IsOptional() @IsUUID() therapistId?: string;
}
