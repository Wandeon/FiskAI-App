// src/lib/regulatory-truth/utils/tesseract.ts
// Wrapper for Tesseract OCR CLI with TSV output parsing for confidence data

import { exec } from "child_process"
import { promisify } from "util"
import { writeFile, readFile, rm } from "fs/promises"
import { randomUUID } from "crypto"
import path from "path"

const execAsync = promisify(exec)

export interface TesseractResult {
  text: string
  confidence: number
  wordCount: number
}

/**
 * Run Tesseract OCR on an image buffer.
 * Returns extracted text and average confidence score.
 */
export async function runTesseract(
  imageBuffer: Buffer,
  lang: string = "hrv+eng"
): Promise<TesseractResult> {
  const id = randomUUID()
  const tempIn = path.join("/tmp", `ocr-in-${id}.png`)
  const tempOutBase = path.join("/tmp", `ocr-out-${id}`)
  const tempOutTsv = `${tempOutBase}.tsv`

  try {
    await writeFile(tempIn, imageBuffer)

    // Run Tesseract with TSV output for confidence data
    await execAsync(
      `tesseract "${tempIn}" "${tempOutBase}" -l ${lang} --psm 1 --oem 1 tsv 2>/dev/null`
    )

    const tsvContent = await readFile(tempOutTsv, "utf-8")
    const result = parseTesseractTsv(tsvContent)

    return result
  } catch (error) {
    console.error("[tesseract] OCR failed:", error)
    return { text: "", confidence: 0, wordCount: 0 }
  } finally {
    await rm(tempIn, { force: true }).catch(() => {})
    await rm(tempOutTsv, { force: true }).catch(() => {})
    await rm(`${tempOutBase}.txt`, { force: true }).catch(() => {})
  }
}

function parseTesseractTsv(tsv: string): TesseractResult {
  const lines = tsv.trim().split("\n").slice(1)
  const words: string[] = []
  let totalConf = 0
  let wordCount = 0

  for (const line of lines) {
    const cols = line.split("\t")
    if (cols.length < 12) continue

    const conf = parseInt(cols[10] || "-1")
    const text = cols[11] || ""

    if (text.trim() && conf > 0) {
      words.push(text)
      totalConf += conf
      wordCount++
    }
  }

  const fullText = reconstructText(lines)

  return {
    text: fullText,
    confidence: wordCount > 0 ? totalConf / wordCount : 0,
    wordCount,
  }
}

function reconstructText(lines: string[]): string {
  const result: string[] = []
  let currentLine = ""
  let lastLineNum = -1

  for (const line of lines) {
    const cols = line.split("\t")
    if (cols.length < 12) continue

    const lineNum = parseInt(cols[4] || "0")
    const text = cols[11] || ""
    const conf = parseInt(cols[10] || "-1")

    if (!text.trim() || conf < 0) continue

    if (lineNum !== lastLineNum && lastLineNum !== -1) {
      if (currentLine.trim()) {
        result.push(currentLine.trim())
      }
      currentLine = text
    } else {
      currentLine += (currentLine ? " " : "") + text
    }
    lastLineNum = lineNum
  }

  if (currentLine.trim()) {
    result.push(currentLine.trim())
  }

  return result.join("\n")
}

export async function isTesseractAvailable(): Promise<boolean> {
  try {
    await execAsync("tesseract --version")
    return true
  } catch {
    return false
  }
}

export async function getTesseractLanguages(): Promise<string[]> {
  try {
    const { stdout } = await execAsync("tesseract --list-langs 2>/dev/null")
    return stdout
      .split("\n")
      .slice(1)
      .filter((l) => l.trim())
  } catch {
    return []
  }
}
