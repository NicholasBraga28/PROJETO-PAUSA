import { useState, type FormEvent } from "react";
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
import type { AdminLocation, CreateRoomInput } from "./api";

interface RoomFormProps {
  locations: AdminLocation[];
  isDisabled: boolean;
  onSubmit: (input: CreateRoomInput) => void;
  onCancel: () => void;
}

export function RoomForm({ locations, isDisabled, onSubmit, onCancel }: RoomFormProps) {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ name: name.trim(), locationId });
  };

  return (
    <section className="hr-create" aria-labelledby="new-room-title">
      <h3 id="new-room-title">Cadastrar sala</h3>
      <Form className="hr-room-form" onSubmit={handleSubmit}>
        <TextField className="hr-field" isRequired value={name} onChange={setName}>
          <Label>Nome da sala</Label>
          <Input className="hr-input" autoComplete="off" />
          <FieldError />
        </TextField>
        <Select
          className="hr-field"
          selectedKey={locationId}
          onSelectionChange={(key) => {
            if (typeof key === "string") setLocationId(key);
          }}
          isRequired
        >
          <Label>Unidade da sala</Label>
          <Button className="hr-select-trigger">
            <SelectValue />
          </Button>
          <Popover className="hr-select-popover">
            <ListBox aria-label="Unidade da sala">
              {locations.map((location) => (
                <ListBoxItem key={location.id} id={location.id}>
                  {location.name}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
          <FieldError />
        </Select>
        <div className="hr-form-actions">
          <Button type="submit" className="cta" aria-label="Revisar cadastro da sala" isDisabled={isDisabled}>
            Revisar
          </Button>
          <Button
            type="button"
            className="ghost-btn"
            aria-label="Cancelar cadastro da sala"
            onPress={onCancel}
            isDisabled={isDisabled}
          >
            Cancelar
          </Button>
        </div>
      </Form>
    </section>
  );
}
