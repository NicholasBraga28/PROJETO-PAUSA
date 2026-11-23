type Rgb = readonly [r: number, g: number, b: number];
export type Tokens = Record<string, string>;
export type ThemeBlocks = Record<string, readonly string[]>;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/;
const RGB = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/;

function channels(values: readonly number[], source: string): Rgb {
  const [r, g, b] = values;
  if (r === undefined || g === undefined || b === undefined)
    throw new Error(`Cor sólida não reconhecida: "${source}".`);
  return [r, g, b];
}

function parseColor(value: string): Rgb {
  const color = value.trim().toLowerCase();
  const hex = HEX.exec(color)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
    return channels(
      [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)),
      value,
    );
  }
  const rgb = RGB.exec(color);
  if (rgb) return channels(rgb.slice(1).map(Number), value);
  throw new Error(`Cor sólida não reconhecida: "${value}".`);
}

function luminance([r, g, b]: Rgb) {
  const linear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string) {
  const [lighter, darker] = [luminance(parseColor(a)), luminance(parseColor(b))].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function readBlocks(css: string) {
  const blocks = new Map<string, Tokens>();
  const preludes: string[] = [];
  let buffer = "";
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      preludes.push(buffer.trim().replace(/\s+/g, " "));
      buffer = "";
    } else if (char === "}") {
      const key = preludes.filter((prelude) => !prelude.startsWith("@layer")).join(" ");
      const tokens = blocks.get(key) ?? {};
      for (const [, name, token] of buffer.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
        if (name && token) tokens[name] = token.trim();
      }
      if (Object.keys(tokens).length) blocks.set(key, tokens);
      preludes.pop();
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return blocks;
}

function resolve(tokens: Tokens): Tokens {
  const lookup = (value: string, seen: Set<string>): string =>
    value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
      const target = tokens[name];
      if (target === undefined || seen.has(name)) throw new Error(`Token ${name} não definido.`);
      return lookup(target, new Set([...seen, name]));
    });
  return Object.fromEntries(Object.entries(tokens).map(([name, value]) => [name, lookup(value, new Set([name]))]));
}

export function readThemes(css: string, themes: ThemeBlocks): Record<string, Tokens> {
  const blocks = readBlocks(css);
  const find = (selector: string) => {
    const match = [...blocks].find(([key]) => key === selector || key.startsWith(`${selector} `));
    if (!match) throw new Error(`Bloco "${selector}" não encontrado no CSS.`);
    return match[1];
  };
  return Object.fromEntries(
    Object.entries(themes).map(([name, selectors]) => [name, resolve(Object.assign({}, ...selectors.map(find)))]),
  );
}

const TARGET = { text: 7, large: 4.5, ui: 3 } as const;

export interface Pair {
  foreground: string;
  background: string;
  kind: keyof typeof TARGET;
  use: string;
}

export interface Failure extends Pair {
  theme: string;
  ratio: number;
  target: number;
}

export function checkContrast(themes: Record<string, Tokens>, pairs: readonly Pair[]): Failure[] {
  return Object.entries(themes).flatMap(([theme, tokens]) =>
    pairs.flatMap((pair) => {
      const color = (name: string) => {
        const value = tokens[name];
        if (value === undefined) throw new Error(`O tema ${theme} não define ${name}.`);
        return value;
      };
      const ratio = contrastRatio(color(pair.foreground), color(pair.background));
      const target = TARGET[pair.kind];
      return ratio < target ? [{ ...pair, theme, ratio, target }] : [];
    }),
  );
}
