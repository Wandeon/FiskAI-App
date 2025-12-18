import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as embeddings from "./schema/embeddings"
import * as guidance from "../schema/guidance"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const drizzleDb = drizzle(pool, {
  schema: { ...embeddings, ...guidance },
})

export { embeddings, guidance }
