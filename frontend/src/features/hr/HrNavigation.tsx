import type { MouseEvent } from "react";
import { NavLink } from "react-router";

type MenuLink = [to: string, label: string];

const HR_LINKS: MenuLink[] = [
  ["/hr/users", "Usuários"],
  ["/hr/locations", "Unidades e salas"],
  ["/hr/schedules", "Agendas"],
  ["/hr/blocks", "Horários sem atendimento"],
  ["/hr/rules", "Horários e limites"],
  ["/hr/alexa-pairing", "Conectar a Alexa"],
  ["/hr/reports", "Relatórios"],
  ["/hr/audit", "Histórico"],
];

const SUPPORT_LINKS: MenuLink[] = [["/admin", "Suporte"]];

interface HrNavigationProps {
  isSupportUser?: boolean;
}

const isPlainClick = ({ button, ctrlKey, metaKey, shiftKey, altKey }: MouseEvent) =>
  button === 0 && !ctrlKey && !metaKey && !shiftKey && !altKey;

const handleLinkClick = (event: MouseEvent) => {
  if (isPlainClick(event)) window.scrollTo({ top: 0, behavior: "instant" });
};

export function HrNavigation({ isSupportUser = false }: HrNavigationProps) {
  return (
    <nav aria-label={isSupportUser ? "Navegação do suporte" : "Navegação do RH"} className="hr-navigation">
      {(isSupportUser ? SUPPORT_LINKS : HR_LINKS).map(([to, label]) => (
        <NavLink key={to} to={to} onClick={handleLinkClick}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
