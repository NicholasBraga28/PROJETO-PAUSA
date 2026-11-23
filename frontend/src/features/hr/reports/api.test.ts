import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFeedbackReport, getKpis, getReportLocations, getReportTherapists } from "./api";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/client", () => ({ request }));

const report = {
  range: { from: "2026-10-01", to: "2026-10-31", granularity: "WEEK", timezone: "America/Sao_Paulo" },
  filters: { locationId: "location-1", therapistId: "therapist-1" },
  demand: {
    byShift: [
      { shift: "MORNING", appointmentCount: 2 },
      { shift: "AFTERNOON", appointmentCount: 0 },
    ],
    mostRequestedShift: "MORNING",
    byWeekday: [{ weekday: "MONDAY", appointmentCount: 2 }],
    mostRequestedWeekday: "MONDAY",
    byStartTime: [{ time: "09:00", appointmentCount: 2 }],
    mostRequestedStartTime: "09:00",
  },
  cancellations: [
    {
      periodStart: "2026-10-01",
      periodEnd: "2026-10-07",
      scheduledAppointmentCount: 2,
      cancelledAppointmentCount: 1,
      cancellationRatePercent: 50,
    },
  ],
  spokenText: "Resumo retornado pela API.",
};

const feedbackReport = {
  totalResponses: 2,
  bookingEase: [1, 2, 3, 4, 5].map((value) => ({ value, count: value === 1 ? 2 : 0 })),
  technologySatisfaction: [1, 2, 3, 4].map((value) => ({ value, count: value === 1 ? 2 : 0 })),
  serviceRating: [1, 2, 3, 4, 5].map((value) => ({ value, count: value === 1 ? 2 : 0 })),
  recommendation: Array.from({ length: 11 }, (_, value) => ({ value, count: value === 10 ? 2 : 0 })),
  recommendationAverage: 10,
  comments: ["Comentário anônimo."],
};

describe("API de relatórios do RH", () => {
  beforeEach(() => request.mockReset());

  it("TK-12.07 RF-21 D-08: envia período, filtros e granularidade para a API", async () => {
    request.mockResolvedValue(report);

    await expect(
      getKpis({
        from: "2026-10-01",
        to: "2026-10-31",
        locationId: "location-1",
        therapistId: "therapist-1",
        granularity: "WEEK",
      }),
    ).resolves.toEqual(report);

    expect(request).toHaveBeenCalledWith(
      "/reports/kpis?from=2026-10-01&to=2026-10-31&granularity=WEEK&locationId=location-1&therapistId=therapist-1",
      expect.any(Object),
    );
  });

  it("TK-12.07 RF-21 D-08: carrega filtros de unidade e massoterapeutas com perfil", async () => {
    request.mockResolvedValueOnce([
      { id: "location-1", code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo", active: true },
    ]);
    request.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "bruno@example.com",
        name: "Bruno Lima",
        role: "THERAPIST",
        status: "INACTIVE",
        therapistId: "therapist-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(getReportLocations()).resolves.toHaveLength(1);
    await expect(getReportTherapists()).resolves.toEqual([{ id: "therapist-1", name: "Bruno Lima" }]);
  });

  it("TK-12.07 RF-21 D-08: rejeita resposta de KPI incompatível com o contrato", async () => {
    request.mockResolvedValue({ ...report, demand: { byShift: [] } });

    await expect(
      getKpis({ from: "2026-10-01", to: "2026-10-31", locationId: "", therapistId: "", granularity: "DAY" }),
    ).rejects.toThrow();
  });

  it("TK-16.04 RF-34 RN-18: consulta somente o agregado anônimo sem filtros", async () => {
    request.mockResolvedValue(feedbackReport);

    await expect(getFeedbackReport()).resolves.toEqual(feedbackReport);

    expect(request).toHaveBeenCalledWith("/reports/feedback", expect.any(Object));
  });

  it("TK-16.04 RF-34 RN-18: rejeita metadados ou comentário fora do contrato anônimo", async () => {
    request.mockResolvedValue({ ...feedbackReport, comments: [{ text: "Comentário", employeeId: "employee-1" }] });

    await expect(getFeedbackReport()).rejects.toThrow();
  });
});
