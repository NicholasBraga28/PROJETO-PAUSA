import { Button } from "react-aria-components";
import { localDateTimeOf, spokenScheduleTime } from "./local-schedule-time";
import type { ScheduleSlot } from "./api";

export interface ScheduleSummary extends ScheduleSlot {
  therapistName: string;
  roomName: string;
  locationName: string;
}

interface ScheduleResultsProps {
  schedules: ScheduleSummary[];
  onEdit: (schedule: ScheduleSummary) => void;
  onRemove: (schedule: ScheduleSummary) => void;
}

const spokenHour = (instant: string) => {
  const { time } = localDateTimeOf(instant);
  const [hours, minutes] = time.split(":").map(Number);
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, "0")}`;
};

const periodText = (schedule: Pick<ScheduleSlot, "startsAt" | "endsAt">) =>
  `${spokenScheduleTime(schedule.startsAt)} até ${spokenHour(schedule.endsAt)}`;

function ScheduleActions({
  schedule,
  descriptionId,
  onEdit,
  onRemove,
}: Omit<ScheduleResultsProps, "schedules"> & { schedule: ScheduleSummary; descriptionId: string }) {
  return (
    <div className="hr-schedule-actions">
      <Button
        className="ghost-btn"
        aria-label={`Editar período de ${schedule.therapistName}`}
        aria-describedby={descriptionId}
        onPress={() => onEdit(schedule)}
      >
        Editar
      </Button>
      <Button
        className="ghost-btn"
        aria-label={`Remover período de ${schedule.therapistName}`}
        aria-describedby={descriptionId}
        onPress={() => onRemove(schedule)}
      >
        Remover
      </Button>
    </div>
  );
}

export function ScheduleResults({ schedules, onEdit, onRemove }: ScheduleResultsProps) {
  if (schedules.length === 0) return <p className="hr-empty">Nenhum período encontrado para esta data.</p>;

  return (
    <>
      <div className="hr-schedules-table-wrap">
        <table className="hr-schedules-table">
          <caption>Períodos da agenda</caption>
          <thead>
            <tr>
              <th scope="col">Massoterapeuta</th>
              <th scope="col">Sala</th>
              <th scope="col">Unidade</th>
              <th scope="col">Data e horário</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <th scope="row">{schedule.therapistName}</th>
                <td>{schedule.roomName}</td>
                <td>{schedule.locationName}</td>
                <td>{periodText(schedule)}</td>
                <td>
                  <span className="sr-only" id={`schedule-context-table-${schedule.id}`}>
                    {schedule.therapistName}, {schedule.roomName}, {schedule.locationName}, {periodText(schedule)}.
                  </span>
                  <ScheduleActions
                    schedule={schedule}
                    descriptionId={`schedule-context-table-${schedule.id}`}
                    onEdit={onEdit}
                    onRemove={onRemove}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="hr-schedules-mobile" aria-label="Períodos da agenda">
        {schedules.map((schedule) => (
          <li key={schedule.id} className="hr-schedule-card">
            <article
              aria-labelledby={`schedule-card-title-${schedule.id}`}
              aria-describedby={`schedule-context-card-${schedule.id}`}
            >
              <h3 id={`schedule-card-title-${schedule.id}`}>{schedule.therapistName}</h3>
              <dl id={`schedule-context-card-${schedule.id}`}>
                <div>
                  <dt>Sala</dt>
                  <dd>{schedule.roomName}</dd>
                </div>
                <div>
                  <dt>Unidade</dt>
                  <dd>{schedule.locationName}</dd>
                </div>
                <div>
                  <dt>Data e horário</dt>
                  <dd>{periodText(schedule)}</dd>
                </div>
              </dl>
              <ScheduleActions
                schedule={schedule}
                descriptionId={`schedule-context-card-${schedule.id}`}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
