// Prisma configuration file
// Note: In production Docker builds, dotenv is not available and not needed
// (environment variables are set by the container runtime)
import { existsSync } from "fs"
import { defineConfig } from "prisma/config"

// Load environment variables from .env.local if it exists (local dev only)
// In CI and production, environment variables are already set
if (existsSync(".env.local")) {
  try {
    // Dynamic import to avoid hard dependency on dotenv in production
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { config } = require("dotenv")
    config({ path: ".env.local" })
  } catch {
    // dotenv not available (production build), env vars should already be set
  }
}

// For prisma generate, we don't need a real database URL
// Use a dummy URL if DATABASE_URL is not set (CI jobs without DB service)
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
})
