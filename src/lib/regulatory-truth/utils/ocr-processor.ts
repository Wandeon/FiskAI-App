// src/lib/regulatory-truth/utils/ocr-processor.ts
// Main OCR pipeline: Tesseract primary, Vision fallback

import { renderPdfToImages } from "./pdf-renderer"
import { runTesseract } from "./tesseract"
import { runVisionOcr } from "./vision-ocr"

const TESSERACT_CONFIDENCE_THRESHOLD = 70
const GARBAGE_TEXT_THRESHOLD = 0.2
const MANUAL_REVIEW_THRESHOLD = 50

export interface PageResult {
  pageNum: number
  text: string
  confidence: number
  method: "tesseract" | "vision"
}

export interface OcrResult {
  text: string
  pages: PageResult[]
  avgConfidence: number
  method: "tesseract" | "vision" | "hybrid"
  processingMs: number
  failedPages: number[]
  needsManualReview: boolean
}

function isGarbageText(text: string): boolean {
  if (!text || text.length < 20) return true
  const letters = text.match(/[\p{L}]/gu) || []
  return letters.length / text.length < 1 - GARBAGE_TEXT_THRESHOLD
}

async function processPage(imageBuffer: Buffer, pageNum: number): Promise<PageResult> {
  console.log(`[ocr] Page ${pageNum}: Running Tesseract...`)
  const tesseractResult = await runTesseract(imageBuffer, "hrv+eng")

  const needsVision =
    tesseractResult.confidence < TESSERACT_CONFIDENCE_THRESHOLD ||
    isGarbageText(tesseractResult.text)

  if (!needsVision) {
    console.log(
      `[ocr] Page ${pageNum}: Tesseract OK (conf=${tesseractResult.confidence.toFixed(1)}%)`
    )
    return {
      pageNum,
      text: tesseractResult.text,
      confidence: tesseractResult.confidence,
      method: "tesseract",
    }
  }

  console.log(
    `[ocr] Page ${pageNum}: Tesseract low quality (conf=${tesseractResult.confidence.toFixed(1)}%), trying vision...`
  )

  try {
    const visionResult = await runVisionOcr(imageBuffer)

    if (visionResult.confidence > tesseractResult.confidence) {
      console.log(
        `[ocr] Page ${pageNum}: Vision better (conf=${visionResult.confidence.toFixed(1)}%)`
      )
      return {
        pageNum,
        text: visionResult.text,
        confidence: visionResult.confidence,
        method: "vision",
      }
    }
  } catch (error) {
    console.warn(`[ocr] Page ${pageNum}: Vision failed, using Tesseract anyway`)
  }

  return {
    pageNum,
    text: tesseractResult.text,
    confidence: tesseractResult.confidence,
    method: "tesseract",
  }
}

export async function processScannedPdf(pdfBuffer: Buffer): Promise<OcrResult> {
  const startMs = Date.now()

  console.log("[ocr] Rendering PDF to images...")
  const renderedPages = await renderPdfToImages(pdfBuffer, { dpi: 300 })
  console.log(`[ocr] Rendered ${renderedPages.length} pages`)

  const pages: PageResult[] = []
  for (const rendered of renderedPages) {
    const pageResult = await processPage(rendered.buffer, rendered.pageNum)
    pages.push(pageResult)
  }

  const combinedText = pages.map((p) => `[Stranica ${p.pageNum}]\n${p.text}`).join("\n\n")

  const avgConfidence =
    pages.length > 0 ? pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length : 0

  const visionUsed = pages.some((p) => p.method === "vision")
  const failedPages = pages
    .filter((p) => p.confidence < MANUAL_REVIEW_THRESHOLD)
    .map((p) => p.pageNum)

  const processingMs = Date.now() - startMs

  console.log(
    `[ocr] Complete: ${pages.length} pages, avg conf=${avgConfidence.toFixed(1)}%, ` +
      `method=${visionUsed ? "hybrid" : "tesseract"}, time=${processingMs}ms`
  )

  return {
    text: combinedText,
    pages,
    avgConfidence,
    method: visionUsed ? "hybrid" : "tesseract",
    processingMs,
    failedPages,
    needsManualReview: avgConfidence < MANUAL_REVIEW_THRESHOLD,
  }
}

export function isScannedPdf(extractedText: string, pageCount: number): boolean {
  const textLength = extractedText?.trim().length || 0
  const charsPerPage = textLength / Math.max(pageCount, 1)
  return charsPerPage < 50
}
