import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AppointmentEvents, AppointmentBookedEvent, AppointmentCancelledEvent } from "../booking/appointment-events";

type AuditedAppointmentEvent = Readonly<{
  appointmentId: string;
  actorId: string;
  action: string;
  data: Prisma.InputJsonObject;
}>;

@Injectable()
export class AppointmentAuditListener implements OnModuleInit {
  constructor(
    private readonly events: AppointmentEvents,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.events.onBooked((event) => this.recordCreated(event));
    this.events.onCancelled((event) => this.recordCancelled(event));
  }

  private recordCreated(event: AppointmentBookedEvent): Promise<void> {
    return this.recordOnce({
      appointmentId: event.appointmentId,
      actorId: event.employeeId,
      action: "APPOINTMENT_CREATED",
      data: { status: "CONFIRMED" },
    });
  }

  private recordCancelled(event: AppointmentCancelledEvent): Promise<void> {
    return this.recordOnce({
      appointmentId: event.appointmentId,
      actorId: event.cancelledById,
      action: "APPOINTMENT_CANCELLED",
      data: { status: "CANCELLED", employeeId: event.employeeId, cancelledByRole: event.cancelledByRole },
    });
  }

  private async recordOnce({ appointmentId, actorId, action, data }: AuditedAppointmentEvent): Promise<void> {
    const existing = await this.prisma.auditEvent.findFirst({
      where: { actorId, action, entityType: "Appointment", entityId: appointmentId },
      select: { id: true },
    });
    if (existing) return;
    await this.prisma.auditEvent.create({
      data: { actorId, action, entityType: "Appointment", entityId: appointmentId, data },
    });
  }
}
