import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkContrast, contrastRatio, readThemes } from "./contrast.ts";
import { PAIRS, THEMES, THEMES_CSS } from "./theme-pairs.ts";

describe("contrastRatio", () => {
  it("TK-09.06 RN-04: dá 21:1 entre preto e branco, em qualquer ordem", () => {
    expect(contrastRatio("#000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFF", "#000000")).toBeCloseTo(21, 5);
  });

  it("TK-09.06 RN-04: dá 4,48:1 entre #777 e branco (exemplo da WCAG)", () => {
    expect(contrastRatio("#777777", "#fff")).toBeCloseTo(4.48, 2);
  });

  it("TK-09.06 RN-04: aceita rgb() com espaços", () => {
    expect(contrastRatio("rgb(0 0 0)", "rgb(255 255 255)")).toBeCloseTo(21, 5);
  });
});

describe("readThemes", () => {
  const css = `
    :root { --ink: #111; --canvas: #fff; --nav: var(--canvas); }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) { --ink: #eee; --canvas: #000; }
    }
    :root[data-theme="dark"] { --ink: #ddd; --canvas: #000; }
  `;

  it("TK-09.06 RN-04: junta os blocos de cada tema na ordem dada, resolvendo var()", () => {
    const themes = readThemes(css, {
      Claro: [":root"],
      "Automático, sistema escuro": [":root", "@media (prefers-color-scheme: dark)"],
      Escuro: [":root", ':root[data-theme="dark"]'],
    });
    expect(themes.Claro).toMatchObject({ "--ink": "#111", "--nav": "#fff" });
    expect(themes["Automático, sistema escuro"]).toMatchObject({ "--ink": "#eee", "--nav": "#000" });
    expect(themes.Escuro).toMatchObject({ "--ink": "#ddd", "--canvas": "#000" });
  });

  it("TK-09.06 RN-04: falha quando um tema cita um bloco que não existe no CSS", () => {
    expect(() => readThemes(css, { Sépia: [":root", ':root[data-theme="sepia"]'] })).toThrow(/sepia/);
  });
});

describe("checkContrast", () => {
  const themes = { Claro: { "--ink": "#777777", "--canvas": "#ffffff", "--focus": "#949494" } };

  it("TK-09.06 RN-04: lista os pares abaixo da meta de cada tipo (texto 7:1, texto grande 4,5:1, componente 3:1)", () => {
    const failures = checkContrast(themes, [
      { foreground: "--ink", background: "--canvas", kind: "text", use: "texto corrido" },
      { foreground: "--ink", background: "--canvas", kind: "large", use: "título" },
      { foreground: "--focus", background: "--canvas", kind: "ui", use: "anel de foco" },
    ]);
    expect(failures).toEqual([
      expect.objectContaining({ theme: "Claro", use: "texto corrido", target: 7, ratio: expect.closeTo(4.48, 2) }),
      expect.objectContaining({ theme: "Claro", use: "título", target: 4.5 }),
    ]);
  });

  it("TK-09.06 RN-04: falha quando o par cita um token que o tema não define", () => {
    expect(() =>
      checkContrast(themes, [{ foreground: "--warn", background: "--canvas", kind: "text", use: "erro" }]),
    ).toThrow(/--warn/);
  });
});

describe("themes.css", () => {
  it("TK-09.06 RN-04: todo par de tokens atinge a meta em todos os temas, inclusive o automático", () => {
    const css = readFileSync(THEMES_CSS, "utf8");
    expect(checkContrast(readThemes(css, THEMES), PAIRS)).toEqual([]);
  });
});
