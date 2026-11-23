import { defineConfig, devices } from "@playwright/test";

const A11Y_SUITE_PORT = 4319;
const TEST_TIMEOUT_MS = 60_000;
const SERVER_START_TIMEOUT_MS = 120_000;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: "50%",
  timeout: TEST_TIMEOUT_MS,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${A11Y_SUITE_PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${A11Y_SUITE_PORT} --strictPort`,
    url: `http://localhost:${A11Y_SUITE_PORT}`,
    reuseExistingServer: false,
    timeout: SERVER_START_TIMEOUT_MS,
  },
});
