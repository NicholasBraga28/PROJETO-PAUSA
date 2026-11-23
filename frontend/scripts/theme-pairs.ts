import type { Pair, ThemeBlocks } from "./contrast.ts";

export const THEMES_CSS = new URL("../src/styles/themes.css", import.meta.url);

const DARK_SYSTEM = "@media (prefers-color-scheme: dark)";
const CONTRAST_SYSTEM = "@media (prefers-contrast: more)";

export const THEMES: ThemeBlocks = {
  Claro: [":root"],
  Escuro: [":root", ':root[data-theme="dark"]'],
  "Alto contraste": [":root", ':root[data-theme="contrast"]'],
  "Automático, sistema claro": [":root"],
  "Automático, sistema escuro": [":root", DARK_SYSTEM],
  "Automático, sistema claro com mais contraste": [":root", CONTRAST_SYSTEM],
  "Automático, sistema escuro com mais contraste": [":root", DARK_SYSTEM, CONTRAST_SYSTEM],
};

const text = (foreground: string, background: string, use: string): Pair => ({
  foreground,
  background,
  kind: "text",
  use,
});
const ui = (foreground: string, background: string, use: string): Pair => ({ foreground, background, kind: "ui", use });

export const PAIRS: readonly Pair[] = [
  text("--ink", "--canvas", "texto da agenda e das páginas"),
  text("--ink", "--hero-bg", "texto da agenda no início do degradê"),
  text("--ink", "--card", "texto dos painéis e cartões"),
  text("--ink", "--input", "texto digitado nos campos"),
  text("--slate", "--canvas", "texto secundário"),
  text("--slate", "--hero-bg", "texto secundário no início do degradê"),
  text("--slate", "--card", "texto secundário nos painéis"),
  text("--slate", "--input", "texto de exemplo nos campos"),
  text("--primary", "--canvas", "links, números das etapas e destaques"),
  text("--primary", "--hero-bg", "destaque do título da agenda"),
  text("--primary", "--card", "texto dos horários e botões secundários"),
  text("--on-primary", "--primary", "texto sobre a ação principal e a opção escolhida"),
  text("--soft-ink", "--soft", "selos, dias livres e status"),
  text("--warn", "--card", "mensagem de erro do campo"),
  text("--on-warn", "--warn", "botão de ação destrutiva"),
  text("--hero-ink", "--hero-bg", "texto do hero"),
  text("--hero-muted", "--hero-bg", "texto secundário do hero"),
  text("--hero-bg", "--hero-ink", "botões cheios do hero"),
  text("--hero-ink", "--nav-bg", "texto da barra do topo"),
  text("--hero-muted", "--nav-bg", "links da barra do topo"),
  ui("--focus", "--canvas", "anel de foco na agenda"),
  ui("--focus", "--card", "anel de foco nos painéis"),
  ui("--focus", "--hero-bg", "anel de foco no hero"),
  ui("--logo-front", "--hero-bg", "traços roxos da logo sobre a página"),
  ui("--logo-front", "--nav-bg", "traços roxos da logo sobre a barra, em tela estreita"),
  ui("--focus", "--nav-bg", "anel de foco na barra do topo"),
  ui("--line", "--card", "borda dos campos e cartões"),
  ui("--line", "--input", "borda dos campos"),
  ui("--line", "--canvas", "borda dos cartões passados e da legenda"),
  ui("--lavender", "--card", "borda das opções e horários"),
  ui("--lavender", "--canvas", "borda das opções sobre a agenda"),
  ui("--lavender", "--input", "hachura dos horários ocupados"),
  ui("--lavender", "--hero-bg", "borda das pessoas no início do degradê"),
  ui("--primary", "--card", "opção escolhida"),
  ui("--primary", "--canvas", "opção escolhida sobre a agenda"),
  ui("--primary", "--hero-bg", "borda das pessoas ao passar o mouse, no início do degradê"),
  ui("--lilac", "--card", "prévia do horário na barra do dia"),
  ui("--warn", "--input", "borda do campo inválido"),
  ui("--hero-line", "--hero-bg", "bordas dos controles do hero"),
  ui("--hero-line", "--nav-bg", "bordas da barra do topo"),
];
