import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { dateLabel } from "@/shared/time/local-time";
import { localDateTimeOf, localDateTimeToIso } from "./local-schedule-time";
import type { ScheduleInput, ScheduleRoom, ScheduleSlot } from "./api";
import { ScheduleSelect } from "./ScheduleSelect";

interface ScheduleSlotFormProps {
  date: string;
  slot: ScheduleSlot | null;
  therapists: Array<{ id: string; name: string }>;
  rooms: ScheduleRoom[];
  isDisabled: boolean;
  onSubmit: (input: ScheduleInput) => void;
  onCancel: () => void;
}

const toFormValues = (date: string, slot: ScheduleSlot | null) => {
  if (!slot) return { date, startsAt: "", endsAt: "", therapistId: "", roomId: "" };
  return {
    date: localDateTimeOf(slot.startsAt).date,
    startsAt: localDateTimeOf(slot.startsAt).time,
    endsAt: localDateTimeOf(slot.endsAt).time,
    therapistId: slot.therapistId,
    roomId: slot.roomId,
  };
};

export function ScheduleSlotForm({
  date,
  slot,
  therapists,
  rooms,
  isDisabled,
  onSubmit,
  onCancel,
}: ScheduleSlotFormProps) {
  const initial = toFormValues(date, slot);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [therapistId, setTherapistId] = useState(initial.therapistId);
  const [roomId, setRoomId] = useState(initial.roomId || rooms[0]?.id || "");
  const [periodError, setPeriodError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (periodError) errorRef.current?.focus();
  }, [periodError]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      setPeriodError("O horário final precisa ser depois do horário inicial.");
      return;
    }
    setPeriodError(null);
    onSubmit({
      therapistId,
      roomId,
      startsAt: localDateTimeToIso(initial.date, startsAt),
      endsAt: localDateTimeToIso(initial.date, endsAt),
    });
  };

  return (
    <section className="hr-create" aria-labelledby="schedule-form-title">
      <h3 id="schedule-form-title">{slot ? "Editar período" : "Adicionar período"}</h3>
      <p>
        Data:{" "}
        <time dateTime={initial.date}>
          {dateLabel(initial.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </time>
        . Os horários seguem o fuso America/Sao_Paulo.
      </p>
      <Form className="hr-schedule-slot-form" onSubmit={handleSubmit}>
        {!slot && (
          <ScheduleSelect
            label="Massoterapeuta"
            value={therapistId}
            options={therapists.map(({ id, name }) => ({ id, label: name }))}
            onChange={setTherapistId}
            isRequired
          />
        )}
        <ScheduleSelect
          label="Sala"
          value={roomId}
          options={rooms.map(({ id, name }) => ({ id, label: name }))}
          onChange={setRoomId}
          isRequired
        />
        <TextField className="hr-field" isRequired value={startsAt} onChange={setStartsAt}>
          <Label>Horário inicial</Label>
          <Input className="hr-input" type="time" />
          <FieldError />
        </TextField>
        <TextField className="hr-field" isRequired value={endsAt} onChange={setEndsAt}>
          <Label>Horário final</Label>
          <Input className="hr-input" type="time" />
          <FieldError />
        </TextField>
        {periodError && (
          <p className="field-error" role="alert" tabIndex={-1} ref={errorRef}>
            {periodError}
          </p>
        )}
        <div className="hr-form-actions">
          <Button type="submit" className="cta" isDisabled={isDisabled || !roomId || (!slot && !therapistId)}>
            Revisar período
          </Button>
          <Button type="button" className="ghost-btn" onPress={onCancel} isDisabled={isDisabled}>
            Cancelar edição
          </Button>
        </div>
      </Form>
    </section>
  );
}
