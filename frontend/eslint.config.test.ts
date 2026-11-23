import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint();

async function importErrors(file: string, source: string) {
  const [result] = await eslint.lintText(`import "${source}";\n`, { filePath: file });
  return (result?.messages ?? []).filter((message) => message.ruleId === "no-restricted-imports");
}

describe("TK-09.02: fronteiras entre pastas do src", () => {
  it("acusa erro quando uma feature importa de outra feature", async () => {
    expect(await importErrors("src/features/booking/slots.ts", "@/features/auth/api")).toHaveLength(1);
  });

  it("aceita imports de dentro da própria feature e de shared", async () => {
    expect(await importErrors("src/features/booking/slots.ts", "@/features/booking/api")).toHaveLength(0);
    expect(await importErrors("src/features/check-in/api.ts", "@/shared/api/client")).toHaveLength(0);
  });

  it("acusa erro quando uma feature importa de app", async () => {
    expect(await importErrors("src/features/auth/api.ts", "@/app/App")).toHaveLength(1);
  });

  it("acusa erro quando shared importa de uma feature ou de app", async () => {
    expect(await importErrors("src/shared/ui/Navbar.tsx", "@/features/auth/hooks/use-session")).toHaveLength(1);
    expect(await importErrors("src/shared/ui/Navbar.tsx", "@/app/App")).toHaveLength(1);
  });

  it("acusa erro em import relativo que sobe de pasta, pedindo o alias @/", async () => {
    expect(await importErrors("src/app/App.tsx", "../shared/api/client")).toHaveLength(1);
  });

  it("aceita import relativo na mesma pasta", async () => {
    expect(await importErrors("src/shared/ui/Navbar.tsx", "./motion")).toHaveLength(0);
  });
});

describe("TK-09.07: HTML vindo de fora (RNF-04)", () => {
  it("RNF-04: acusa erro quando um componente usa dangerouslySetInnerHTML", async () => {
    const source =
      "export function Note({ html }: { html: string }) {\n  return <p dangerouslySetInnerHTML={{ __html: html }} />;\n}\n";
    const [result] = await eslint.lintText(source, { filePath: "src/shared/ui/Note.tsx" });
    const ruleIds = (result?.messages ?? []).map((message) => message.ruleId);
    expect(ruleIds).toContain("react/no-danger");
  });
});

describe("TK-09.09: qualidade do código", () => {
  async function ruleIds(file: string, source: string) {
    const [result] = await eslint.lintText(source, { filePath: file });
    return (result?.messages ?? []).map((message) => message.ruleId);
  }

  it("acusa erro em comentário de linha e de bloco, inclusive em JSX", async () => {
    expect(await ruleIds("src/shared/ui/Note.ts", "// explica\nexport const NOTE = 1;\n")).toContain(
      "local/no-comments",
    );
    expect(await ruleIds("e2e/support/note.ts", "/* explica */\nexport const NOTE = 1;\n")).toContain(
      "local/no-comments",
    );
    expect(
      await ruleIds("src/shared/ui/Note.tsx", "export function Note() {\n  return <p>{/* explica */}oi</p>;\n}\n"),
    ).toContain("local/no-comments");
  });

  it("acusa erro em diretiva eslint-disable, que também é comentário", async () => {
    expect(
      await ruleIds("src/shared/ui/Note.ts", "// eslint-disable-next-line no-console\nconsole.log(1);\n"),
    ).toContain("local/no-comments");
  });

  it("aceita código sem comentários", async () => {
    expect(await ruleIds("src/shared/ui/Note.ts", "export const NOTE = 1;\n")).toEqual([]);
  });

  it("liga as regras de acessibilidade, hooks, tipos e HTML injetado", async () => {
    const { rules = {} } = await eslint.calculateConfigForFile("src/shared/ui/Note.tsx");
    const severity = (rule: string) => [rules[rule]].flat()[0];
    for (const rule of [
      "jsx-a11y/no-autofocus",
      "jsx-a11y/no-noninteractive-element-interactions",
      "react-hooks/rules-of-hooks",
      "react-hooks/exhaustive-deps",
      "@typescript-eslint/no-explicit-any",
      "@typescript-eslint/no-non-null-assertion",
      "react/no-danger",
    ]) {
      expect(severity(rule), rule).toBe(2);
    }
  });
});
