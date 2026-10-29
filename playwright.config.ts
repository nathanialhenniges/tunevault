import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
});
