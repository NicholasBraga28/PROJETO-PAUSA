import type { MouseEvent } from "react";

export interface SkipLink {
  target: string;
  label: string;
}

const CONTENT: SkipLink = { target: "conteudo", label: "Pular para o conteúdo" };

function focusTarget(event: MouseEvent<HTMLAnchorElement>, target: string) {
  const region = document.getElementById(target);
  if (!region) return;
  event.preventDefault();
  if (!region.hasAttribute("tabindex")) region.setAttribute("tabindex", "-1");
  region.focus();
}

interface SkipLinksProps {
  links?: SkipLink[];
}

export function SkipLinks({ links = [CONTENT] }: SkipLinksProps) {
  return (
    <div className="skip-links">
      {links.map(({ target, label }) => (
        <a key={target} className="skip" href={`#${target}`} onClick={(event) => focusTarget(event, target)}>
          {label}
        </a>
      ))}
    </div>
  );
}
