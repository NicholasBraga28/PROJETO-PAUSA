import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

const SUPPORT_GROUPS = [
  {
    id: "diagnostico",
    heading: "Acompanhar o serviço",
    links: [
      { to: "/hr/audit", label: "Histórico de alterações" },
      { to: "/hr/reports", label: "Relatórios de atendimento" },
    ],
  },
  {
    id: "configuracao",
    heading: "Configurações",
    links: [
      { to: "/hr/rules", label: "Horários e limites de agendamento" },
      { to: "/hr/alexa-pairing", label: "Conectar a Alexa" },
    ],
  },
  {
    id: "operacao-beneficio",
    heading: "Gerenciar atendimentos",
    links: [
      { to: "/hr/users", label: "Usuários" },
      { to: "/hr/locations", label: "Unidades e salas" },
      { to: "/hr/schedules", label: "Horários de atendimento" },
      { to: "/hr/blocks", label: "Horários sem atendimento" },
    ],
  },
] as const;

export default function SupportPage() {
  return (
    <main id="conteudo" className="page">
      <div className="page-in hr-page support-page">
        <header className="hr-heading">
          <h1 tabIndex={-1} className="display">
            Suporte
          </h1>
          <p className="lede">Ferramentas para investigar ocorrências e administrar o sistema.</p>
        </header>
        <div className="support-groups">
          {SUPPORT_GROUPS.map(({ id, heading, links }) => (
            <section className="hr-panel support-group" key={id} aria-labelledby={`support-${id}`}>
              <h2 id={`support-${id}`}>{heading}</h2>
              <nav className="hr-navigation support-links" aria-label={heading}>
                {links.map(({ to, label }) => (
                  <Link to={to} className="support-link" key={to}>
                    <span>{label}</span>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
