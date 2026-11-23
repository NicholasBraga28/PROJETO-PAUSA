import { Module } from "@nestjs/common";
import { AppointmentEvents } from "./appointment-events";

@Module({
  providers: [AppointmentEvents],
  exports: [AppointmentEvents],
})
export class AppointmentEventsModule {}
