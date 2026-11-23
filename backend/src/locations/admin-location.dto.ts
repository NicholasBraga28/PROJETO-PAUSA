import type { LocationCode } from "@prisma/client";

export type AdminLocationDto = Readonly<{
  id: string;
  code: LocationCode;
  name: string;
  timezone: string;
  active: boolean;
}>;
