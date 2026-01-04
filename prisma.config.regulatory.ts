// prisma.config.regulatory.ts
// Configuration for the regulatory Prisma schema
import { existsSync } from "fs"
import { config } from "dotenv"
import { defineConfig } from "prisma/config"

// Load environment variables from .env.local if it exists (local dev)
// In CI, environment variables are already set
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

// For prisma generate, we don't need a real database URL
// Use a dummy URL if neither REGULATORY_DATABASE_URL nor DATABASE_URL is set (CI jobs without DB service)
const regulatoryUrl =
  process.env.REGULATORY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

export default defineConfig({
  schema: "prisma/regulatory.prisma",
  migrations: {
    path: "prisma/migrations-regulatory",
  },
  datasource: {
    url: regulatoryUrl,
  },
})
