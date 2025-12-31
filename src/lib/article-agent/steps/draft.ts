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

  // 4. Add sources section
  const contentWithSources = addSourcesSection(content, factSheet.claims)

  // 5. Parse into paragraphs
  const paragraphs = parseIntoParagraphs(contentWithSources)

  // 6. Create draft record
  const draft = await db.articleDraft.create({
    data: {
      jobId: job.id,
      iteration: job.currentIteration,
      contentMdx: contentWithSources,
    },
  })

  // 7. Create paragraph records
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
  const entities = factSheet.keyEntities as unknown as KeyEntities

  // Build sources map
  const sourcesMap = new Map<string, number>()
  const sourcesList: string[] = []

  claims.forEach((c) => {
    if (c.sourceUrl && !sourcesMap.has(c.sourceUrl)) {
      sourcesMap.set(c.sourceUrl, sourcesList.length + 1)
      sourcesList.push(c.sourceUrl)
    }
  })

  const claimsText = claims
    .map((c) => {
      const sourceNum = c.sourceUrl ? sourcesMap.get(c.sourceUrl) : null
      const sourceTag = sourceNum ? ` [^${sourceNum}]` : ""
      return `- [${c.category}] ${c.statement}${c.quote ? ` ("${c.quote}")` : ""}${sourceTag}`
    })
    .join("\n")

  const sourcesText = sourcesList.map((url, idx) => `[^${idx + 1}]: ${url}`).join("\n")

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
    .replace("{sources}", sourcesText || "Nema izvora")
}

function addSourcesSection(content: string, claims: Claim[]): string {
  // Extract unique sources from claims
  const sourcesMap = new Map<string, number>()
  const sourcesList: { url: string; title?: string }[] = []

  claims.forEach((c) => {
    if (c.sourceUrl && !sourcesMap.has(c.sourceUrl)) {
      sourcesMap.set(c.sourceUrl, sourcesList.length + 1)
      // Try to extract a title from the URL or use a generic label
      const urlObj = new URL(c.sourceUrl)
      const title = urlObj.hostname.replace(/^www\./, "")
      sourcesList.push({ url: c.sourceUrl, title })
    }
  })

  // If no sources, return content as-is
  if (sourcesList.length === 0) {
    return content
  }

  // Build sources section
  const sourcesSection = [
    "",
    "## Izvori",
    "",
    ...sourcesList.map((source, idx) => `[^${idx + 1}]: [${source.title}](${source.url})`),
  ].join("\n")

  return content + sourcesSection
}

function parseIntoParagraphs(content: string): string[] {
  // Split by double newlines, filter empty, trim
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}
