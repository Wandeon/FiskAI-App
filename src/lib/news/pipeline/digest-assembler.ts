/**
 * AI Pipeline - Digest Assembly
 * Groups medium-impact items into cohesive daily digest
 */

import { callOllama } from "./ollama-client"

export interface DigestSection {
  theme: string // e.g., "PDV novosti", "Propisi i zakoni"
  items: Array<{
    title: string
    summary: string // 2-3 sentences
    sourceUrl: string
    sourceId: string
  }>
}

export interface DigestContent {
  title: string
  intro: string // Editorial paragraph
  sections: DigestSection[]
  content: string // Full markdown content
}

const NEWS_DIGEST_SYSTEM_PROMPT =
  "Ti si urednik FiskAI portala. Pišeš kratko, jasno i bez floskula. Ne izmišljaš činjenice."

const DIGEST_INTRO_PROMPT = `Napiši uvodni paragraf za današnji dnevni pregled vijesti FiskAI portala.

VIJESTI ZA DANAS:
{news_list}

PRAVILA:
- 2-3 rečenice koje povezuju današnje vijesti
- Profesionalan ton
- Bez generičkih fraza
- Fokus na ključne teme dana

Vrati samo uvodni paragraf, bez dodatnih sekcija ili naslova.`

const DIGEST_GROUPING_PROMPT = `Grupiraj ove vijesti po temama za dnevni pregled.

VIJESTI:
{news_list}

Vrati JSON sa grupama:
{
  "sections": [
    {
      "theme": "Naziv teme (npr. 'PDV novosti', 'Propisi i zakoni')",
      "item_indices": [0, 2, 5]
    }
  ]
}

Maksimalno 4 grupe. Logično grupiraj srodne vijesti.`

/**
 * Assemble digest from medium-impact items
 */
export async function assembleDigest(
  items: Array<{
    id: string
    title: string
    summary: string
    sourceUrl: string
    category?: string
  }>
): Promise<DigestContent> {
  if (items.length === 0) {
    throw new Error("Cannot assemble digest from empty items list")
  }

  try {
    // Step 1: Group items by theme
    const sections = await groupItemsByTheme(items)

    // Step 2: Generate editorial intro
    const intro = await generateDigestIntro(items, sections)

    // Step 3: Assemble full markdown content
    const content = assembleMarkdown(intro, sections)

    // Step 4: Generate digest title
    const date = new Date().toLocaleDateString("hr-HR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const title = `Dnevni pregled - ${date}`

    return {
      title,
      intro,
      sections,
      content,
    }
  } catch (error) {
    console.error("Digest assembly failed:", error)
    throw new Error(`Failed to assemble digest: ${(error as Error).message}`)
  }
}

/**
 * Group items by theme using AI
 */
async function groupItemsByTheme(
  items: Array<{
    id: string
    title: string
    summary: string
    sourceUrl: string
    category?: string
  }>
): Promise<DigestSection[]> {
  const newsList = items
    .map((item, idx) => `${idx}. ${item.title}\n   ${item.summary}`)
    .join("\n\n")

  const prompt = DIGEST_GROUPING_PROMPT.replace("{news_list}", newsList)

  const response = await callOllama(prompt, {
    systemPrompt: NEWS_DIGEST_SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 1000,
    jsonMode: true,
  })

  interface GroupingResponse {
    sections: Array<{
      theme: string
      item_indices: number[]
    }>
  }

  const grouping: GroupingResponse = JSON.parse(response)

  // Build sections from grouping
  const sections: DigestSection[] = []

  for (const group of grouping.sections) {
    const sectionItems = group.item_indices
      .filter((idx) => idx >= 0 && idx < items.length)
      .map((idx) => {
        const item = items[idx]
        return {
          title: item.title,
          summary: item.summary,
          sourceUrl: item.sourceUrl,
          sourceId: item.id,
        }
      })

    if (sectionItems.length > 0) {
      sections.push({
        theme: group.theme,
        items: sectionItems,
      })
    }
  }

  // If no sections created, create one default section
  if (sections.length === 0) {
    sections.push({
      theme: "Današnje vijesti",
      items: items.map((item) => ({
        title: item.title,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        sourceId: item.id,
      })),
    })
  }

  return sections
}

/**
 * Generate editorial intro paragraph
 */
async function generateDigestIntro(
  items: Array<{ title: string; summary: string }>,
  sections: DigestSection[]
): Promise<string> {
  const newsList = items
    .slice(0, 10) // Limit to first 10 for brevity
    .map((item, idx) => `${idx + 1}. ${item.title}`)
    .join("\n")

  const prompt = DIGEST_INTRO_PROMPT.replace("{news_list}", newsList)

  const intro = await callOllama(prompt, {
    systemPrompt: NEWS_DIGEST_SYSTEM_PROMPT,
    temperature: 0.4,
    maxTokens: 300,
  })

  return intro.trim()
}

/**
 * Assemble full markdown content from intro and sections
 */
function assembleMarkdown(intro: string, sections: DigestSection[]): string {
  let markdown = `${intro}\n\n`

  for (const section of sections) {
    markdown += `## ${section.theme}\n\n`

    for (const item of section.items) {
      markdown += `### ${item.title}\n\n`
      markdown += `${item.summary}\n\n`
      markdown += `[Pročitaj više →](${item.sourceUrl})\n\n`
      markdown += "---\n\n"
    }
  }

  return markdown
}

/**
 * Create simple digest without AI grouping (fallback)
 */
export function assembleSimpleDigest(
  items: Array<{
    id: string
    title: string
    summary: string
    sourceUrl: string
    category?: string
  }>
): DigestContent {
  const date = new Date().toLocaleDateString("hr-HR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const title = `Dnevni pregled - ${date}`
  const intro = `Pregled najvažnijih vijesti za poduzetnike i računovođe od ${date}.`

  // Group by category if available, otherwise one section
  const sectionMap = new Map<string, DigestSection>()

  for (const item of items) {
    const theme = item.category || "Ostale vijesti"

    if (!sectionMap.has(theme)) {
      sectionMap.set(theme, {
        theme,
        items: [],
      })
    }

    sectionMap.get(theme)!.items.push({
      title: item.title,
      summary: item.summary,
      sourceUrl: item.sourceUrl,
      sourceId: item.id,
    })
  }

  const sections = Array.from(sectionMap.values())
  const content = assembleMarkdown(intro, sections)

  return {
    title,
    intro,
    sections,
    content,
  }
}
