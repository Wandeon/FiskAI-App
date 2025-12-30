import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { JobStatus, DocumentType } from "@prisma/client"
import { promises as fs } from "fs"
import { XMLParser } from "fast-xml-parser"
import { deepseekJson } from "@/lib/ai/deepseek"
import { BANK_STATEMENT_SYSTEM_PROMPT, INVOICE_SYSTEM_PROMPT } from "@/lib/banking/import/prompt"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { downloadFromR2 } from "@/lib/r2-client"

export async function POST(request: Request) {
  // Add authentication and authorization
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Set tenant context for automatic tenant isolation
  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const body = await request.json().catch(() => ({}))
  const targetJobId = body.jobId

  // Get next pending job or specific job, restricted to user's company
  const job = targetJobId
    ? await db.importJob.findFirst({
        where: {
          id: targetJobId,
          companyId: company.id, // Tenant isolation
        },
      })
    : await db.importJob.findFirst({
        where: {
          status: JobStatus.PENDING,
          companyId: company.id, // Tenant isolation
        },
      })

  if (!job) {
    return NextResponse.json({ status: "idle", message: "No pending jobs" })
  }

  if (job.status !== "PENDING") {
    return NextResponse.json({ status: "skip", message: "Job already processed" })
  }

  // Mark as processing
  await db.importJob.update({
    where: { id: job.id },
    data: { status: JobStatus.PROCESSING },
  })

  try {
    const extension = job.originalName.split(".").pop()?.toLowerCase() || ""
    const documentType = job.documentType || DocumentType.BANK_STATEMENT
    let extractedData: any = null

    if (documentType === DocumentType.INVOICE) {
      // Process as invoice
      if (["pdf", "jpg", "jpeg", "png", "heic", "webp"].includes(extension)) {
        extractedData = await processInvoice(job, extension)
      } else {
        throw new Error("Invoice processing only supports PDF and images")
      }
    } else {
      // Process as bank statement
      if (extension === "xml") {
        extractedData = await processXml(job)
      } else if (extension === "csv") {
        extractedData = await processCsv(job)
      } else if (["pdf", "jpg", "jpeg", "png", "heic", "webp"].includes(extension)) {
        extractedData = await processPdfOrImage(job, extension)
      }
    }

    // Store extracted data and mark ready for review
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "READY_FOR_REVIEW" as any,
        extractedData,
        pagesProcessed: 1,
      },
    })

    return NextResponse.json({ status: "ok", jobId: job.id })
  } catch (error) {
    console.error("[process] error", error)
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Unknown error",
      },
    })
    return NextResponse.json({ status: "error", jobId: job.id })
  }
}

// Helper function to get file buffer from either R2 or local storage
async function getFileBuffer(job: any): Promise<Buffer> {
  if (job.storageKey) {
    // New R2 storage
    return await downloadFromR2(job.storageKey)
  } else if (job.storagePath) {
    // Legacy local storage
    return await fs.readFile(job.storagePath)
  } else {
    throw new Error("No storage location found for import job")
  }
}

async function processXml(job: any) {
  const buffer = await getFileBuffer(job)
  const xmlBuffer = buffer.toString("utf-8")
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true })
  const parsed = parser.parse(xmlBuffer)

  const stmt =
    parsed?.Document?.BkToCstmrStmt?.Stmt?.[0] ||
    parsed?.Document?.BkToCstmrStmt?.Stmt ||
    parsed?.Document?.BkToCstmrAcctRpt?.Rpt?.[0] ||
    parsed?.Document?.BkToCstmrAcctRpt?.Rpt

  if (!stmt) throw new Error("CAMT XML does not contain a statement")

  const balances = Array.isArray(stmt.Bal) ? stmt.Bal : stmt.Bal ? [stmt.Bal] : []
  const openingBal = extractAmount(balances.find((b: any) => b?.Tp?.CdOrPrtry?.Cd === "OPBD")?.Amt)
  const closingBal = extractAmount(balances.find((b: any) => b?.Tp?.CdOrPrtry?.Cd === "CLBD")?.Amt)

  const entries = Array.isArray(stmt.Ntry) ? stmt.Ntry : stmt.Ntry ? [stmt.Ntry] : []

  const transactions = entries.map((entry: any, idx: number) => {
    const amount = extractAmount(entry?.Amt)
    const direction = entry?.CdtDbtInd === "CRDT" ? "INCOMING" : "OUTGOING"
    const dateStr = entry?.BookgDt?.Dt || entry?.ValDt?.Dt || new Date().toISOString()
    const details = Array.isArray(entry?.NtryDtls?.TxDtls)
      ? entry.NtryDtls.TxDtls[0]
      : entry?.NtryDtls?.TxDtls

    return {
      id: `txn-${idx}`,
      date: dateStr,
      description: entry?.AddtlNtryInf || details?.RmtInf?.Ustrd || "",
      amount,
      direction,
      counterpartyName: details?.RltdPties?.Cdtr?.Nm || details?.RltdPties?.Dbtr?.Nm || null,
      counterpartyIban:
        details?.RltdPties?.CdtrAcct?.Id?.IBAN || details?.RltdPties?.DbtrAcct?.Id?.IBAN || null,
      reference: entry?.NtryRef || details?.Refs?.EndToEndId || null,
    }
  })

  const calcClosing =
    openingBal +
    transactions.reduce(
      (sum: number, t: any) => sum + (t.direction === "INCOMING" ? t.amount : -t.amount),
      0
    )
  const mathValid = Math.abs(calcClosing - closingBal) < 0.01

  return { transactions, openingBalance: openingBal, closingBalance: closingBal, mathValid }
}

