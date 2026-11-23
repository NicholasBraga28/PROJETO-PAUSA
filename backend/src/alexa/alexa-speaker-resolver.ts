import { Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WorkingTherapistsService } from "../schedules/working-therapists.service";
import { SpokenName, candidatesNamed } from "./speaker-names";

export type SpeakerCandidate = Readonly<{ therapistId: string; name: string }>;

export type SpeakerResolution =
  | Readonly<{ kind: "IDENTIFIED"; therapistId: string }>
  | Readonly<{ kind: "MUST_ASK"; candidates: readonly SpeakerCandidate[] }>
  | Readonly<{ kind: "NOT_SERVED" }>;

export type SpeakerQuery = Readonly<{
  deviceId?: string;
  identifiedTherapistId?: string;
  spokenName: SpokenName;
  now: Date;
}>;

export const NOT_SERVED: SpeakerResolution = { kind: "NOT_SERVED" };

const identified = (therapistId: string): SpeakerResolution => ({ kind: "IDENTIFIED", therapistId });

const onlyOneOf = <T>(items: readonly T[]): T | undefined => (items.length === 1 ? items[0] : undefined);

@Injectable()
export class AlexaSpeakerResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workingTherapists: WorkingTherapistsService,
  ) {}

  async resolve(query: SpeakerQuery): Promise<SpeakerResolution> {
    if (!query.deviceId) return NOT_SERVED;
    const candidates = await this.activeTherapistsLinkedTo(query.deviceId);
    if (candidates.length === 0) return NOT_SERVED;
    const therapistId = this.deducedWithoutAgenda(candidates, query) ?? (await this.onShift(candidates, query.now));
    return therapistId ? identified(therapistId) : { kind: "MUST_ASK", candidates };
  }

  private deducedWithoutAgenda(candidates: readonly SpeakerCandidate[], query: SpeakerQuery): string | undefined {
    const alreadyIdentified = candidates.find(({ therapistId }) => therapistId === query.identifiedTherapistId);
    const named = onlyOneOf(candidatesNamed(candidates, query.spokenName));
    const onlyLinked = onlyOneOf(candidates);
    return (alreadyIdentified ?? named ?? onlyLinked)?.therapistId;
  }

  private async onShift(candidates: readonly SpeakerCandidate[], now: Date): Promise<string | undefined> {
    const working = await this.workingTherapists.workingAmong(
      candidates.map(({ therapistId }) => therapistId),
      now,
    );
    return onlyOneOf(working);
  }

  private async activeTherapistsLinkedTo(deviceId: string): Promise<SpeakerCandidate[]> {
    const links = await this.prisma.alexaDeviceTherapist.findMany({
      where: { alexaDevice: { deviceId }, therapist: { user: { status: UserStatus.ACTIVE } } },
      select: { therapistId: true, therapist: { select: { user: { select: { name: true } } } } },
      orderBy: { pairedAt: "asc" },
    });
    return links.map(({ therapistId, therapist }) => ({ therapistId, name: therapist.user.name }));
  }
}
