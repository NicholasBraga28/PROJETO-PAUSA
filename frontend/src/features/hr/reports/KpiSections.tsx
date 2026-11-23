import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import type { KpiReport } from "./api";
import {
  formatReportCompactDate,
  formatReportDate,
  formatReportTime,
  labelForShift,
  labelForWeekday,
} from "./report-format";
import { KpiLineChart } from "./KpiLineChart";
import { KpiTable } from "./KpiTable";

interface KpiSectionsProps {
  report: KpiReport;
}

const WEEKDAY_AXIS_LABELS: Record<KpiReport["demand"]["byWeekday"][number]["weekday"], string> = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export function KpiSections({ report }: KpiSectionsProps) {
  const { demand } = report;
  const shiftLeader = demand.mostRequestedShift;
  const weekdayLeader = demand.mostRequestedWeekday;
  const startTimeLeader = demand.mostRequestedStartTime;
  const shiftCount = demand.byShift.find(({ shift }) => shift === shiftLeader)?.appointmentCount;
  const weekdayCount = demand.byWeekday.find(({ weekday }) => weekday === weekdayLeader)?.appointmentCount;
  const startTimeCount = demand.byStartTime.find(({ time }) => time === startTimeLeader)?.appointmentCount;
  const granularity =
    report.range.granularity === "DAY" ? "dia" : report.range.granularity === "WEEK" ? "semana" : "mês";
  const metrics = [
    {
      id: "shifts",
      tab: "Turnos",
      title: "Agendamentos por turno",
      unit: "appointments" as const,
      visualization: "bars" as const,
      items: demand.byShift.map(({ shift, appointmentCount }) => ({
        label: labelForShift(shift),
        axisLabel: labelForShift(shift),
        value: appointmentCount,
      })),
      table: (
        <KpiTable
          caption="Agendamentos por turno"
          headings={["Turno", "Agendamentos"]}
          rows={demand.byShift.map(({ shift, appointmentCount }) => [labelForShift(shift), String(appointmentCount)])}
        />
      ),
    },
    {
      id: "weekdays",
      tab: "Dias da semana",
      title: "Agendamentos por dia da semana",
      unit: "appointments" as const,
      visualization: "bars" as const,
      items: demand.byWeekday.map(({ weekday, appointmentCount }) => ({
        label: labelForWeekday(weekday),
        axisLabel: WEEKDAY_AXIS_LABELS[weekday],
        value: appointmentCount,
      })),
      table: (
        <KpiTable
          caption="Agendamentos por dia da semana"
          headings={["Dia da semana", "Agendamentos"]}
          rows={demand.byWeekday.map(({ weekday, appointmentCount }) => [
            labelForWeekday(weekday),
            String(appointmentCount),
          ])}
        />
      ),
    },
    {
      id: "start-times",
      tab: "Horários",
      title: "Horários de início mais procurados",
      unit: "appointments" as const,
      visualization: "bars" as const,
      items: demand.byStartTime.map(({ time, appointmentCount }) => ({
        label: formatReportTime(time),
        axisLabel: formatReportTime(time),
        value: appointmentCount,
      })),
      table: (
        <KpiTable
          caption="Agendamentos por horário de início"
          headings={["Horário de início", "Agendamentos"]}
          rows={demand.byStartTime.map(({ time, appointmentCount }) => [
            formatReportTime(time),
            String(appointmentCount),
          ])}
        />
      ),
    },
    {
      id: "cancellations",
      tab: "Cancelamentos",
      title: `Taxa de cancelamento por ${granularity}`,
      unit: "percentage" as const,
      visualization: "trend" as const,
      items: report.cancellations.map(({ periodStart, cancellationRatePercent }) => ({
        label: formatReportDate(periodStart),
        axisLabel: formatReportCompactDate(periodStart),
        value: cancellationRatePercent,
      })),
      table: (
        <KpiTable
          caption="Taxa de cancelamentos por período"
          headings={["Período", "Agendamentos", "Cancelados", "Taxa de cancelamento"]}
          rows={report.cancellations.map(
            ({
              periodStart,
              periodEnd,
              scheduledAppointmentCount,
              cancelledAppointmentCount,
              cancellationRatePercent,
            }) => [
              periodStart === periodEnd
                ? formatReportDate(periodStart)
                : `${formatReportDate(periodStart)} a ${formatReportDate(periodEnd)}`,
              String(scheduledAppointmentCount),
              String(cancelledAppointmentCount),
              `${cancellationRatePercent}%`,
            ],
          )}
        />
      ),
    },
  ];

  return (
    <div className="hr-kpi-results">
      <section className="hr-kpi-overview" aria-labelledby="kpi-overview-title">
        <h3 id="kpi-overview-title">Resumo do período</h3>
        <p className="hr-kpi-spoken-text">{report.spokenText}</p>
      </section>
      <section className="hr-kpi-highlight-section" aria-label="Indicadores em destaque">
        <div className="hr-kpi-highlight-grid">
          <article className="hr-kpi-card hr-kpi-highlight">
            <p className="hr-kpi-label">Turno mais procurado</p>
            <h3 className="hr-kpi-value">{shiftLeader ? labelForShift(shiftLeader) : "Sem demanda"}</h3>
            <p className="hr-kpi-support">
              {shiftLeader && shiftCount !== undefined
                ? `${shiftCount} agendamentos`
                : "Ainda não há dados de procura por turno neste período."}
            </p>
          </article>
          <article className="hr-kpi-card hr-kpi-highlight">
            <p className="hr-kpi-label">Dia mais procurado</p>
            <h3 className="hr-kpi-value">{weekdayLeader ? labelForWeekday(weekdayLeader) : "Sem demanda"}</h3>
            <p className="hr-kpi-support">
              {weekdayLeader && weekdayCount !== undefined
                ? `${weekdayCount} agendamentos`
                : "Ainda não há dados de procura por dia neste período."}
            </p>
          </article>
          <article className="hr-kpi-card hr-kpi-highlight">
            <p className="hr-kpi-label">Horário mais procurado</p>
            <h3 className="hr-kpi-value">{startTimeLeader ? formatReportTime(startTimeLeader) : "Sem demanda"}</h3>
            <p className="hr-kpi-support">
              {startTimeLeader && startTimeCount !== undefined
                ? `${startTimeCount} agendamentos`
                : "Ainda não há dados de procura por horário neste período."}
            </p>
          </article>
          <article className="hr-kpi-card hr-kpi-highlight">
            <p className="hr-kpi-label">Cancelamentos</p>
            <h3 className="hr-kpi-value">Por {granularity}</h3>
            <p className="hr-kpi-support">Taxa e volume no período selecionado</p>
          </article>
        </div>
      </section>
      <section className="hr-metric-explorer" aria-labelledby="metric-explorer-title">
        <header className="hr-section-heading">
          <h3 id="metric-explorer-title">Explorar indicadores</h3>
          <p>Escolha um indicador para ver a comparação, os valores e a tendência no período.</p>
        </header>
        <Tabs className="hr-report-tabs" defaultSelectedKey="weekdays">
          <TabList className="hr-report-tab-list" aria-label="Selecionar indicador">
            {metrics.map((metric) => (
              <Tab className="hr-report-tab" id={metric.id} key={metric.id}>
                {metric.tab}
              </Tab>
            ))}
          </TabList>
          {metrics.map((metric) => (
            <TabPanel className="hr-report-tab-panel" id={metric.id} key={metric.id}>
              <h4>{metric.title}</h4>
              <KpiLineChart
                label={metric.title}
                unit={metric.unit}
                visualization={metric.visualization}
                items={metric.items}
              />
              <details className="hr-kpi-table-details">
                <summary>Ver tabela completa</summary>
                {metric.table}
              </details>
            </TabPanel>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
