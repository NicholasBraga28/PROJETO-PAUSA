import { readFileSync } from "node:fs";
import { checkContrast, readThemes } from "./contrast.ts";
import { PAIRS, THEMES, THEMES_CSS } from "./theme-pairs.ts";

const css = readFileSync(THEMES_CSS, "utf8");
const failures = checkContrast(readThemes(css, THEMES), PAIRS);

if (failures.length) {
  console.error(`${failures.length} par(es) abaixo da meta de contraste:`);
  for (const failure of failures) {
    const { theme, foreground, background, use, ratio, target } = failure;
    console.error(`- ${theme}: ${foreground} sobre ${background} (${use}) tem ${ratio.toFixed(2)}:1, meta ${target}:1`);
  }
  process.exit(1);
}
console.log(`Contraste ok: ${PAIRS.length} pares em ${Object.keys(THEMES).length} temas.`);
