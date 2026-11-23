import type { LocationCode } from "@prisma/client";

export type LocationDto = Readonly<{
  code: LocationCode;
  name: string;
  timezone: string;
}>;
