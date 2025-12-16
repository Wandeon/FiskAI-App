// src/lib/db/drizzle.ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const globalForDrizzle = globalThis as unknown as {
  drizzlePool: Pool | undefined
}

// Reuse the pool in development to avoid exhausting connections
const pool =
  globalForDrizzle.drizzlePool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== "production") {
  globalForDrizzle.drizzlePool = pool
}

export const drizzleDb = drizzle(pool, { schema })
