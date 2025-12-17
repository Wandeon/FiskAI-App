import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"
import { customType } from "drizzle-orm/pg-core"

// Custom vector type for pgvector
// Drizzle doesn't have native vector support, so we use customType
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)"
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,...]" format
    return JSON.parse(value.replace(/^\[/, "[").replace(/\]$/, "]"))
  },
})

export const sourceChunkEmbeddings = pgTable(
  "SourceChunk",
  {
    id: text("id").primaryKey(),
    factSheetId: text("factSheetId").notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding"),
    fetchedAt: timestamp("fetchedAt").defaultNow(),
  },
  (table) => ({
    factSheetIdx: index("source_chunk_fact_sheet_idx").on(table.factSheetId),
  })
)
