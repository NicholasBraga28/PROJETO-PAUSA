import { lazy, Suspense } from "react";

export interface KpiLineChartProps {
  label: string;
  unit: "appointments" | "responses" | "percentage";
  visualization?: "bars" | "trend";
  items: Array<{ label: string; axisLabel: string; value: number }>;
}

const KpiChartView = lazy(() => import("./KpiChartView").then((module) => ({ default: module.KpiChartView })));

export function KpiLineChart(props: KpiLineChartProps) {
  return (
    <Suspense
      fallback={
        <p className="hr-kpi-chart-loading" role="status">
          Carregando gráfico…
        </p>
      }
    >
      <KpiChartView {...props} />
    </Suspense>
  );
}
