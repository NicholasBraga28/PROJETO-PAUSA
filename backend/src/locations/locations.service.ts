import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LocationDto } from "./location.dto";
import { AdminLocationDto } from "./admin-location.dto";

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(): Promise<LocationDto[]> {
    return this.prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true, timezone: true },
    });
  }

  listForAdministration(): Promise<AdminLocationDto[]> {
    return this.prisma.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, timezone: true, active: true },
    });
  }
}
