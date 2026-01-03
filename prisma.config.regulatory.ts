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

// Get the URL, falling back to DATABASE_URL if REGULATORY_DATABASE_URL not set
const regulatoryUrl = process.env.REGULATORY_DATABASE_URL || process.env.DATABASE_URL

if (!regulatoryUrl) {
  throw new Error(
    "Neither REGULATORY_DATABASE_URL nor DATABASE_URL is set. " +
      "Set at least DATABASE_URL in .env.local or environment."
  )
}

export default defineConfig({
  schema: "prisma/regulatory.prisma",
  migrations: {
    path: "prisma/migrations-regulatory",
  },
  datasource: {
    url: regulatoryUrl,
  },
})
