import { Button, Form, Input, Label, TextField } from "react-aria-components";
import { LocationCode } from "@/shared/api/schemas";
import type { ScheduleFilters as ScheduleFilterState, ScheduleLocation, ScheduleRoom } from "./api";
import { ScheduleSelect } from "./ScheduleSelect";

interface ScheduleFiltersProps {
  filters: ScheduleFilterState;
  locations: ScheduleLocation[];
  therapists: Array<{ id: string; name: string }>;
  rooms: ScheduleRoom[];
  onChange: (filters: ScheduleFilterState) => void;
  onSearch: () => void;
}

const ALL_OPTION = { id: "all", label: "Todas" };

export function ScheduleFilters({ filters, locations, therapists, rooms, onChange, onSearch }: ScheduleFiltersProps) {
  return (
    <Form
      className="hr-filters hr-schedule-filters"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <TextField
        className="hr-field"
        isRequired
        value={filters.date}
        onChange={(date) => onChange({ ...filters, date })}
      >
        <Label>Data da agenda</Label>
        <Input className="hr-input" type="date" />
      </TextField>
      <ScheduleSelect
        label="Unidade"
        value={filters.locationCode}
        options={[ALL_OPTION, ...locations.map(({ code, name }) => ({ id: code, label: name }))]}
        onChange={(locationCode) => {
          const parsed = LocationCode.safeParse(locationCode);
          onChange({ ...filters, locationCode: parsed.success ? parsed.data : "" });
        }}
      />
      <ScheduleSelect
        label="Massoterapeuta"
        value={filters.therapistId}
        options={[ALL_OPTION, ...therapists.map(({ id, name }) => ({ id, label: name }))]}
        onChange={(therapistId) => onChange({ ...filters, therapistId })}
      />
      <ScheduleSelect
        label="Sala"
        value={filters.roomId}
        options={[ALL_OPTION, ...rooms.map(({ id, name }) => ({ id, label: name }))]}
        onChange={(roomId) => onChange({ ...filters, roomId })}
      />
      <Button type="submit" className="cta hr-filter-button">
        Buscar agenda
      </Button>
    </Form>
  );
}
