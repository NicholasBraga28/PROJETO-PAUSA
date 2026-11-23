export type ScheduleBlockDto = Readonly<{
  id: string;
  therapistId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  createdById: string;
  createdAt: Date;
}>;
