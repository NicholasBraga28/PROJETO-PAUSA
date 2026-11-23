import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnouncerContext } from "@/shared/a11y/Announcer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectAccessible } from "@/test/axe";
import ReportsPage from "./ReportsPage";
import { currentMonthRange, formatMonthLabel, shiftMonthRange } from "./report-format";
import { MemoryRouter } from "react-router";

const report = {
  range: { from: "2026-10-01", to: "2026-10-31", granularity: "DAY", timezone: "America/Sao_Paulo" },
  filters: { locationId: null, therapistId: null },
  demand: {
    byShift: [
      { shift: "MORNING", appointmentCount: 2 },
      { shift: "AFTERNOON", appointmentCount: 0 },
    ],
    mostRequestedShift: "MORNING",
    byWeekday: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((weekday) => ({
      weekday,
      appointmentCount: weekday === "MONDAY" ? 2 : 0,
    })),
    mostRequestedWeekday: "MONDAY",
    byStartTime: [
      { time: "09:00", appointmentCount: 2 },
      { time: "09:20", appointmentCount: 0 },
    ],
    mostRequestedStartTime: "09:00",
  },
  cancellations: [
    {
      periodStart: "2026-10-01",
      periodEnd: "2026-10-01",
      scheduledAppointmentCount: 2,
      cancelledAppointmentCount: 1,
      cancellationRatePercent: 50,
    },
  ],
  spokenText: "Resumo fiel fornecido pela API.",
};

