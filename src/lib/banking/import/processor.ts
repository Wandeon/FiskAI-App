import { promises as fs } from "fs"
import path from "path"
import { Prisma, JobStatus, TierType, PageStatus, MatchStatus, ImportFormat } from "@prisma/client"
import { db } from "@/lib/db"
import { auditPageMath, ExtractedPageData } from "./audit"
import { BANK_STATEMENT_SYSTEM_PROMPT } from "./prompt"
import { chat as ollamaChat } from "@/lib/ai/ollama-client"
import { XMLParser } from "fast-xml-parser"
import Decimal from "decimal.js"

type ParsedPage = {
  pageNumber: number
  pageStartBalance: number | null
  pageEndBalance: number | null
  transactions: Array<{
    date: string
    payee: string | null
    description: string | null
    amount: number
    direction: "INCOMING" | "OUTGOING"
    reference: string | null
    counterpartyIban: string | null
  }>
  metadata?: {
    sequenceNumber?: number | null
    statementDate?: string | null
  }
}

/** CAMT XML amount field - can be number, string, or object with currency attribute */
type CamtAmountValue =
  | number
  | string
  | { "@_Ccy"?: string; "#text"?: string; _text?: string; $t?: string }

/** CAMT XML balance entry structure */
interface CamtBalance {
  Tp?: {
    CdOrPrtry?: {
      Cd?: string
      Prtry?: string
    }
  }
  Amt?: CamtAmountValue
}

/** CAMT XML entry (transaction) structure */
interface CamtEntry {
  Amt?: CamtAmountValue
  CdtDbtInd?: string
  BookgDt?: { Dt?: string }
  ValDt?: { Dt?: string }
  NtryRef?: string
  AddtlNtryInf?: string
  NtryDtls?: {
    TxDtls?: CamtTransactionDetails | CamtTransactionDetails[]
  }
}

/** CAMT XML transaction details */
interface CamtTransactionDetails {
  Refs?: {
    EndToEndId?: string
    TxId?: string
    InstrId?: string
  }
  RltdPties?: {
    Cdtr?: { Nm?: string }
    Dbtr?: { Nm?: string }
    UltmtCdtr?: { Nm?: string }
    UltmtDbtr?: { Nm?: string }
    CdtrAcct?: { Id?: { IBAN?: string } }
    DbtrAcct?: { Id?: { IBAN?: string } }
  }
  RmtInf?: { Ustrd?: string }
}

/** Raw transaction from AI model response */
interface RawParsedTransaction {
  date?: string
  payee?: string | null
  description?: string | null
  amount?: number | string
  direction?: string
  reference?: string | null
  counterpartyIban?: string | null
}

/** Raw page response from AI model */
interface RawParsedPageResponse {
  pageStartBalance?: number | string | null
  pageEndBalance?: number | string | null
  transactions?: RawParsedTransaction[]
  metadata?: {
    sequenceNumber?: number | null
    statementDate?: string | null
  }
}

/** PDF page data from pdf-parse library */
interface PdfPageData {
  getTextContent(): Promise<{ items: Array<{ str: string }> }>
}

function parseCroatianNumber(raw: string): number {
  if (raw === null || raw === undefined) return NaN
  const str = String(raw).trim()
  if (!str) return NaN
  const cleaned = str.replace(/\./g, "").replace(/,/g, ".")
  if (cleaned.endsWith("-")) {
    return parseFloat(cleaned.slice(0, -1)) * -1
  }
  return parseFloat(cleaned)
}

function extractAmountValue(amt: CamtAmountValue | null | undefined): number {
  if (amt === null || amt === undefined) return 0
  if (typeof amt === "number") return amt
  if (typeof amt === "string") return parseFloat(amt) || 0
  // Handle XML parsed object like { "@_Ccy": "EUR", "#text": "10000.00" }
  if (typeof amt === "object") {
    const textValue = amt["#text"] ?? amt["_text"] ?? amt["$t"]
    if (textValue !== undefined) return parseFloat(String(textValue)) || 0
  }
  return 0
}

