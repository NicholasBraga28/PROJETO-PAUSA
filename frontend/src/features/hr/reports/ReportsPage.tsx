import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useAnnounce } from "@/shared/a11y/use-announce";
import { errorMessage } from "@/shared/api/api-error";
import {
  getKpis,
  getReportLocations,
  getReportTherapists,
  type KpiQuery,
  type KpiReport,
  type ReportLocation,
  type ReportTherapist,
} from "./api";
import { KpiSections } from "./KpiSections";
import { FeedbackReportSection } from "./FeedbackReportSection";
import { ReportFilters } from "./ReportFilters";
import { currentMonthRange } from "./report-format";
import { HrNavigation } from "@/features/hr/HrNavigation";

type LoadState = "loading" | "ready" | "error";

interface ReportsPageProps {
  isSupportUser?: boolean;
}

export default function ReportsPage({ isSupportUser = false }: ReportsPageProps) {
  const announce = useAnnounce();
  const [locations, setLocations] = useState<ReportLocation[]>([]);
  const [therapists, setTherapists] = useState<ReportTherapist[]>([]);
  const [initialQuery] = useState<KpiQuery>(() => ({
    ...currentMonthRange(new Date()),
    locationId: "",
    therapistId: "",
    granularity: "DAY",
  }));
  const [filters, setFilters] = useState<KpiQuery>(initialQuery);
  const [lastQuery, setLastQuery] = useState<KpiQuery>(initialQuery);
  const [filterState, setFilterState] = useState<LoadState>("loading");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [reportState, setReportState] = useState<"loading" | "ready" | "error">("loading");
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<KpiReport | null>(null);
  const reportErrorRef = useRef<HTMLDivElement>(null);

  const loadFilters = useCallback(async () => {
    setFilterState("loading");
    setFilterError(null);
    try {
      const [locationResults, therapistResults] = await Promise.all([getReportLocations(), getReportTherapists()]);
      setLocations(locationResults);
      setTherapists(therapistResults);
      setFilterState("ready");
    } catch (error: unknown) {
      setFilterError(errorMessage(error));
      setFilterState("error");
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getReportLocations(), getReportTherapists()]).then(
      ([locationResults, therapistResults]) => {
        if (!isCurrent) return;
        setLocations(locationResults);
        setTherapists(therapistResults);
        setFilterState("ready");
      },
      (error: unknown) => {
        if (!isCurrent) return;
        setFilterError(errorMessage(error));
        setFilterState("error");
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (reportState === "error") reportErrorRef.current?.focus();
  }, [reportState]);

  const runQuery = useCallback(
    async (query: KpiQuery) => {
      setReportState("loading");
      setReportError(null);
      setReport(null);
      try {
        const result = await getKpis(query);
        setReport(result);
        setReportState("ready");
        announce(result.spokenText);
      } catch (error: unknown) {
        setReportError(errorMessage(error));
        setReportState("error");
      }
    },
    [announce],
  );

  useEffect(() => {
    const requestId = window.setTimeout(() => void runQuery(lastQuery), 0);
    return () => window.clearTimeout(requestId);
  }, [lastQuery, runQuery]);

  const submit = () => {
    if (filters.from > filters.to) {
      setReportError("A data inicial deve ser igual ou anterior à data final.");
      setReportState("error");
      setReport(null);
      return;
    }
    setLastQuery({ ...filters });
  };

  return (
    <main id="conteudo" className="page">
      <div className="page-in hr-page">
        <HrNavigation isSupportUser={isSupportUser} />
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Relatórios de atendimento
          </h1>
          <p className="lede">Consulte demanda e cancelamentos por período, unidade e massoterapeuta.</p>
        </header>
        <section className="hr-panel" aria-labelledby="report-results-title" aria-busy={reportState === "loading"}>
          <div className="hr-report-panel-heading">
            <h2 id="report-results-title">Indicadores do mês</h2>
            <ReportFilters
              locations={locations}
              therapists={therapists}
              value={filters}
              isBusy={reportState === "loading"}
              filterState={filterState}
              filterError={filterError}
              onChange={setFilters}
              onMonthChange={(query) => setLastQuery({ ...query })}
              onSubmit={submit}
              onRetryFilters={() => void loadFilters()}
            />
          </div>
          {reportState === "loading" && (
            <p className="hr-state" role="status">
              Consultando indicadores…
            </p>
          )}
          {reportState === "error" && reportError && (
            <div className="hr-error" role="alert" tabIndex={-1} ref={reportErrorRef}>
              <p>{reportError}</p>
              <Button className="cta" onPress={() => void runQuery(lastQuery)}>
                Tentar novamente
              </Button>
            </div>
          )}
          {reportState === "ready" && report && <KpiSections report={report} />}
        </section>
        <FeedbackReportSection />
      </div>
    </main>
  );
}
