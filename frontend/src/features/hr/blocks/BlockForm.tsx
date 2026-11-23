import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import type { ScheduleBlockInput } from "./api";

interface BlockFormProps {
  therapists: Array<{ id: string; name: string }>;
  isDisabled: boolean;
  onSubmit: (input: ScheduleBlockInput) => void;
}

export function BlockForm({ therapists, isDisabled, onSubmit }: BlockFormProps) {
  const [therapistId, setTherapistId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [periodError, setPeriodError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (periodError) errorRef.current?.focus();
  }, [periodError]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      setPeriodError("O fim precisa ser depois do início.");
      return;
    }
    setPeriodError(null);
    onSubmit({ therapistId, startsAt, endsAt, reason: reason.trim() || undefined });
  };

  return (
    <Form className="hr-block-form" onSubmit={handleSubmit} aria-describedby="block-time-help">
      <Select
        className="hr-field"
        selectedKey={therapistId || null}
        onSelectionChange={(key) => setTherapistId(key === null ? "" : String(key))}
        isRequired
      >
        <Label>Massoterapeuta</Label>
        <Button className="hr-select-trigger">
          <SelectValue>{({ isPlaceholder, selectedText }) => (isPlaceholder ? "Selecione" : selectedText)}</SelectValue>
        </Button>
        <Popover className="hr-select-popover">
          <ListBox aria-label="Massoterapeuta">
            {therapists.map((therapist) => (
              <ListBoxItem key={therapist.id} id={therapist.id} textValue={therapist.name}>
                {therapist.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <TextField
        className="hr-field"
        isRequired
        value={startsAt}
        onChange={setStartsAt}
        aria-describedby="block-time-help"
      >
        <Label>Início</Label>
        <Input className="hr-input" type="datetime-local" />
        <FieldError />
      </TextField>
      <TextField className="hr-field" isRequired value={endsAt} onChange={setEndsAt} aria-describedby="block-time-help">
        <Label>Fim</Label>
        <Input className="hr-input" type="datetime-local" />
        <FieldError />
      </TextField>
      <TextField className="hr-field" value={reason} onChange={setReason} maxLength={200}>
        <Label>Motivo (opcional)</Label>
        <Input className="hr-input" maxLength={200} />
        <FieldError />
      </TextField>
      <p id="block-time-help" className="hr-help">
        Data e horário de São Paulo. Vamos conferir o horário de atendimento e os agendamentos antes de salvar.
      </p>
      {periodError && (
        <p className="field-error" role="alert" tabIndex={-1} ref={errorRef}>
          {periodError}
        </p>
      )}
      <Button type="submit" className="cta" isDisabled={isDisabled || therapists.length === 0}>
        Revisar período
      </Button>
    </Form>
  );
}
