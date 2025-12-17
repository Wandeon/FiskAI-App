// src/lib/article-agent/steps/draft.ts

import { db } from "@/lib/db"
import { callOllama } from "../llm/ollama-client"
import { DRAFTING_SYSTEM, DRAFTING_PROMPTS } from "../prompts/drafting"
import type { ArticleJob, FactSheet, Claim } from "@prisma/client"
import type { KeyEntities } from "../types"

export async function writeDraft(job: ArticleJob): Promise<string> {
  // 1. Load fact sheet with claims
  const factSheet = await db.factSheet.findUnique({
    where: { id: job.factSheetId! },
    include: { claims: true },
  })

  if (!factSheet) {
    throw new Error("FactSheet not found")
  }

  // 2. Build prompt with fact sheet data
  const prompt = buildDraftPrompt(job.type, factSheet, factSheet.claims)

  // 3. Generate article
  const content = await callOllama(prompt, {
    systemPrompt: DRAFTING_SYSTEM,
    temperature: 0.5,
    maxTokens: 4000,
  })

  // 4. Parse into paragraphs
  const paragraphs = parseIntoParagraphs(content)

  // 5. Create draft record
  const draft = await db.articleDraft.create({
    data: {
      jobId: job.id,
      iteration: job.currentIteration,
      contentMdx: content,
    },
  })

  // 6. Create paragraph records
  for (let i = 0; i < paragraphs.length; i++) {
    await db.draftParagraph.create({
      data: {
        draftId: draft.id,
        index: i,
        content: paragraphs[i],
        isLocked: false,
      },
    })
  }

  return draft.id
}

function buildDraftPrompt(type: ArticleJob["type"], factSheet: FactSheet, claims: Claim[]): string {
  const template = DRAFTING_PROMPTS[type]
  const entities = factSheet.keyEntities as KeyEntities

  const claimsText = claims
    .map((c) => `- [${c.category}] ${c.statement}${c.quote ? ` ("${c.quote}")` : ""}`)
    .join("\n")

  const entitiesText = [
    entities.names.length ? `Imena: ${entities.names.join(", ")}` : "",
    entities.dates.length ? `Datumi: ${entities.dates.join(", ")}` : "",
    entities.amounts.length ? `Iznosi: ${entities.amounts.join(", ")}` : "",
    entities.regulations.length ? `Propisi: ${entities.regulations.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  return template
    .replace("{topic}", factSheet.topic)
    .replace("{entities}", entitiesText || "Nema identificiranih entiteta")
    .replace("{claims}", claimsText || "Nema ekstrahiranih tvrdnji")
}

function parseIntoParagraphs(content: string): string[] {
  // Split by double newlines, filter empty, trim
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}
