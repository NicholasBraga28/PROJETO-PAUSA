import { Injectable } from "@nestjs/common";
import { StatusTransitionActor } from "../appointments/appointment-status";

export type AppointmentBookedEvent = Readonly<{
  appointmentId: string;
  employeeId: string;
}>;

export type AppointmentCancelledEvent = Readonly<{
  appointmentId: string;
  employeeId: string;
  cancelledById: string;
  cancelledByRole: StatusTransitionActor;
}>;

export type AppointmentNoShowEvent = Readonly<{
  appointmentId: string;
  therapistId: string;
  markedById: string;
}>;

type BookedListener = (event: AppointmentBookedEvent) => void | Promise<void>;
type CancelledListener = (event: AppointmentCancelledEvent) => void | Promise<void>;
type NoShowListener = (event: AppointmentNoShowEvent) => void | Promise<void>;

@Injectable()
export class AppointmentEvents {
  private readonly bookedListeners: BookedListener[] = [];
  private readonly cancelledListeners: CancelledListener[] = [];
  private readonly noShowListeners: NoShowListener[] = [];

  async emitBooked(event: AppointmentBookedEvent): Promise<void> {
    await Promise.all(this.bookedListeners.map((listener) => listener(event)));
  }

  onBooked(listener: BookedListener): void {
    this.bookedListeners.push(listener);
  }

  async emitCancelled(event: AppointmentCancelledEvent): Promise<void> {
    await Promise.all(this.cancelledListeners.map((listener) => listener(event)));
  }

  onCancelled(listener: CancelledListener): void {
    this.cancelledListeners.push(listener);
  }

  async emitNoShow(event: AppointmentNoShowEvent): Promise<void> {
    await Promise.all(this.noShowListeners.map((listener) => listener(event)));
  }

  onNoShow(listener: NoShowListener): void {
    this.noShowListeners.push(listener);
  }
}
