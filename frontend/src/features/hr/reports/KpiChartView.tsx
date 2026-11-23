import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KpiLineChartProps } from "./KpiLineChart";

const formatValue = (value: number, unit: KpiLineChartProps["unit"]) =>
  unit === "percentage"
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`
    : unit === "responses"
      ? `${new Intl.NumberFormat("pt-BR").format(value)} ${value === 1 ? "resposta" : "respostas"}`
      : `${new Intl.NumberFormat("pt-BR").format(value)} ${value === 1 ? "agendamento" : "agendamentos"}`;

export function KpiChartView({ label, unit, visualization = "bars", items }: KpiLineChartProps) {
  const chartHeight = Math.max(240, items.length * 36);
  const commonAxis = {
    tick: { fill: "var(--ink)", fontSize: 13 },
    tickLine: false,
    axisLine: { stroke: "var(--line)" },
  };

  return (
    <figure className="hr-kpi-chart-figure">
      <p className="hr-kpi-chart-instructions">
        Gráfico interativo: use Tab para chegar ao gráfico e as setas para percorrer os valores. A tabela completa está
        disponível logo abaixo.
      </p>
      <div className="hr-kpi-chart">
        <ResponsiveContainer width="100%" height={visualization === "trend" ? 300 : chartHeight}>
          {visualization === "trend" ? (
            <AreaChart
              accessibilityLayer
              data={items}
              margin={{ top: 12, right: 18, bottom: 8, left: 4 }}
              title={label}
            >
              <defs>
                <linearGradient id="cancellationFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="axisLabel" {...commonAxis} minTickGap={14} />
              <YAxis
                {...commonAxis}
                width={58}
                tickFormatter={(value: number) => `${new Intl.NumberFormat("pt-BR").format(value)}%`}
              />
              <Tooltip
                formatter={(value) => formatValue(Number(value), unit)}
                labelFormatter={(_, payload) => payload[0]?.payload.label ?? ""}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={label}
                stroke="var(--primary)"
                strokeWidth={3}
                fill="url(#cancellationFill)"
                activeDot={{ r: 7, stroke: "var(--card)", strokeWidth: 3 }}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart
              accessibilityLayer
              data={items}
              layout="vertical"
              margin={{ top: 8, right: 22, bottom: 8, left: 4 }}
              title={label}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" horizontal={false} />
              <XAxis
                {...commonAxis}
                type="number"
                allowDecimals={false}
                tickFormatter={(value: number) => new Intl.NumberFormat("pt-BR").format(value)}
              />
              <YAxis {...commonAxis} type="category" dataKey="axisLabel" width={112} interval={0} />
              <Tooltip
                formatter={(value) => formatValue(Number(value), unit)}
                labelFormatter={(_, payload) => payload[0]?.payload.label ?? ""}
              />
              <Bar
                dataKey="value"
                name={label}
                fill="var(--primary)"
                radius={[0, 7, 7, 0]}
                maxBarSize={22}
                minPointSize={3}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="hr-kpi-chart-scale">
        {visualization === "trend" ? "Evolução no período selecionado" : `Comparação: ${label.toLocaleLowerCase()}`}
      </figcaption>
    </figure>
  );
}
