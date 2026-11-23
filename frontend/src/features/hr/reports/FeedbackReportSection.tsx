import { useEffect, useRef, useState } from "react";
import { Button, Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { errorMessage } from "@/shared/api/api-error";
import { KpiLineChart } from "./KpiLineChart";
import { KpiTable } from "./KpiTable";
import { getFeedbackReport, type FeedbackReport } from "./api";

type FeedbackDistributionKey = "bookingEase" | "technologySatisfaction" | "serviceRating" | "recommendation";

const DISTRIBUTIONS: Array<{
  key: FeedbackDistributionKey;
  tabLabel: string;
  title: string;
  answerLabels: Partial<Record<number, string>>;
}> = [
  {
    key: "bookingEase",
    tabLabel: "Facilidade",
    title: "Como você avalia a facilidade para realizar o agendamento pela plataforma?",
    answerLabels: { 1: "Muito fácil", 2: "Fácil", 3: "Regular", 4: "Difícil", 5: "Muito difícil" },
  },
  {
    key: "technologySatisfaction",
    tabLabel: "Tecnologia",
    title: "Em relação à tecnologia, a plataforma atendeu às suas necessidades de uso e navegabilidade?",
    answerLabels: {
      1: "Atendeu totalmente",
      2: "Atendeu em grande parte",
      3: "Atendeu parcialmente",
      4: "Não atendeu",
    },
  },
  {
    key: "serviceRating",
    tabLabel: "Massoterapia",
    title: "Como você avalia o serviço de massoterapia recebido?",
    answerLabels: { 1: "Excelente", 2: "Bom", 3: "Regular", 4: "Ruim", 5: "Péssimo" },
  },
  {
    key: "recommendation",
    tabLabel: "Recomendação",
    title: "De 0 a 10, o quanto você recomendaria nossa plataforma e serviços para um amigo ou familiar?",
    answerLabels: {},
  },
];

function responseCountLabel(totalResponses: number) {
  return `${totalResponses} ${totalResponses === 1 ? "resposta anônima" : "respostas anônimas"}`;
}

function recommendationAverageLabel(average: number | null) {
  if (average === null) return "Indisponível — nenhuma resposta";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(average)} de 10`;
}

function FeedbackDistributions({ report }: { report: FeedbackReport }) {
  return (
    <section className="hr-feedback-distributions" aria-labelledby="feedback-distributions-title">
      <header className="hr-section-heading">
        <h3 id="feedback-distributions-title">Respostas por pergunta</h3>
        <p>Escolha uma pergunta para consultar a distribuição das respostas.</p>
      </header>
      <Tabs className="hr-report-tabs" defaultSelectedKey="bookingEase">
        <TabList className="hr-report-tab-list" aria-label="Selecionar pergunta da pesquisa">
          {DISTRIBUTIONS.map(({ key, tabLabel }) => (
            <Tab className="hr-report-tab" id={key} key={key}>
              {tabLabel}
            </Tab>
          ))}
        </TabList>
        {DISTRIBUTIONS.map(({ key, title, answerLabels }) => {
          const rows = report[key].map(({ value, count }) => [
            answerLabels[value] ?? (key === "recommendation" ? `${value} de 10` : String(value)),
            String(count),
          ]);
          const chartItems = report[key].map(({ value, count }) => ({
            label: answerLabels[value] ?? `${value} de 10`,
            axisLabel:
              key === "technologySatisfaction"
                ? ({ 1: "Totalmente", 2: "Em grande parte", 3: "Parcialmente", 4: "Não atendeu" }[value] ??
                  String(value))
                : (answerLabels[value] ?? String(value)),
            value: count,
          }));

          return (
            <TabPanel className="hr-report-tab-panel" id={key} key={key}>
              <h4>{title}</h4>
              <KpiLineChart label={`Respostas: ${title}`} unit="responses" items={chartItems} />
              <details className="hr-kpi-table-details">
                <summary>Ver tabela completa</summary>
                <KpiTable caption={`Distribuição: ${title}`} headings={["Resposta", "Quantidade"]} rows={rows} />
              </details>
            </TabPanel>
          );
        })}
      </Tabs>
    </section>
  );
}

function FeedbackComments({ comments }: { comments: string[] }) {
  return (
    <section className="hr-feedback-comments" aria-labelledby="feedback-comments-title">
      <h3 id="feedback-comments-title">Comentários anônimos</h3>
      {comments.length === 0 ? (
        <p className="hr-state">Ainda não há comentários.</p>
      ) : (
        <ul aria-label="Comentários anônimos">
          {comments.map((comment, index) => (
            <li key={`${index}-${comment}`}>
              <p>{comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FeedbackReportSection() {
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  const retry = () => {
    setState("loading");
    setMessage(null);
    setReload((value) => value + 1);
  };

  useEffect(() => {
    let isCurrent = true;
    getFeedbackReport().then(
      (result) => {
        if (!isCurrent) return;
        setReport(result);
        setState("ready");
      },
      (error: unknown) => {
        if (!isCurrent) return;
        setMessage(errorMessage(error));
        setState("error");
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [reload]);

  useEffect(() => {
    if (state === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <section className="hr-panel hr-feedback" aria-labelledby="feedback-report-title" aria-busy={state === "loading"}>
      <header className="hr-feedback-heading">
        <h2 id="feedback-report-title">Pesquisa de satisfação</h2>
        <p>Respostas anônimas, sem identificação de colaboradores ou atendimentos.</p>
      </header>
      {state === "loading" && (
        <p className="hr-state" role="status">
          Carregando resultados da pesquisa…
        </p>
      )}
      {state === "error" && message && (
        <div className="hr-error" role="alert" tabIndex={-1} ref={errorRef}>
          <p>{message}</p>
          <Button className="cta" onPress={retry}>
            Tentar novamente
          </Button>
        </div>
      )}
      {state === "ready" && report && (
        <>
          <section className="hr-feedback-summary" aria-label="Resumo das respostas">
            <div>
              <p className="hr-kpi-label">Participação</p>
              <p className="hr-kpi-value">{responseCountLabel(report.totalResponses)}</p>
            </div>
            <div>
              <p className="hr-kpi-label">Média de recomendação</p>
              <p className="hr-kpi-value">{recommendationAverageLabel(report.recommendationAverage)}</p>
            </div>
          </section>
          <FeedbackDistributions report={report} />
          <FeedbackComments comments={report.comments} />
        </>
      )}
    </section>
  );
}
