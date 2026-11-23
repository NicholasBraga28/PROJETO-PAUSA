import { Inject, Injectable } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { CLOCK, Clock } from "../common/clock/clock";
import { firstNameOf } from "../common/names/first-name";
import { PrismaService } from "../prisma/prisma.service";
import { PairingCodeRejectedException } from "./pairing-code-rejected.exception";
import { pairingCodeOf } from "./spoken-pairing-code";

const AUDIT_ACTION = "ALEXA_DEVICE_PAIRED";
const AUDIT_ENTITY = "AlexaDevice";

export type DevicePairing = Readonly<{ therapistId: string; firstName: string }>;

type PairingMoment = Readonly<{ now: Date; transaction: Prisma.TransactionClient }>;

type UsablePairingCode = Readonly<{ id: string; therapistId: string; userId: string; name: string }>;

@Injectable()
export class DevicePairingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async pair(deviceId: string, spokenCode: string | undefined): Promise<DevicePairing> {
    const code = pairingCodeOf(spokenCode);
    if (!code) throw new PairingCodeRejectedException();
    const now = this.clock.now();
    return this.prisma.$transaction(async (transaction) => {
      const pairingCode = await this.usablePairingCodeOf(code, now, transaction);
      const device = await transaction.alexaDevice.upsert({ where: { deviceId }, create: { deviceId }, update: {} });
      await this.consume(pairingCode.id, device.id, { now, transaction });
      await this.linkAndAudit(pairingCode, device.id, { now, transaction });
      return { therapistId: pairingCode.therapistId, firstName: firstNameOf(pairingCode.name) };
    });
  }

  private async linkAndAudit(
    pairingCode: UsablePairingCode,
    alexaDeviceId: string,
    { now, transaction }: PairingMoment,
  ): Promise<void> {
    await transaction.alexaDeviceTherapist.createMany({
      data: [{ alexaDeviceId, therapistId: pairingCode.therapistId, pairedAt: now }],
      skipDuplicates: true,
    });
    await transaction.auditEvent.create({
      data: {
        actorId: pairingCode.userId,
        action: AUDIT_ACTION,
        entityType: AUDIT_ENTITY,
        entityId: alexaDeviceId,
        data: { alexaDeviceId, pairingCodeId: pairingCode.id, therapistId: pairingCode.therapistId },
      },
    });
  }

  private async usablePairingCodeOf(
    code: string,
    now: Date,
    transaction: Prisma.TransactionClient,
  ): Promise<UsablePairingCode> {
    const pairingCode = await transaction.alexaPairingCode.findFirst({
      where: { code, consumedAt: null, expiresAt: { gt: now }, therapist: { user: { status: UserStatus.ACTIVE } } },
      select: { id: true, therapistId: true, therapist: { select: { user: { select: { id: true, name: true } } } } },
    });
    if (!pairingCode) throw new PairingCodeRejectedException();
    const { id: userId, name } = pairingCode.therapist.user;
    return { id: pairingCode.id, therapistId: pairingCode.therapistId, userId, name };
  }

  private async consume(
    pairingCodeId: string,
    alexaDeviceId: string,
    { now, transaction }: PairingMoment,
  ): Promise<void> {
    const consumed = await transaction.alexaPairingCode.updateMany({
      where: { id: pairingCodeId, consumedAt: null },
      data: { consumedAt: now, consumedByDeviceId: alexaDeviceId },
    });
    if (consumed.count === 0) throw new PairingCodeRejectedException();
  }
}
