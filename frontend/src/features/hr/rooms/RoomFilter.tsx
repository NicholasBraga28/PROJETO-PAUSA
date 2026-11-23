import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";

interface RoomFilterProps {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}

export function RoomFilter({ label, value, options, onChange }: RoomFilterProps) {
  return (
    <Select
      className="hr-field"
      selectedKey={value || "all"}
      onSelectionChange={(key) => {
        const option = options.find((item) => item.id === key);
        if (option) onChange(option.id === "all" ? "" : option.id);
      }}
    >
      <Label>{label}</Label>
      <Button className="hr-select-trigger">
        <SelectValue />
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