async function processCsv(job: any) {
  const buffer = await getFileBuffer(job)
  const csvText = buffer.toString("utf-8")
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) throw new Error("CSV file is empty")

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const dateIdx = header.findIndex((h) => ["datum", "date"].includes(h))
  const descIdx = header.findIndex((h) => ["opis", "description"].includes(h))
  const amountIdx = header.findIndex((h) => ["iznos", "amount"].includes(h))

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error("CSV must have date, description, amount columns")
  }

  const transactions = lines
    .slice(1)
    .map((line, idx) => {
      const values = line.split(",").map((v) => v.trim())
      const amount = parseFloat(values[amountIdx].replace(",", ".")) || 0
      return {
        id: `txn-${idx}`,
        date: values[dateIdx],
        description: values[descIdx],
        amount: Math.abs(amount),
        direction: amount >= 0 ? "INCOMING" : "OUTGOING",
        counterpartyName: null,
        counterpartyIban: null,
        reference: null,
      }
    })
    .filter((t) => t.date && t.description)

  return { transactions, openingBalance: null, closingBalance: null, mathValid: true }
}

async function processPdfOrImage(job: any, ext: string) {
  const buffer = await getFileBuffer(job)
  let response: string

  if (ext === "pdf") {
    // For PDFs, extract text and use Deepseek
    let textContent = ""
    try {
      const pdfParse = (await import("pdf-parse")).default
      const data = await pdfParse(buffer)
      textContent = data.text
    } catch {
      textContent = ""
    }

    response = await deepseekJson({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: BANK_STATEMENT_SYSTEM_PROMPT },
        { role: "user", content: textContent || "Extract transactions from this bank statement." },
      ],
    })
  } else {
    // For images, use Ollama vision
    const ollamaKey = process.env.OLLAMA_API_KEY
    const ollamaBase = process.env.OLLAMA_BASE_URL || "https://ollama.com"
    const ollamaModel = process.env.OLLAMA_VISION_MODEL || "qwen3-vl:235b-instruct"

    if (!ollamaKey) {
      throw new Error("OLLAMA_API_KEY not configured for image processing")
    }

    const imageBase64 = buffer.toString("base64")
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000)

    try {
      const resp = await fetch(`${ollamaBase}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ollamaKey}`,
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: BANK_STATEMENT_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract transactions from this bank statement image. Return valid JSON only.",
                },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(`Ollama vision API error (${resp.status}): ${txt}`)
      }

      const json = await resp.json()
      response = json?.choices?.[0]?.message?.content
      if (!response) {
        throw new Error("Ollama vision returned empty content")
      }
    } catch (err) {
      clearTimeout(timeout)
      throw err
    }
  }

  const parsed = JSON.parse(response)
  const transactions = (parsed.transactions || []).map((t: any, idx: number) => ({
    id: `txn-${idx}`,
    date: t.date || new Date().toISOString().split("T")[0],
    description: t.description || "",
    amount: Math.abs(Number(t.amount) || 0),
    direction: t.direction === "INCOMING" ? "INCOMING" : "OUTGOING",
    counterpartyName: t.payee || null,
    counterpartyIban: t.counterpartyIban || null,
    reference: t.reference || null,
  }))

  const openingBalance = parsed.pageStartBalance ?? parsed.openingBalance ?? null
  const closingBalance = parsed.pageEndBalance ?? parsed.closingBalance ?? null

  // Calculate math validation
  let mathValid = true
  if (openingBalance !== null && closingBalance !== null) {
    const calcClosing =
      openingBalance +
      transactions.reduce(
        (sum: number, t: any) => sum + (t.direction === "INCOMING" ? t.amount : -t.amount),
        0
      )
    mathValid = Math.abs(calcClosing - closingBalance) < 0.01
  }

  return {
    transactions,
    openingBalance,
    closingBalance,
    mathValid,
  }
}

