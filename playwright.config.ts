import { defineConfig } from "@playwright/test";

// PLAYWRIGHT_CHROMIUM_EXECUTABLE lets CI / remote sandboxes point at a preinstalled Chromium
// instead of downloading one (`npx playwright install chromium` is the normal local route).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1600, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
