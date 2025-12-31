// src/lib/article-agent/steps/publish.ts

import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts } from "@/lib/db/schema"
import type { ArticleJob, ArticleDraft } from "@prisma/client"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const CONTENT_DIRECTORIES: Record<string, string> = {
  NEWS: "",
  GUIDE: "content/vodici",
  HOWTO: "content/kako-da",
  GLOSSARY: "content/rjecnik",
  COMPARISON: "content/usporedbe",
}

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const timestamp = Date.now().toString().slice(-6)
  return base.substring(0, 60) + "-" + timestamp
}

function generateExcerpt(content: string, maxLength = 200): string {
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n*/, "")
  const plainText = withoutFrontmatter
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, "")
    .replace(/\`(.+?)\`/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
  const firstSentence = plainText.match(/^[^.!?]+[.!?]/)?.[0] || plainText
  if (firstSentence.length <= maxLength) return firstSentence
  return firstSentence.substring(0, maxLength).trim() + "..."
}

function extractTitle(content: string): string {
  const frontmatterMatch = content.match(/^---[\s\S]*?title:\s*(.+?)\n[\s\S]*?---/)
  if (frontmatterMatch?.[1]) {
    return frontmatterMatch[1].trim().replace(/^["']|["']$/g, "")
  }
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match?.[1]) return h1Match[1].trim()
  return "Untitled Article"
}

async function publishNewsArticle(
  job: ArticleJob,
  draft: ArticleDraft
): Promise<{ slug: string; postId: string }> {
  const title = job.topic || extractTitle(draft.contentMdx)
  const slug = generateSlug(title)
  const excerpt = generateExcerpt(draft.contentMdx)

  const [post] = await drizzleDb
    .insert(newsPosts)
    .values({
      slug,
      type: "individual",
      title,
      content: draft.contentMdx,
      excerpt,
      impactLevel: "high",
      status: "published",
      publishedAt: new Date(),
      aiPasses: {
        articleAgent: {
          jobId: job.id,
          iteration: draft.iteration,
          sourceUrls: job.sourceUrls,
          publishedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  return { slug: post.slug, postId: post.id }
}

async function publishMdxArticle(
  job: ArticleJob,
  draft: ArticleDraft,
  contentDir: string
): Promise<{ slug: string; filePath: string }> {
  const title = job.topic || extractTitle(draft.contentMdx)
  const slug = generateSlug(title)
  const fileName = slug + ".mdx"

  const dirPath = path.join(process.cwd(), contentDir)
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }

  let content = draft.contentMdx
  if (!content.startsWith("---")) {
    const frontmatter =
      '---\ntitle: "' +
      title +
      '"\ndescription: "' +
      generateExcerpt(content) +
      '"\nlastUpdated: ' +
      new Date().toISOString().split("T")[0] +
      "\nsources:\n" +
      job.sourceUrls.map((url) => "  - name: Source\n    url: " + url).join("\n") +
      "\n---\n\n"
    content = frontmatter + content
  }

  const filePath = path.join(dirPath, fileName)
  await writeFile(filePath, content, "utf-8")

  return { slug, filePath }
}

export async function publishArticle(job: ArticleJob): Promise<{
  success: boolean
  slug: string
  publishedAt: Date
  destination: string
}> {
  const latestDraft = await db.articleDraft.findFirst({
    where: { jobId: job.id },
    orderBy: { iteration: "desc" },
  })

  if (!latestDraft) {
    throw new Error("No draft found for article job")
  }

  const now = new Date()
  let slug: string
  let destination: string

  if (job.type === "NEWS") {
    const result = await publishNewsArticle(job, latestDraft)
    slug = result.slug
    destination = "news_posts:" + result.postId
  } else {
    const contentDir = CONTENT_DIRECTORIES[job.type]
    if (!contentDir) {
      throw new Error("Unknown article type: " + job.type)
    }
    const result = await publishMdxArticle(job, latestDraft, contentDir)
    slug = result.slug
    destination = result.filePath
  }

  await db.articleJob.update({
    where: { id: job.id },
    data: {
      status: "PUBLISHED",
      finalSlug: slug,
      finalContentMdx: latestDraft.contentMdx,
      publishedAt: now,
      updatedAt: now,
    },
  })

  return {
    success: true,
    slug,
    publishedAt: now,
    destination,
  }
}
