// src/lib/regulatory-truth/agents/reference-extractor.ts

import { db, dbReg } from "@/lib/db"
import { runAgent } from "./runner"
import { ReferenceTableSchema, type ReferenceTable } from "../schemas/reference"
import { getExtractableContent } from "../utils/content-provider"
import { cleanContent } from "../utils/content-cleaner"
import { z } from "zod"

const ReferenceExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  url: z.string(),
})

const ReferenceExtractorOutputSchema = z.object({
  tables: z.array(ReferenceTableSchema),
  extractionNotes: z.string().optional(),
})

type ReferenceExtractorInput = z.infer<typeof ReferenceExtractorInputSchema>
type ReferenceExtractorOutput = z.infer<typeof ReferenceExtractorOutputSchema>

export interface ReferenceExtractionResult {
  success: boolean
  tables: ReferenceTable[]
  tableIds: string[]
  error: string | null
}

/**
 * Extract reference tables (IBANs, codes, lookup data) from content
 */
export async function runReferenceExtractor(
  evidenceId: string
): Promise<ReferenceExtractionResult> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
  })

  if (!evidence) {
    return {
      success: false,
      tables: [],
      tableIds: [],
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  const { text: content } = await getExtractableContent(evidenceId)
  const cleanedContent = cleanContent(content, evidence.url)

  const input: ReferenceExtractorInput = {
    evidenceId: evidence.id,
    content: cleanedContent.slice(0, 50000),
    url: evidence.url,
  }

  const result = await runAgent<ReferenceExtractorInput, ReferenceExtractorOutput>({
    agentType: "REFERENCE_EXTRACTOR",
    input,
    inputSchema: ReferenceExtractorInputSchema,
    outputSchema: ReferenceExtractorOutputSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      tables: [],
      tableIds: [],
      error: result.error ?? "Reference extraction failed",
    }
  }

  const tableIds: string[] = []

  for (const table of result.output.tables) {
    // Check for existing table (upsert by category+name+jurisdiction)
    const existing = await db.referenceTable.findUnique({
      where: {
        category_name_jurisdiction: {
          category: table.category,
          name: table.name,
          jurisdiction: table.jurisdiction,
        },
      },
    })

    if (existing) {
      // Update entries for existing table
      await db.referenceEntry.deleteMany({
        where: { tableId: existing.id },
      })

      for (const entry of table.entries) {
        await db.referenceEntry.create({
          data: {
            tableId: existing.id,
            key: entry.key,
            value: entry.value,
            metadata: entry.metadata ?? undefined,
          },
        })
      }

      await db.referenceTable.update({
        where: { id: existing.id },
        data: { lastUpdated: new Date() },
      })

      tableIds.push(existing.id)
      console.log(`[reference-extractor] Updated existing table: ${table.name}`)
      continue
    }

    // Create new table
    const dbTable = await db.referenceTable.create({
      data: {
        category: table.category,
        name: table.name,
        jurisdiction: table.jurisdiction,
        keyColumn: table.keyColumn,
        valueColumn: table.valueColumn,
        sourceUrl: table.sourceUrl,
        evidenceId: evidence.id,
      },
    })

    // Create entries
    for (const entry of table.entries) {
      await db.referenceEntry.create({
        data: {
          tableId: dbTable.id,
          key: entry.key,
          value: entry.value,
          metadata: entry.metadata ?? undefined,
        },
      })
    }

    tableIds.push(dbTable.id)
  }

  console.log(`[reference-extractor] Extracted ${tableIds.length} tables from ${evidence.url}`)

  return {
    success: true,
    tables: result.output.tables,
    tableIds,
    error: null,
  }
}
