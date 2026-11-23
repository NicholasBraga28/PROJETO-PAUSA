import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";

interface ScheduleSelectProps {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  isRequired?: boolean;
}

export function ScheduleSelect({ label, value, options, onChange, isRequired = false }: ScheduleSelectProps) {
  return (
    <Select
      className="hr-field"
      selectedKey={value || "all"}
      onSelectionChange={(key) => {
        const selected = options.find((option) => option.id === key);
        if (selected) onChange(selected.id === "all" ? "" : selected.id);
      }}
      isRequired={isRequired}
    >
      <Label>{label}</Label>
      <Button className="hr-select-trigger">
        <SelectValue>{({ isPlaceholder, selectedText }) => (isPlaceholder ? "Selecione" : selectedText)}</SelectValue>
      </Button>
      <Popover className="hr-select-popover">
        <ListBox aria-label={label}>
          {options.map((option) => (
            <ListBoxItem key={option.id} id={option.id}>
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
