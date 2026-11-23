import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkingTherapistsService {
  constructor(private readonly prisma: PrismaService) {}

  async workingAmong(therapistIds: readonly string[], instant: Date): Promise<string[]> {
    const slots = await this.prisma.scheduleSlot.findMany({
      where: { therapistId: { in: [...therapistIds] }, startsAt: { lte: instant }, endsAt: { gt: instant } },
      select: { therapistId: true },
      distinct: ["therapistId"],
    });
    return slots.map(({ therapistId }) => therapistId);
  }
}
