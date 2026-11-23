import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { dateLabel, dayOf } from "@/shared/time/local-time";
import { validateCopyTargets } from "./copy-targets";
import type { CopySchedulesInput } from "./api";
import { ScheduleSelect } from "./ScheduleSelect";

interface ScheduleCopyFormProps {
  defaultSourceDate: string;
  therapists: Array<{ id: string; name: string }>;
  onSubmit: (input: CopySchedulesInput) => void;
}

export function ScheduleCopyForm({ defaultSourceDate, therapists, onSubmit }: ScheduleCopyFormProps) {
  const [sourceDate, setSourceDate] = useState(defaultSourceDate);
  const [targetDate, setTargetDate] = useState("");
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [therapistId, setTherapistId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (validationError) errorRef.current?.focus();
  }, [validationError]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateCopyTargets(sourceDate, targetDates, dayOf(new Date()));
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onSubmit({ sourceDate, targetDates, ...(therapistId ? { therapistId } : {}) });
  };

  return (
    <section className="hr-create" aria-labelledby="schedule-copy-title">
      <h3 id="schedule-copy-title">Copiar agenda para datas futuras</h3>
      <Form className="hr-schedule-copy-form" onSubmit={handleSubmit}>
        <TextField className="hr-field" isRequired value={sourceDate} onChange={setSourceDate}>
          <Label>Data de origem</Label>
          <Input className="hr-input" type="date" />
          <FieldError />
        </TextField>
        <ScheduleSelect
          label="Massoterapeuta da origem"
          value={therapistId}
          options={[
            { id: "all", label: "Todos os massoterapeutas" },
            ...therapists.map(({ id, name }) => ({ id, label: name })),
          ]}
          onChange={setTherapistId}
        />
        <div className="hr-copy-target-entry">
          <TextField className="hr-field" value={targetDate} onChange={setTargetDate}>
            <Label>Data de destino</Label>
            <Input className="hr-input" type="date" />
          </TextField>
          <Button
            type="button"
            className="ghost-btn"
            isDisabled={!targetDate || targetDates.length >= 31}
            onPress={() => {
              setTargetDates((current) => [...current, targetDate]);
              setTargetDate("");
              setValidationError(null);
            }}
          >
            Adicionar data
          </Button>
        </div>
        {targetDates.length > 0 && (
          <ul aria-label="Datas de destino da cópia" className="hr-copy-targets">
            {targetDates.map((date, index) => (
              <li key={`${date}-${index}`}>
                <time dateTime={date}>
                  {dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </time>
                <Button
                  type="button"
                  className="ghost-btn"
                  onPress={() => setTargetDates((current) => current.filter((_, targetIndex) => targetIndex !== index))}
                >
                  Remover data {dateLabel(date, { day: "numeric", month: "long" })}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {validationError && (
          <p className="field-error" role="alert" tabIndex={-1} ref={errorRef}>
            {validationError}
          </p>
        )}
        <Button type="submit" className="cta">
          Revisar cópia
        </Button>
      </Form>
    </section>
  );
}