function extractBalanceHints(text: string): number[] {
  const patterns = [
    /Preneseno\s*[:.-]?\s*([\d.,-]+)/i,
    /Po[čc]etno stanje\s*[:.-]?\s*([\d.,-]+)/i,
    /Novo stanje\s*[:.-]?\s*([\d.,-]+)/i,
    /Raspolo[žz]ivo\s*[:.-]?\s*([\d.,-]+)/i,
    /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
  ]
  const results: number[] = []
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m?.[1]) {
      const num = parseCroatianNumber(m[1])
      if (Number.isFinite(num)) results.push(num)
    }
  }
  return results
}

export async function processNextImportJob() {
  const job = await db.importJob.findFirst({
    where: { status: JobStatus.PENDING },
  })
  if (!job) {
    return { status: "idle", message: "No pending jobs" }
  }

  await db.importJob.update({
    where: { id: job.id },
    data: { status: JobStatus.PROCESSING },
  })

  try {
    const extension = job.originalName.split(".").pop()?.toLowerCase() || ""
    if (extension === "xml") {
      await handleXml(job.id)
    } else {
      await handlePdf(job.id)
    }
    return { status: "ok", jobId: job.id }
  } catch (error) {
    console.error("[processNextImportJob] error", error)
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Unknown error",
      },
    })
    return {
      status: "error",
      jobId: job.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function handleXml(jobId: string) {
  const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } })
  if (!job.bankAccountId) {
    throw new Error("Bank account ID is required for XML import")
  }
  const existingImport = await db.statementImport.findFirst({
    where: { importJobId: jobId },
  })
  if (existingImport) {
    await db.importJob.update({
      where: { id: jobId },
      data: { status: JobStatus.VERIFIED },
    })
    return
  }
  const bankAccountId = job.bankAccountId
  const xmlBuffer = await fs.readFile(job.storagePath as string, "utf-8")
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: true,
  })
  const parsed = parser.parse(xmlBuffer)

  const stmt =
    parsed?.Document?.BkToCstmrStmt?.Stmt?.[0] ||
    parsed?.Document?.BkToCstmrStmt?.Stmt ||
    parsed?.Document?.BkToCstmrAcctRpt?.Rpt?.[0] ||
    parsed?.Document?.BkToCstmrAcctRpt?.Rpt

  if (!stmt) {
    throw new Error("CAMT XML does not contain a statement")
  }

  const sequenceNumber = Number(stmt?.Id) || Number(stmt?.LglSeqNb) || 0
  const statementDateStr = stmt?.CreDtTm || stmt?.FrToDt?.ToDt
  const statementDate = statementDateStr ? new Date(statementDateStr) : new Date()
  const periodStart = stmt?.FrToDt?.FrDt ? new Date(stmt.FrToDt.FrDt) : statementDate
  const periodEnd = stmt?.FrToDt?.ToDt ? new Date(stmt.FrToDt.ToDt) : statementDate

  const balances: CamtBalance[] = Array.isArray(stmt.Bal) ? stmt.Bal : stmt.Bal ? [stmt.Bal] : []
  const openingBalRaw =
    balances.find((b) => b?.Tp?.CdOrPrtry?.Cd === "OPBD")?.Amt ??
    balances.find((b) => b?.Tp?.CdOrPrtry?.Prtry === "OPBD")?.Amt ??
    balances[0]?.Amt ??
    0
  const closingBalRaw =
    balances.find((b) => b?.Tp?.CdOrPrtry?.Cd === "CLBD")?.Amt ??
    balances.find((b) => b?.Tp?.CdOrPrtry?.Prtry === "CLBD")?.Amt ??
    balances[balances.length - 1]?.Amt ??
    openingBalRaw
  const openingBal = extractAmountValue(openingBalRaw)
  const closingBal = extractAmountValue(closingBalRaw)
  const firstAmt = balances[0]?.Amt
  const currency =
    (typeof firstAmt === "object" && firstAmt !== null ? firstAmt["@_Ccy"] : undefined) || "EUR"

  const entries: CamtEntry[] = Array.isArray(stmt.Ntry) ? stmt.Ntry : stmt.Ntry ? [stmt.Ntry] : []

  const statementImport = await db.statementImport.create({
    data: {
      companyId: job.companyId,
      bankAccountId,
      importJobId: jobId,
      fileName: job.originalName,
      fileChecksum: job.fileChecksum,
      format: ImportFormat.XML_CAMT053,
      transactionCount: entries.length,
      importedBy: job.userId,
      metadata: {
        sequenceNumber,
        statementDate: statementDate.toISOString(),
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    },
  })

  const statement = await db.statement.create({
    data: {
      importJobId: jobId,
      companyId: job.companyId,
      bankAccountId,
      statementDate,
      periodStart,
      periodEnd,
      sequenceNumber,
      openingBalance: new Prisma.Decimal(openingBal),
      closingBalance: new Prisma.Decimal(closingBal),
      currency,
    },
  })

  const page = await db.statementPage.create({
    data: {
      statementId: statement.id,
      companyId: job.companyId,
      pageNumber: 1,
      pageStartBalance: openingBal,
      pageEndBalance: closingBal,
      status: PageStatus.VERIFIED,
      rawText: xmlBuffer,
    },
  })

  if (entries.length) {
    await db.bankTransaction.createMany({
      data: entries.map((entry) => {
        const amount = extractAmountValue(entry?.Amt)
        const cdtDbt = entry?.CdtDbtInd === "CRDT" ? "INCOMING" : "OUTGOING"
        const dateStr = entry?.BookgDt?.Dt || entry?.ValDt?.Dt || statementDate
        const related = entry?.NtryDtls?.TxDtls || []
        const details: CamtTransactionDetails | undefined = Array.isArray(related)
          ? related[0]
          : related
        const ref =
          entry?.NtryRef ||
          details?.Refs?.EndToEndId ||
          details?.Refs?.TxId ||
          details?.Refs?.InstrId ||
          null
        const counterparty =
          details?.RltdPties?.Cdtr?.Nm ||
          details?.RltdPties?.Dbtr?.Nm ||
          details?.RltdPties?.UltmtCdtr?.Nm ||
          details?.RltdPties?.UltmtDbtr?.Nm ||
          null
        const iban =
          details?.RltdPties?.CdtrAcct?.Id?.IBAN || details?.RltdPties?.DbtrAcct?.Id?.IBAN || null
        const description = entry?.AddtlNtryInf || details?.RmtInf?.Ustrd || ""

        return {
          companyId: job.companyId,
          bankAccountId: bankAccountId,
          statementImportId: statementImport.id,
          date: new Date(dateStr),
          description: typeof description === "string" ? description : JSON.stringify(description),
          amount: new Prisma.Decimal(Math.abs(amount)),
          balance: new Prisma.Decimal(0), // Will be calculated later
          reference: ref,
          counterpartyName: counterparty,
          counterpartyIban: iban,
          matchStatus: MatchStatus.UNMATCHED,
          confidenceScore: 0,
        }
      }),
    })
  }

  await db.importJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.VERIFIED,
      tierUsed: TierType.XML,
      pagesProcessed: 1,
      pagesFailed: 0,
    },
  })
}

