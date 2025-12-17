import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as embeddings from "./schema/embeddings"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const drizzleDb = drizzle(pool, {
  schema: { ...embeddings },
})

export { embeddings }
