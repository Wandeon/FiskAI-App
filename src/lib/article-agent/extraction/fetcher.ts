// src/lib/article-agent/extraction/fetcher.ts

import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"

export interface FetchedContent {
  url: string
  title: string
  content: string
  fetchedAt: Date
  error?: string
}

export async function fetchUrl(url: string): Promise<FetchedContent> {
  const fetchedAt = new Date()

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FiskAI/1.0 (Article Agent)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      return {
        url,
        title: "",
        content: "",
        fetchedAt,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article) {
      return {
        url,
        title: dom.window.document.title || "",
        content: dom.window.document.body?.textContent || "",
        fetchedAt,
      }
    }

    return {
      url,
      title: article.title || "",
      content: article.textContent || "",
      fetchedAt,
    }
  } catch (error) {
    return {
      url,
      title: "",
      content: "",
      fetchedAt,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    }
  }
}

export async function fetchUrls(urls: string[]): Promise<FetchedContent[]> {
  const results = await Promise.all(urls.map((url) => fetchUrl(url)))
  return results
}
