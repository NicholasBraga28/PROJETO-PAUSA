import { motion } from "motion/react";
import { Link, NavLink } from "react-router";
import { Button } from "react-aria-components";
import { Accessibility, House, LogOut } from "lucide-react";
import ThemeSwitch from "@/shared/theme/ThemeSwitch";
import { VisuallyHidden } from "@/shared/a11y/VisuallyHidden";
import BrandLogo from "@/shared/visuals/BrandLogo";

type Anchor = [href: string, label: string];

interface NavbarUser {
  name: string;
  firstName: string;
  roleLabel: string;
}

interface NavbarProps {
  links?: Anchor[];
  cta: Anchor | null;
  profile: NavbarUser | null;
  onSwitch: () => void;
}

export function Navbar({ links = [], cta, profile, onSwitch }: NavbarProps) {
  return (
    <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="nav" aria-label="Principal">
      <div className="nav-in">
        <div className="flex items-center gap-2 md:gap-8">
          <NavLink to="/" className="nav-link nav-home">
            <House className="w-4 h-4" aria-hidden="true" />
            <span className="nav-home-text">Início</span>
          </NavLink>
          <NavLink to="/accessibility" className="nav-a11y">
            <Accessibility className="w-5 h-5" aria-hidden="true" />
            <span className="nav-a11y-text">Acessibilidade</span>
          </NavLink>
          <Link to="/" className="nav-brand">
            <BrandLogo className="nav-logo" />
            <VisuallyHidden>Pausa, página inicial</VisuallyHidden>
          </Link>
          <NavLink to="/chat" className="nav-a11y">
            Tirar dúvidas
          </NavLink>
          {links.length > 0 && (
            <ul className="hidden md:flex items-center gap-8 text-sm font-medium">
              {links.map(([href, label]) => (
                <li key={href}>
                  {href.startsWith("/") ? (
                    <Link to={href} className="nav-link">
                      {label}
                    </Link>
                  ) : (
                    <a href={href} className="nav-link">
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {links.some(([href]) => href === "/profile") ? (
            <Link to="/profile" className="nav-link nav-profile-mobile md:hidden" aria-label="Meu perfil">
              Perfil
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <ThemeSwitch />
          {profile && (
            <Button
              className="nav-user"
              onPress={onSwitch}
              aria-label={`${profile.name}, ${profile.roleLabel}. Trocar de usuário`}
            >
              <span className="nav-user-name" aria-hidden="true">
                {profile.firstName}
              </span>
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
          {cta &&
            (cta[0].startsWith("/") ? (
              <Link to={cta[0]} className="nav-cta">
                {cta[1]}
              </Link>
            ) : (
              <a href={cta[0]} className="nav-cta">
                {cta[1]}
              </a>
            ))}
        </div>
      </div>
    </motion.nav>
  );
}
