import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const THEME_INIT_URL = "/public/theme-init.js";

async function runThemeInit() {
  vi.resetModules();
  await import(THEME_INIT_URL);
}

describe("TK-09.07: theme-init.js aplica o tema salvo antes do React", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["light", "dark", "contrast"])("RN-04: aplica o tema salvo %s", async (theme) => {
    localStorage.setItem("theme", theme);
    await runThemeInit();
    expect(document.documentElement.dataset.theme).toBe(theme);
  });

  it.each(["", "auto", "neon", '"><img src=x>'])(
    "RNF-04: ignora o valor salvo inválido %j e segue o sistema",
    async (saved) => {
      localStorage.setItem("theme", saved);
      await runThemeInit();
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    },
  );

  it("RN-04: segue o sistema, sem erro, quando o navegador bloqueia o localStorage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    await expect(runThemeInit()).resolves.toBeUndefined();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("RN-04: segue o sistema quando não há tema salvo", async () => {
    await runThemeInit();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