function extractAmount(amt: any): number {
  if (!amt) return 0
  if (typeof amt === "number") return amt
  if (typeof amt === "string") return parseFloat(amt) || 0
  if (typeof amt === "object") {
    const text = amt["#text"] ?? amt["_text"] ?? amt["$t"]
    if (text) return parseFloat(String(text)) || 0
  }
  return 0
}

async function processInvoice(job: any, ext: string) {
  const buffer = await getFileBuffer(job)
  let response: string

  if (ext === "pdf") {
    // For PDFs, extract text and use Deepseek
    let textContent = ""
    try {
      const pdfParse = (await import("pdf-parse")).default
      const data = await pdfParse(buffer)
      textContent = data.text
    } catch {
      textContent = ""
    }

    response = await deepseekJson({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: INVOICE_SYSTEM_PROMPT },
        { role: "user", content: textContent || "Extract invoice data from this document." },
      ],
    })
  } else {
    // For images, use Ollama vision
    const ollamaKey = process.env.OLLAMA_API_KEY
    const ollamaBase = process.env.OLLAMA_BASE_URL || "https://ollama.com"
    const ollamaModel = process.env.OLLAMA_VISION_MODEL || "qwen3-vl:235b-instruct"

    if (!ollamaKey) {
      throw new Error("OLLAMA_API_KEY not configured for image processing")
    }

    const imageBase64 = buffer.toString("base64")
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000) // 2 min timeout for images

    try {
      const resp = await fetch(`${ollamaBase}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ollamaKey}`,
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: INVOICE_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract invoice data from this image. Return valid JSON only.",
                },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(`Ollama vision API error (${resp.status}): ${txt}`)
      }

      const json = await resp.json()
      response = json?.choices?.[0]?.message?.content
      if (!response) {
        throw new Error("Ollama vision returned empty content")
      }
    } catch (err) {
      clearTimeout(timeout)
      throw err
    }
  }

  const parsed = JSON.parse(response)

  // Process line items
  const lineItems = (parsed.lineItems || []).map((item: any, idx: number) => ({
    id: `line-${idx}`,
    description: item.description || "",
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    taxRate: Number(item.taxRate) || 25,
    amount: Number(item.amount) || 0,
  }))

  // Calculate validation
  const calculatedSubtotal = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0)
  const subtotal = Number(parsed.subtotal) || calculatedSubtotal
  const taxAmount = Number(parsed.taxAmount) || 0
  const totalAmount = Number(parsed.totalAmount) || subtotal + taxAmount

  // Validate math: subtotal + tax should equal total
  const calculatedTotal = subtotal + taxAmount
  const mathValid = Math.abs(calculatedTotal - totalAmount) < 0.01

  return {
    vendor: {
      name: parsed.vendor?.name || "Nepoznati dobavljač",
      oib: parsed.vendor?.oib || null,
      address: parsed.vendor?.address || null,
      iban: parsed.vendor?.iban || parsed.payment?.iban || null,
      bankName: parsed.vendor?.bankName || null,
    },
    invoice: {
      number: parsed.invoice?.number || "N/A",
      issueDate: parsed.invoice?.issueDate || new Date().toISOString().split("T")[0],
      dueDate: parsed.invoice?.dueDate || null,
      deliveryDate: parsed.invoice?.deliveryDate || null,
    },
    lineItems,
    subtotal,
    taxAmount,
    totalAmount,
    currency: parsed.currency || "EUR",
    payment: {
      iban: parsed.payment?.iban || parsed.vendor?.iban || null,
      model: parsed.payment?.model || null,
      reference: parsed.payment?.reference || null,
    },
    mathValid,
  }
}
