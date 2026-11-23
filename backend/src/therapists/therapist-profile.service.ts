import { Injectable, NotFoundException } from "@nestjs/common";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TherapistProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async therapistIdOf(userId: string): Promise<string> {
    const therapist = await this.prisma.therapist.findFirst({
      where: { userId, user: { status: "ACTIVE" } },
      select: { id: true },
    });
    if (!therapist) throw new NotFoundException(messages.errors.therapistProfileUnavailable);
    return therapist.id;
  }

  async userIdOf(therapistId: string): Promise<string> {
    const therapist = await this.prisma.therapist.findUnique({ where: { id: therapistId }, select: { userId: true } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistNotFound);
    return therapist.userId;
  }
}