async function handlePdf(jobId: string) {
  const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } })
  if (!job.bankAccountId) {
    throw new Error("Bank account ID is required for PDF import")
  }
  const existingImport = await db.statementImport.findFirst({
    where: { importJobId: jobId },
  })
  if (existingImport) {
    await db.importJob.update({
      where: { id: jobId },
      data: { status: JobStatus.VERIFIED },
    })
    return
  }
  const bankAccountId = job.bankAccountId
  const buffer = await fs.readFile(job.storagePath as string)
  const pdfBase64 = buffer.toString("base64")

  const pagesText = await extractPdfTextPerPage(buffer)
  if (!pagesText.length) {
    throw new Error("PDF text extraction returned no pages")
  }

  const parsedPages: ParsedPage[] = []
  for (let i = 0; i < pagesText.length; i++) {
    const pageText = pagesText[i]
    const parsed = await callWorkhorseModel(pageText)
    parsedPages.push({ ...parsed, pageNumber: i + 1 })
  }

  const statementMeta = deriveStatementMeta(parsedPages)

  let pagesVerified = 0
  let pagesFailed = 0
  let visionTriggered = false

  const processedPages: Array<{
    pageNumber: number
    pageStartBalance: number | null
    pageEndBalance: number | null
    status: PageStatus
    rawText: string
    transactions: ParsedPage["transactions"]
  }> = []

  const statement = await db.statement.create({
    data: {
      importJobId: jobId,
      companyId: job.companyId,
      bankAccountId,
      statementDate: statementMeta.statementDate,
      periodStart: statementMeta.periodStart,
      periodEnd: statementMeta.periodEnd,
      sequenceNumber: statementMeta.sequenceNumber,
      openingBalance: statementMeta.openingBalance,
      closingBalance: statementMeta.closingBalance,
      currency: "EUR",
    },
  })

  for (const page of parsedPages) {
    const auditInput: ExtractedPageData = {
      pageNumber: page.pageNumber,
      pageStartBalance: page.pageStartBalance,
      pageEndBalance: page.pageEndBalance,
      transactions: page.transactions.map((t) => ({
        amount: t.amount,
        direction: t.direction,
      })),
    }
    const auditResult = auditPageMath(auditInput)
    let pageStatus = auditResult.isVerified ? PageStatus.VERIFIED : PageStatus.NEEDS_VISION
    let repairedTransactions = page.transactions

    if (!auditResult.isVerified) {
      const repaired = await tryRepairPageWithVision({
        pageText: pagesText[page.pageNumber - 1],
        previousJson: page,
        pdfBase64,
        pageNumber: page.pageNumber,
      })
      if (repaired) {
        repairedTransactions = repaired.transactions
        const reAudit = auditPageMath({
          pageNumber: page.pageNumber,
          pageStartBalance: repaired.pageStartBalance ?? page.pageStartBalance,
          pageEndBalance: repaired.pageEndBalance ?? page.pageEndBalance,
          transactions: repaired.transactions.map((t) => ({
            amount: t.amount,
            direction: t.direction,
          })),
        })
        if (reAudit.isVerified) {
          pageStatus = PageStatus.VERIFIED
          visionTriggered = true
        }
        page.pageStartBalance = repaired.pageStartBalance ?? page.pageStartBalance
        page.pageEndBalance = repaired.pageEndBalance ?? page.pageEndBalance
        repairedTransactions = repaired.transactions
      }
    }

    if (pageStatus === PageStatus.VERIFIED) {
      pagesVerified += 1
    } else {
      pagesFailed += 1
    }

    processedPages.push({
      pageNumber: page.pageNumber,
      pageStartBalance: page.pageStartBalance,
      pageEndBalance: page.pageEndBalance,
      status: pageStatus,
      rawText: pagesText[page.pageNumber - 1],
      transactions: repairedTransactions,
    })
  }

  const totalTransactionCount = processedPages.reduce(
    (count, page) => count + page.transactions.length,
    0
  )

  const statementImport = await db.statementImport.create({
    data: {
      companyId: job.companyId,
      bankAccountId,
      importJobId: jobId,
      fileName: job.originalName,
      fileChecksum: job.fileChecksum,
      format: ImportFormat.PDF,
      transactionCount: totalTransactionCount,
      importedBy: job.userId,
      metadata: {
        statementDate: statementMeta.statementDate.toISOString(),
        periodStart: statementMeta.periodStart.toISOString(),
        periodEnd: statementMeta.periodEnd.toISOString(),
        pagesVerified,
        pagesFailed,
        visionTriggered,
      },
    },
  })

  for (const page of processedPages) {
    await db.statementPage.create({
      data: {
        statementId: statement.id,
        companyId: job.companyId,
        pageNumber: page.pageNumber,
        pageStartBalance: page.pageStartBalance,
        pageEndBalance: page.pageEndBalance,
        status: page.status,
        rawText: page.rawText,
      },
    })

    const txnsToStore = page.transactions
    if (txnsToStore.length) {
      await db.bankTransaction.createMany({
        data: txnsToStore.map((t) => ({
          companyId: job.companyId,
          bankAccountId,
          statementImportId: statementImport.id,
          date: new Date(t.date),
          description: t.description || "",
          amount: new Prisma.Decimal(t.amount),
          balance: new Prisma.Decimal(0), // Will be calculated later
          reference: t.reference ?? undefined,
          counterpartyName: t.payee ?? undefined,
          counterpartyIban: t.counterpartyIban ?? undefined,
          matchStatus: "UNMATCHED" as const,
          confidenceScore: 0,
        })),
      })
    }
  }

  await db.importJob.update({
    where: { id: jobId },
    data: {
      status: pagesFailed > 0 ? JobStatus.NEEDS_REVIEW : JobStatus.VERIFIED,
      pagesProcessed: parsedPages.length,
      pagesFailed,
      tierUsed: visionTriggered ? TierType.VISION_LLM : TierType.TEXT_LLM,
    },
  })
}

