import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiLineChart } from "./KpiLineChart";

describe("gráfico de KPI", () => {
  it("TK-12.07 RF-21 RN-04: renderiza o gráfico interativo e suas instruções acessíveis", async () => {
    const { container } = render(
      <KpiLineChart
        label="Agendamentos por dia"
        unit="appointments"
        items={[
          { label: "Segunda-feira", axisLabel: "Segunda", value: 2 },
          { label: "Terça-feira", axisLabel: "Terça", value: 0 },
        ]}
      />,
    );

    expect(await screen.findByText(/Gráfico interativo/)).toBeVisible();
    expect(screen.getByText("Comparação: agendamentos por dia")).toBeVisible();
    expect(container.querySelector(".hr-kpi-chart")).toBeInTheDocument();
  });
});
