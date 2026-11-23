import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { ACTIVE_STATUSES } from "../appointments/appointment-status";
import { AuditService } from "../audit/audit.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { LOCAL_TIMEZONE, localDateOf } from "../common/clock/local-day";
import { PolicyService } from "../domain/policy.service";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { inSerializableTransaction } from "../prisma/serializable-transaction";
import { ScheduleBlockDto } from "./dto/schedule-block.dto";
import { ScheduleBlockHasAppointmentsException } from "./schedule-block-has-appointments.exception";

const AUDIT_ENTITY = "ScheduleBlock";

const SCHEDULE_BLOCK_SELECT = {
  id: true,
  therapistId: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  createdById: true,
  createdAt: true,
} satisfies Prisma.ScheduleBlockSelect;

const BLOCKED_APPOINTMENT_SELECT = {
  id: true,
  startsAt: true,
  endsAt: true,
  employee: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentSelect;

export type PlannedBlock = Readonly<{ therapistId: string; startsAt: Date; endsAt: Date }>;

export type NewScheduleBlock = PlannedBlock & Readonly<{ actorId: string; reason?: string }>;

const overlapping = ({ startsAt, endsAt }: PlannedBlock) => ({ startsAt: { lt: endsAt }, endsAt: { gt: startsAt } });

@Injectable()
export class ScheduleBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async preview(planned: PlannedBlock): Promise<void> {
    await this.assertCanBlock(this.prisma, planned);
  }

  async create({ actorId, reason, ...planned }: NewScheduleBlock): Promise<ScheduleBlockDto> {
    const scheduleBlock = await inSerializableTransaction(this.prisma, async (tx) => {
      await this.assertCanBlock(tx, planned);
      return tx.scheduleBlock.create({
        data: { ...planned, reason, createdById: actorId },
        select: SCHEDULE_BLOCK_SELECT,
      });
    });
    await this.audit.record(actorId, "SCHEDULE_BLOCK_CREATED", AUDIT_ENTITY, scheduleBlock.id, {
      therapistId: scheduleBlock.therapistId,
      startsAt: scheduleBlock.startsAt.toISOString(),
      endsAt: scheduleBlock.endsAt.toISOString(),
    });
    return scheduleBlock;
  }

  private async assertCanBlock(client: Prisma.TransactionClient, planned: PlannedBlock): Promise<void> {
    const { startsAt, endsAt } = planned;
    this.policy.assertPeriod(startsAt, endsAt);
    if (startsAt < this.clock.now()) throw new BadRequestException(messages.errors.scheduleBlockInPast);
    if (localDateOf(startsAt) !== localDateOf(endsAt)) {
      throw new BadRequestException(messages.errors.scheduleBlockSpansDays);
    }
    if (!this.policy.isWithinWorkingHours(startsAt, endsAt, LOCAL_TIMEZONE)) {
      throw new BadRequestException(messages.errors.scheduleBlockOutsideOperatingHours);
    }
    await this.assertActiveTherapist(client, planned.therapistId);
    const alreadyBlocked = await client.scheduleBlock.findFirst({
      where: { therapistId: planned.therapistId, ...overlapping(planned) },
      select: { id: true },
    });
    if (alreadyBlocked) throw new ConflictException(messages.errors.scheduleAlreadyBlocked);
    const [first, ...others] = await client.appointment.findMany({
      where: { therapistId: planned.therapistId, status: { in: [...ACTIVE_STATUSES] }, ...overlapping(planned) },
      select: BLOCKED_APPOINTMENT_SELECT,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    if (first) throw new ScheduleBlockHasAppointmentsException([first, ...others]);
  }

  private async assertActiveTherapist(client: Prisma.TransactionClient, id: string): Promise<void> {
    const therapist = await client.therapist.findUnique({ where: { id }, include: { user: true } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistNotFound);
    if (therapist.user.status !== UserStatus.ACTIVE) throw new BadRequestException(messages.errors.therapistInactive);
  }
}