const feedbackReport = {
  totalResponses: 2,
  bookingEase: [1, 2, 3, 4, 5].map((value) => ({ value, count: value === 1 || value === 2 ? 1 : 0 })),
  technologySatisfaction: [1, 2, 3, 4].map((value) => ({ value, count: value === 1 || value === 3 ? 1 : 0 })),
  serviceRating: [1, 2, 3, 4, 5].map((value) => ({ value, count: value === 2 || value === 4 ? 1 : 0 })),
  recommendation: Array.from({ length: 11 }, (_, value) => ({ value, count: value === 9 || value === 10 ? 1 : 0 })),
  recommendationAverage: 9.5,
  comments: ["A experiência foi ótima.", "<img src=x onerror=alert(1)>"]
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockReportsApi(options: {
  failReport?: boolean;
  emptyFilters?: boolean;
  emptyReport?: boolean;
  failFeedback?: boolean;
  emptyFeedback?: boolean;
} = {}) {
  const calls: URL[] = [];
  let feedbackShouldFail = options.failFeedback ?? false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    calls.push(url);
    if (url.pathname === "/api/locations/admin")
      return respond(
        options.emptyFilters
          ? []
          : [{ id: "location-1", code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo", active: true }],
      );
    if (url.pathname === "/api/users")
      return respond(
        options.emptyFilters
          ? []
          : [
              {
                id: "user-1",
                email: "bruno@example.com",
                name: "Bruno Lima",
                role: "THERAPIST",
                status: "ACTIVE",
                therapistId: "therapist-1",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
      );
    if (url.pathname === "/api/reports/kpis") {
      if (options.failReport)
        return respond({ message: "O período do relatório é inválido. Confira as datas e tente novamente." }, 400);
      if (!url.searchParams.has("from") || !url.searchParams.has("to"))
        return respond({ message: "Período obrigatório." }, 400);
      if (options.emptyReport)
        return respond({
          ...report,
          demand: {
            byShift: [
              { shift: "MORNING", appointmentCount: 0 },
              { shift: "AFTERNOON", appointmentCount: 0 },
            ],
            mostRequestedShift: null,
            byWeekday: report.demand.byWeekday.map((item) => ({ ...item, appointmentCount: 0 })),
            mostRequestedWeekday: null,
            byStartTime: report.demand.byStartTime.map((item) => ({ ...item, appointmentCount: 0 })),
            mostRequestedStartTime: null,
          },
          cancellations: [
            {
              ...report.cancellations[0],
              scheduledAppointmentCount: 0,
              cancelledAppointmentCount: 0,
              cancellationRatePercent: 0,
            },
          ],
          spokenText: "Nenhum atendimento no período.",
        });
      return respond(report);
    }
    if (url.pathname === "/api/reports/feedback") {
      if (feedbackShouldFail) return respond({ message: "Falha temporária." }, 500);
      if (options.emptyFeedback)
        return respond({
          totalResponses: 0,
          bookingEase: feedbackReport.bookingEase.map((item) => ({ ...item, count: 0 })),
          technologySatisfaction: feedbackReport.technologySatisfaction.map((item) => ({ ...item, count: 0 })),
          serviceRating: feedbackReport.serviceRating.map((item) => ({ ...item, count: 0 })),
          recommendation: feedbackReport.recommendation.map((item) => ({ ...item, count: 0 })),
          recommendationAverage: null,
          comments: [],
        });
      return respond(feedbackReport);
    }
    return respond({ message: "Rota não simulada." }, 404);
  });
  return { calls, fetch, setFeedbackShouldFail: (shouldFail: boolean) => (feedbackShouldFail = shouldFail) };
}

function renderReportsPage(announce = vi.fn()) {
  return render(
    <AnnouncerContext.Provider value={announce}>
      <ReportsPage />
    </AnnouncerContext.Provider>,
    { wrapper: MemoryRouter },
  );
}

async function applyReportFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
}

function panelForTab(tab: HTMLElement) {
  const panelId = tab.getAttribute("aria-controls");
  if (!panelId) throw new Error("A aba não aponta para um painel.");
  const panel = document.getElementById(panelId);
  if (!panel) throw new Error("O painel da aba não foi encontrado.");
  return panel;
}

describe("dashboard de KPIs do RH", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("TK-12.07 RF-21 D-08: carrega o mês atual, navega entre meses e aplica filtros", async () => {
    const { calls } = mockReportsApi();
    const user = userEvent.setup();
    renderReportsPage();

    const initialRange = currentMonthRange(new Date());
    const previousRange = shiftMonthRange(initialRange.from, -1);
    expect(screen.getByText(formatMonthLabel(initialRange.from))).toBeVisible();
    await screen.findByText("Resumo fiel fornecido pela API.");
    await waitFor(() => expect(calls.filter((url) => url.pathname === "/api/reports/kpis")).toHaveLength(1));
    expect(calls.find((url) => url.pathname === "/api/reports/kpis")?.searchParams.get("from")).toBe(
      initialRange.from,
    );
    await user.click(screen.getByRole("button", { name: `Mês anterior a ${formatMonthLabel(initialRange.from)}` }));
    expect(screen.getByText(formatMonthLabel(previousRange.from))).toBeVisible();
    await waitFor(() => expect(calls.filter((url) => url.pathname === "/api/reports/kpis")).toHaveLength(2));
    await user.click(screen.getByText("Filtrar resultados"));
    await user.click(screen.getByRole("button", { name: /Unidade/ }));
    await user.click(await screen.findByRole("option", { name: "São Paulo" }));
    await user.click(screen.getByRole("button", { name: /Massoterapeuta/ }));
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    await user.click(screen.getByRole("button", { name: /Agrupar cancelamentos por/ }));
    await user.click(await screen.findByRole("option", { name: "Semana" }));
    await applyReportFilters(user);

    await waitFor(() => expect(calls.filter((url) => url.pathname === "/api/reports/kpis")).toHaveLength(3));
    const url = calls.filter((entry) => entry.pathname === "/api/reports/kpis").at(-1);
    expect(url?.searchParams.get("from")).toBe(previousRange.from);
    expect(url?.searchParams.get("to")).toBe(previousRange.to);
    expect(url?.searchParams.get("locationId")).toBe("location-1");
    expect(url?.searchParams.get("therapistId")).toBe("therapist-1");
    expect(url?.searchParams.get("granularity")).toBe("WEEK");
  });

  it("TK-12.07 RF-21 D-08: mostra valores vazios nos indicadores", async () => {
    mockReportsApi({ emptyReport: true });
    renderReportsPage();
    await screen.findByText("Nenhum atendimento no período.");

    const user = userEvent.setup();
    const tab = screen.getByRole("tab", { name: "Cancelamentos" });
    await user.click(tab);
    const panel = panelForTab(tab);
    await user.click(within(panel).getByText("Ver tabela completa"));
    const table = await within(panel).findByRole("table", { name: /Taxa de cancelamentos por período/ });
    expect(within(table).getByText("0%", { exact: true })).toBeVisible();
    expect(screen.getByText("Nenhum atendimento no período.")).toBeVisible();
  });
  it("TK-12.07 RF-21 RNF-01: anuncia o resumo e mantém as visualizações acessíveis", async () => {
    mockReportsApi();
    const announce = vi.fn();
    const user = userEvent.setup();
    const { container } = renderReportsPage(announce);
    await screen.findByText("Resumo fiel fornecido pela API.");

    await waitFor(() => expect(announce).toHaveBeenCalledWith("Resumo fiel fornecido pela API."));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Resumo fiel fornecido pela API.")).toBeVisible();
    await expectAccessible(container);
    for (const tabName of ["Turnos", "Dias da semana", "Horários", "Cancelamentos"]) {
      const tab = screen.getByRole("tab", { name: tabName });
      await user.click(tab);
      await user.click(within(panelForTab(tab)).getByText("Ver tabela completa"));
    }
    await expectAccessible(container);
  });

  it("TK-12.07 RN-04: mantém os detalhes da tabela recolhidos e mostra o gráfico selecionado", async () => {
    mockReportsApi();
    const user = userEvent.setup();
    renderReportsPage();
    const tab = await screen.findByRole("tab", { name: "Horários" });
    await user.click(tab);
    const panel = panelForTab(tab);
    const tableToggle = within(panel).getByText("Ver tabela completa");
    expect(tableToggle.closest("details")).not.toHaveAttribute("open");
    expect(await within(panel).findByText(/Gráfico interativo/)).toBeVisible();
    await user.click(tableToggle);
    expect(within(panel).getByRole("table", { name: /Agendamentos por horário de início/ })).toBeVisible();
  });
  it("TK-12.07 RF-21: erro do catálogo recebe foco e permite nova tentativa", async () => {
    mockReportsApi({ failReport: true });
    renderReportsPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent("O período do relatório é inválido.");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  it("TK-12.07 RF-21 D-08: explica ausência de opções e mantém filtros opcionais", async () => {
    mockReportsApi({ emptyFilters: true });
    const user = userEvent.setup();
    renderReportsPage();

    await screen.findByText("Resumo fiel fornecido pela API.");
    await user.click(screen.getByText("Filtrar resultados"));
    expect(await screen.findByText("Não há unidades ou massoterapeutas disponíveis para filtrar.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeVisible();
  });

  it("TK-16.04 RF-34 RN-18 RN-04: mostra distribuições, comentários e tabelas por pergunta", async () => {
    mockReportsApi();
    const { container } = renderReportsPage();
    const user = userEvent.setup();

    const feedback = await screen.findByRole("region", { name: /Pesquisa de satis/ });
    expect(within(feedback).getByText(/2 respostas an/)).toBeVisible();
    expect(within(feedback).getByText("9,5 de 10")).toBeVisible();
    const easeTab = within(feedback).getByRole("tab", { name: "Facilidade" });
    await user.click(within(panelForTab(easeTab)).getByText("Ver tabela completa"));
    expect(within(panelForTab(easeTab)).getByRole("table", { name: /facilidade para realizar o agendamento/ })).toBeVisible();
    for (const [tabName, tableName] of [
      ["Tecnologia", /necessidades de uso e navegabilidade/],
      ["Massoterapia", /serviço de massoterapia recebido/],
      ["Recomendação", /recomendaria nossa plataforma/],
    ] as const) {
      const tab = within(feedback).getByRole("tab", { name: tabName });
      await user.click(tab);
      const panel = panelForTab(tab);
      await user.click(within(panel).getByText("Ver tabela completa"));
      expect(within(panel).getByRole("table", { name: tableName })).toBeVisible();
    }
    expect(within(feedback).getByText("<img src=x onerror=alert(1)>")).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    await expectAccessible(feedback);
  });

  it("TK-16.04 RF-34 RN-18: mostra as distribuições zeradas sem respostas", async () => {
    mockReportsApi({ emptyFeedback: true });
    renderReportsPage();
    const user = userEvent.setup();

    const feedback = await screen.findByRole("region", { name: /Pesquisa de satis/ });
    expect(within(feedback).getByText(/0 respostas an/)).toBeVisible();
    expect(within(feedback).getByText(/Indispon.vel.*nenhuma resposta/)).toBeVisible();
    expect(within(feedback).getByText(/Ainda n.*h.*coment/)).toBeVisible();
    let zeroCells = 0;
    for (const tabName of ["Facilidade", "Tecnologia", "Massoterapia", "Recomendação"]) {
      const tab = within(feedback).getByRole("tab", { name: tabName });
      await user.click(tab);
      const panel = panelForTab(tab);
      await user.click(within(panel).getByText("Ver tabela completa"));
      zeroCells += within(panel).getAllByRole("cell", { name: "0" }).length;
    }
    expect(zeroCells).toBeGreaterThan(20);
  });
  it("TK-16.04 RF-34 RN-04: erro da pesquisa recebe foco, preserva os KPIs e permite tentar novamente", async () => {
    const { setFeedbackShouldFail } = mockReportsApi({ failFeedback: true });
    const user = userEvent.setup();
    renderReportsPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(screen.getByText("Resumo fiel fornecido pela API.")).toBeVisible();
    setFeedbackShouldFail(false);
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("region", { name: /Pesquisa de satis/ })).toBeVisible();
  });
});
