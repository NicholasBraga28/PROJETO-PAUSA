import type { TherapistAgendaItem } from "@/shared/api/schemas";

interface TherapistAppointmentProps {
  appointment: TherapistAgendaItem;
}

function TherapistAppointment({ appointment }: TherapistAppointmentProps) {
  return (
    <dl className="therapist-appointment">
      <div className="therapist-appointment-time">
        <dt>Horário</dt>
        <dd>
          <time dateTime={appointment.startsAt}>{appointment.spokenTime}</time>
        </dd>
      </div>
      <div>
        <dt>Colaborador</dt>
        <dd>{appointment.employee.firstName}</dd>
      </div>
      <div>
        <dt>Sala</dt>
        <dd>{appointment.room.name}</dd>
      </div>
      <div className="therapist-appointment-status">
        <dt>Status</dt>
        <dd>{appointment.spokenStatus}</dd>
      </div>
    </dl>
  );
}

export default TherapistAppointment;
