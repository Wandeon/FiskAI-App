import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  timeout: 900000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.MARKETING_AUDIT_TARGET_URL ?? "https://fiskai.hr",
    trace: "retain-on-failure",
  },
})
