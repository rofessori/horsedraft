import { defineConfig } from "@playwright/test";

// Drives the real Electron shell (`electron .`) on the developer's machine or a macOS CI runner.
// Needs `npm run build && npm run electron:build` first; `npm run e2e:app` does all three.
export default defineConfig({
  testDir: "tests/electron",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  outputDir: "test-results/electron",
  use: { screenshot: "only-on-failure", trace: "retain-on-failure" },
});
