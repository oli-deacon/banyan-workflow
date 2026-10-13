import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "npm run dev:mock -- --port 3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    env: { BANYAN_ACCESS: "", BANYAN_LOCAL_API: "1", BANYAN_STORAGE: "mock" },
  },
});
