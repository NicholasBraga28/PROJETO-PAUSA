import { Controller, Get } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { LocationsService } from "./locations.service";

@Controller("locations")
@Roles("EMPLOYEE")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  listActive() {
    return this.locations.listActive();
  }

  @Get("admin")
  @Roles("HR")
  listForAdministration() {
    return this.locations.listForAdministration();
  }
}