async function callWorkhorseModel(pageText: string): Promise<Omit<ParsedPage, "pageNumber">> {
  const content = await ollamaChat(pageText, {
    systemPrompt: BANK_STATEMENT_SYSTEM_PROMPT,
    jsonMode: true,
  })

  const parsed = JSON.parse(content) as RawParsedPageResponse

  const transactions = Array.isArray(parsed.transactions)
    ? parsed.transactions.map((t) => ({
        date: t.date ?? "",
        payee: t.payee ?? null,
        description: t.description ?? null,
        amount: Number(t.amount),
        direction: (t.direction === "INCOMING" ? "INCOMING" : "OUTGOING") as
          | "INCOMING"
          | "OUTGOING",
        reference: t.reference ?? null,
        counterpartyIban: t.counterpartyIban ?? null,
      }))
    : []

  return {
    pageStartBalance: parsed.pageStartBalance !== null ? Number(parsed.pageStartBalance) : null,
    pageEndBalance: parsed.pageEndBalance !== null ? Number(parsed.pageEndBalance) : null,
    transactions,
    metadata: parsed.metadata,
  }
}

async function extractPdfTextPerPage(buffer: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf-parse is dynamically imported and lacks TypeScript definitions
  let pdfParse: (
    buffer: Buffer,
    options?: { pagerender?: (pageData: PdfPageData) => Promise<string> }
  ) => Promise<unknown>
  try {
    pdfParse = (await import("pdf-parse")).default
  } catch (error) {
    throw new Error("Missing dependency pdf-parse. Install with `npm install pdf-parse`.")
  }

  try {
    const pages: string[] = []
    await pdfParse(buffer, {
      pagerender: async (pageData: PdfPageData) => {
        const textContent = await pageData.getTextContent()
        const strings = textContent.items.map((item) => item.str)
        const combined = strings.join(" ").trim()
        pages.push(combined)
        return combined
      },
    })
    return pages
  } catch (pdfError: unknown) {
    const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError)
    console.warn("[extractPdfTextPerPage] pdf-parse failed:", errorMessage)
    // Fallback: try to extract text with a simpler approach
    try {
      // Simple fallback for testing - extract any text from buffer
      const bufferStr = buffer.toString("utf8", 0, Math.min(buffer.length, 10000))
      const textLines = bufferStr
        .split("\n")
        .filter(
          (line) =>
            line.trim() &&
            !line.startsWith("%") &&
            !line.includes("obj") &&
            !line.includes("endobj")
        )
      if (textLines.length > 0) {
        return [textLines.join(" ")]
      }
    } catch (fallbackError) {
      console.error("[extractPdfTextPerPage] fallback also failed:", fallbackError)
    }
    throw new Error(`PDF text extraction failed: ${errorMessage}`)
  }
}

