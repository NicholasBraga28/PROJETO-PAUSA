import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const FONT_FILE_PATTERN = /\.(woff2?|ttf|otf)$/;

type VercelConfig = { headers: { headers: { key: string; value: string }[] }[] };
const vercelConfig = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as VercelConfig;
const SECURITY_HEADERS = Object.fromEntries(
  vercelConfig.headers.flatMap((rule) => rule.headers.map(({ key, value }) => [key, value])),
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: false,
      assetsInlineLimit: (file: string) => (FONT_FILE_PATTERN.test(file) ? false : undefined),
    },
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    optimizeDeps: { include: ["three", "three/addons/environments/RoomEnvironment.js"] },
    server: { proxy: { "/api": env.API_PROXY_TARGET || "http://localhost:3000" } },
    preview: { headers: SECURITY_HEADERS, proxy: { "/api": env.API_PROXY_TARGET || "http://localhost:3000" } },
    test: {
      testTimeout: 20_000,
      projects: [
        {
          extends: true,
          test: {
            name: "dom",
            environment: "jsdom",
            setupFiles: ["src/test/setup.ts"],
            include: ["src/**/*.test.{ts,tsx}"],
          },
        },
        { extends: true, test: { name: "scripts", environment: "node", include: ["scripts/**/*.test.ts"] } },
        { extends: true, test: { name: "lint", environment: "node", include: ["eslint.config.test.ts"] } },
      ],
    },
  };
});
