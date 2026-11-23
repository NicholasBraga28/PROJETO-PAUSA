import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { RadioGroup, Radio } from "react-aria-components";
import { Monitor, Sun, Moon, Contrast, type LucideIcon } from "lucide-react";

const THEME_KEY = "theme";
const THEMES: [value: string, label: string, Icon: LucideIcon][] = [
  ["auto", "Automático (segue o sistema)", Monitor],
  ["light", "Claro", Sun],
  ["dark", "Escuro", Moon],
  ["contrast", "Alto contraste", Contrast],
];

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "auto";
  } catch {
    return "auto";
  }
}

function rememberTheme(theme: string) {
  try {
    localStorage.setItem(THEME_KEY, theme === "auto" ? "" : theme);
  } catch {
    return;
  }
}

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = theme;
    rememberTheme(theme);
  }, [theme]);

  return (
    <RadioGroup className="theme" aria-label="Tema" orientation="horizontal" value={theme} onChange={setTheme}>
      {THEMES.map(([v, label, Icon]) => (
        <Radio key={v} value={v} aria-label={label} className="theme-opt">
          {({ isSelected }) => (
            <span className="theme-body" title={label}>
              {isSelected && (
                <motion.span
                  layoutId="pill-theme"
                  className="pill"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <Icon aria-hidden="true" />
            </span>
          )}
        </Radio>
      ))}
    </RadioGroup>
  );
}
