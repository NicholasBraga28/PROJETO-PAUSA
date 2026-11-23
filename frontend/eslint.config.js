import { readdirSync } from "node:fs";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

const FEATURES = readdirSync(new URL("./src/features", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const PARENT_IMPORT = { regex: "^\\.\\./", message: "Use o alias @/ em imports entre pastas." };
const APP_IMPORT = { regex: "^@/app/", message: "Só o app/ monta as features." };
const restrictImports = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns: [PARENT_IMPORT, ...patterns] }],
});

const noComments = {
  meta: {
    type: "suggestion",
    messages: {
      comment: "Sem comentários no código: dê nome à intenção ou leve o porquê para o CONTEXT.md ou um teste.",
    },
  },
  create: (context) => ({
    Program: () => {
      for (const comment of context.sourceCode.getAllComments()) {
        context.report({ loc: comment.loc, messageId: "comment" });
      }
    },
  }),
};

export default tseslint.config(
  { ignores: ["dist", "playwright-report", "test-results"] },
  { linterOptions: { noInlineConfig: true } },
  js.configs.recommended,
  tseslint.configs.strict,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.strict,
  {
    files: ["**/*.{js,ts,tsx}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: "detect" } },
    plugins: { "react-hooks": reactHooks, local: { rules: { "no-comments": noComments } } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "local/no-comments": "error",
      "react/prop-types": "off",
      "react/no-danger": "error",
      "react/no-unknown-property": "off",
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  { files: ["src/**"], rules: restrictImports() },
  {
    files: ["src/shared/**"],
    rules: restrictImports(APP_IMPORT, { regex: "^@/features/", message: "O shared/ não depende de nenhuma feature." }),
  },
  ...FEATURES.map((feature) => ({
    files: [`src/features/${feature}/**`],
    rules: restrictImports(APP_IMPORT, {
      regex: `^@/features/(?!${feature}(/|$))`,
      message: "Uma feature não importa de outra; o que for comum sobe para shared/.",
    }),
  })),
);
