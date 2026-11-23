import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAnnounce } from "@/shared/a11y/use-announce";
import type { Granularity, KpiQuery, ReportLocation, ReportTherapist } from "./api";
import { formatMonthLabel, shiftMonthRange } from "./report-format";

interface ReportFiltersProps {
  locations: ReportLocation[];
  therapists: ReportTherapist[];
  value: KpiQuery;
  isBusy: boolean;
  filterState: "loading" | "ready" | "error";
  filterError: string | null;
  onChange: (value: KpiQuery) => void;
  onMonthChange: (value: KpiQuery) => void;
  onSubmit: () => void;
  onRetryFilters: () => void;
}

interface FilterSelectProps {
  label: string;
  value: string;
  items: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, items, onChange }: FilterSelectProps) {
  return (
    <Select
      className="hr-field"
      selectedKey={value || "all"}
      onSelectionChange={(key) => onChange(key === "all" || key === null ? "" : String(key))}
    >
      <Label>{label}</Label>
      <Button className="hr-select-trigger">
        <SelectValue />
      </Button>
      <Popover className="hr-select-popover">
        <ListBox aria-label={label}>
          <ListBoxItem id="all">Todas</ListBoxItem>
          {items.map((item) => (
            <ListBoxItem key={item.id} id={item.id}>
              {item.name}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function ReportFilters({
  locations,
  therapists,
  value,
  isBusy,
  filterState,
  filterError,
  onChange,
  onMonthChange,
  onSubmit,
  onRetryFilters,
}: ReportFiltersProps) {
  const announce = useAnnounce();
  const moveMonth = (offset: number) => {
    const range = shiftMonthRange(value.from, offset);
    const nextValue = { ...value, ...range };
    onChange(nextValue);
    onMonthChange(nextValue);
    announce(`Período selecionado: ${formatMonthLabel(range.from)}.`);
  };

  return (
    <div className="hr-report-controls">
      <div className="hr-month-field">
        <span className="hr-month-label">Mês dos indicadores</span>
        <div className="hr-month-selector">
          <Button
            type="button"
            className="hr-month-button"
            aria-label={`Mês anterior a ${formatMonthLabel(value.from)}`}
            isDisabled={isBusy}
            onPress={() => moveMonth(-1)}
          >
            <ChevronLeft aria-hidden="true" focusable="false" />
          </Button>
          <span className="hr-month-value">{formatMonthLabel(value.from)}</span>
          <Button
            type="button"
            className="hr-month-button"
            aria-label={`Próximo mês após ${formatMonthLabel(value.from)}`}
            isDisabled={isBusy}
            onPress={() => moveMonth(1)}
          >
            <ChevronRight aria-hidden="true" focusable="false" />
          </Button>
        </div>
      </div>
      <details className="hr-report-filter-disclosure">
        <summary>Filtrar resultados</summary>
        {filterState === "loading" && (
          <p className="hr-state" role="status">
            Carregando opções de filtro…
          </p>
        )}
        {filterState === "error" && filterError && (
          <div className="hr-error" role="alert">
            <p>{filterError}</p>
            <Button className="cta" onPress={onRetryFilters}>
              Tentar carregar filtros
            </Button>
          </div>
        )}
        {filterState === "ready" && (
          <form
            className="hr-report-filters"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {locations.length === 0 && therapists.length === 0 && (
              <p className="hr-help">Não há unidades ou massoterapeutas disponíveis para filtrar.</p>
            )}
            <FilterSelect
              label="Unidade"
              value={value.locationId}
              items={locations.map(({ id, name }) => ({ id, name }))}
              onChange={(locationId) => onChange({ ...value, locationId })}
            />
            <FilterSelect
              label="Massoterapeuta"
              value={value.therapistId}
              items={therapists}
              onChange={(therapistId) => onChange({ ...value, therapistId })}
            />
            <FilterSelect
              label="Agrupar cancelamentos por"
              value={value.granularity}
              items={[
                { id: "DAY", name: "Dia" },
                { id: "WEEK", name: "Semana" },
                { id: "MONTH", name: "Mês" },
              ]}
              onChange={(granularity) => {
                if (granularity === "DAY" || granularity === "WEEK" || granularity === "MONTH") {
                  onChange({ ...value, granularity });
                }
              }}
            />
            <Button type="submit" className="cta" isDisabled={isBusy}>
              Aplicar filtros
            </Button>
          </form>
        )}
      </details>
    </div>
  );
}