async function tryRepairPageWithVision({
  pageText,
  previousJson,
  pdfBase64,
  pageNumber,
}: {
  pageText: string
  previousJson: ParsedPage
  pdfBase64: string
  pageNumber: number
}): Promise<Omit<ParsedPage, "pageNumber"> | null> {
  const ollamaKey = process.env.OLLAMA_API_KEY
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434"
  const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || "llava"
  const prompt = `You are a vision model fixing bank statement extraction. Focus on page ${pageNumber}. Use the image/PDF to correct multi-line transactions and balances. Return valid JSON only.`

  if (!ollamaKey) {
    console.warn("[vision] OLLAMA_API_KEY not configured for vision repair")
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)

  let content: string | null = null
  try {
    const resp = await fetch(`${ollamaEndpoint}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ollamaKey}`,
      },
      body: JSON.stringify({
        model: ollamaVisionModel,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: `RAW_PAGE_TEXT:\n${pageText}\n\nPREVIOUS_JSON:\n${JSON.stringify(previousJson)}`,
            images: [pdfBase64],
          },
        ],
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) {
      const txt = await resp.text()
      throw new Error(`Ollama HTTP ${resp.status}: ${txt}`)
    }
    const json = await resp.json()
    content = json?.message?.content
    if (!content) {
      console.warn("[vision] Ollama returned no content")
      return null
    }
  } catch (err) {
    clearTimeout(timeout)
    console.warn("[vision] Ollama call failed", err)
    return null
  }

  if (!content) return null

  const parsed = JSON.parse(content) as RawParsedPageResponse
  const transactions = Array.isArray(parsed.transactions)
    ? parsed.transactions.map((t) => ({
        date: t.date ?? "",
        payee: t.payee ?? null,
        description: t.description ?? null,
        amount: Number(t.amount),
        direction: (t.direction === "INCOMING" ? "INCOMING" : "OUTGOING") as
          | "INCOMING"
          | "OUTGOING",
        reference: t.reference ?? null,
        counterpartyIban: t.counterpartyIban ?? null,
      }))
    : []
  return {
    pageStartBalance:
      parsed.pageStartBalance !== null
        ? Number(parsed.pageStartBalance)
        : previousJson.pageStartBalance,
    pageEndBalance:
      parsed.pageEndBalance !== null ? Number(parsed.pageEndBalance) : previousJson.pageEndBalance,
    transactions,
    metadata: parsed.metadata,
  }
}

function deriveStatementMeta(pages: ParsedPage[]) {
  const allTransactions = pages.flatMap((p) => p.transactions)
  const dates = allTransactions
    .map((t) => new Date(t.date))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const periodStart = dates[0] ?? new Date()
  const periodEnd = dates[dates.length - 1] ?? new Date()

  const statementDateString =
    pages.find((p) => p.metadata?.statementDate)?.metadata?.statementDate ?? null
  const statementDate = statementDateString ? new Date(statementDateString) : periodEnd

  const sequenceNumber =
    pages.find((p) => typeof p.metadata?.sequenceNumber === "number")?.metadata?.sequenceNumber ?? 0

  const openingBalance =
    pages.find((p) => p.pageStartBalance !== null)?.pageStartBalance ??
    pages[0]?.pageStartBalance ??
    0
  const closingBalance =
    [...pages].reverse().find((p) => p.pageEndBalance !== null)?.pageEndBalance ??
    pages[pages.length - 1]?.pageEndBalance ??
    openingBalance

  return {
    periodStart,
    periodEnd,
    statementDate,
    sequenceNumber,
    openingBalance: new Prisma.Decimal(openingBalance),
    closingBalance: new Prisma.Decimal(closingBalance),
  }
}
