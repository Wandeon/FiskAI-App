// src/lib/regulatory-truth/crawlers/nn-fetcher/__tests__/fetcher.test.ts
/**
 * Tests for NN Fetcher
 *
 * Fixture-driven tests with mocked database and network calls.
 * Verifies:
 * - Fetch HTML success stores evidence and enqueues parse
 * - Duplicate unchanged fetch skips insert and does not enqueue parse
 * - PDF link detected stores PDF evidence too
 * - ELI present links to Instrument via helper
 * - Retry logic with exponential backoff
 * - Content hash idempotency
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs"
import path from "path"
import crypto from "crypto"

// Mock the database before importing the module
vi.mock("@/lib/db", () => ({
  dbReg: {
    evidence: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    nNFetchAuditEvent: {
      create: vi.fn(),
    },
  },
}))

// Mock the instrument resolver
vi.mock("@/lib/regulatory-truth/utils/instrument-resolver", () => ({
  resolveOrCreateInstrument: vi.fn(),
  generateNNCanonicalKey: vi.fn((year, issue, item) => `nn:${year}:${issue}:${item}`),
}))

import { dbReg } from "@/lib/db"
import { resolveOrCreateInstrument } from "@/lib/regulatory-truth/utils/instrument-resolver"
import {
  processNNFetchJob,
  extractEliFromHtml,
  extractTitleFromHtml,
  extractPdfLinkFromHtml,
} from "../fetcher"
import type {
  NNFetchJob,
  NNFetcherDependencies,
  NNFetcherPolicy,
  FetchPageResult,
  ParseJob,
} from "../types"
import { DEFAULT_FETCHER_POLICY } from "../types"

// =============================================================================
// Test Fixtures
// =============================================================================

const FIXTURES_DIR = path.join(__dirname, "fixtures", "nn")

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf-8")
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex")
}

// Lazy load fixtures
let ITEM_2505_WITH_ELI_HTML: string
let ITEM_2506_NO_ELI_HTML: string
let ITEM_2509_CONSOLIDATED_HTML: string

beforeEach(() => {
  ITEM_2505_WITH_ELI_HTML = loadFixture("item-2505-with-eli.html")
  ITEM_2506_NO_ELI_HTML = loadFixture("item-2506-no-eli.html")
  ITEM_2509_CONSOLIDATED_HTML = loadFixture("item-2509-consolidated.html")
})

// =============================================================================
// Mock Factory
// =============================================================================

function createMockFetchJob(overrides: Partial<NNFetchJob> = {}): NNFetchJob {
  return {
    jobKey: "nn:item:2024:152:2505",
    runId: "run-001",
    source: {
      sourceType: "NN_SLUZBENI",
      url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2505.html",
      discoveredFromUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024/152",
    },
    nn: {
      year: 2024,
      issue: 152,
      item: 2505,
      month: 12,
    },
    hints: {
      textType: "AMENDMENT",
      title: "Zakon o izmjenama i dopunama Zakona o porezu na dohodak",
    },
    audit: {
      enumeratedAt: new Date().toISOString(),
      enumeratorVersion: "1.0.0",
    },
    ...overrides,
  }
}

function createMockDependencies(): NNFetcherDependencies & {
  fetchResults: Map<string, FetchPageResult>
  parseJobsEnqueued: ParseJob[]
} {
  const fetchResults = new Map<string, FetchPageResult>()
  const parseJobsEnqueued: ParseJob[] = []

  return {
    fetchResults,
    parseJobsEnqueued,
    pageFetcher: {
      fetchPage: vi.fn(async (url: string): Promise<FetchPageResult> => {
        const result = fetchResults.get(url)
        if (result) return result
        return { ok: false, statusCode: 404, error: "Not found" }
      }),
    },
    enqueueParseJob: vi.fn(async (job: ParseJob) => {
      parseJobsEnqueued.push(job)
    }),
  }
}

// =============================================================================
// ELI Extraction Tests
// =============================================================================

describe("extractEliFromHtml", () => {
  it("extracts ELI from meta tag", () => {
    const result = extractEliFromHtml(ITEM_2505_WITH_ELI_HTML)
    expect(result).toEqual({ eliUri: "eli/hr/zakon/2024/152/2505" })
  })

  it("extracts ELI from link tag", () => {
    const result = extractEliFromHtml(ITEM_2509_CONSOLIDATED_HTML)
    expect(result).toEqual({ eliUri: "eli/hr/zakon/2024/152/2509/procisceni" })
  })

  it("returns null when no ELI present", () => {
    const result = extractEliFromHtml(ITEM_2506_NO_ELI_HTML)
    expect(result).toBeNull()
  })
})

describe("extractTitleFromHtml", () => {
  it("extracts title from h1", () => {
    const result = extractTitleFromHtml(ITEM_2505_WITH_ELI_HTML)
    expect(result).toBe("2505. Zakon o izmjenama i dopunama Zakona o porezu na dohodak")
  })
})

describe("extractPdfLinkFromHtml", () => {
  it("extracts PDF link and resolves relative URL", () => {
    const baseUrl = "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2505.html"
    const result = extractPdfLinkFromHtml(ITEM_2505_WITH_ELI_HTML, baseUrl)
    expect(result).toBe("https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2505.pdf")
  })

  it("returns null when no PDF link", () => {
    const baseUrl = "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2506.html"
    const result = extractPdfLinkFromHtml(ITEM_2506_NO_ELI_HTML, baseUrl)
    expect(result).toBeNull()
  })
})

// =============================================================================
// Fetcher Tests
// =============================================================================

describe("processNNFetchJob", () => {
  let mockDb: typeof dbReg
  let mockResolveInstrument: ReturnType<typeof vi.fn>
  let evidenceStore: Map<string, { id: string; contentHash: string; instrumentId?: string | null }>
  let auditEvents: Array<{ eventType: string; decision: string; jobKey: string }>

  beforeEach(() => {
    vi.clearAllMocks()

    evidenceStore = new Map()
    auditEvents = []

    mockDb = dbReg as unknown as typeof dbReg
    mockResolveInstrument = resolveOrCreateInstrument as ReturnType<typeof vi.fn>

    // Setup evidence mock
    ;(mockDb.evidence.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { url: string; contentHash: string } }) => {
        const key = `${where.url}:${where.contentHash}`
        return evidenceStore.get(key) || null
      }
    )
    ;(mockDb.evidence.create as ReturnType<typeof vi.fn>).mockImplementation(
      async ({
        data,
      }: {
        data: { url: string; contentHash: string; instrumentId?: string | null }
      }) => {
        const id = `evidence-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const evidence = { id, contentHash: data.contentHash, instrumentId: data.instrumentId }
        evidenceStore.set(`${data.url}:${data.contentHash}`, evidence)
        return evidence
      }
    )

    // Setup audit event mock
    ;(mockDb.nNFetchAuditEvent.create as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: { eventType: string; decision: string; jobKey: string } }) => {
        auditEvents.push({
          eventType: data.eventType,
          decision: data.decision,
          jobKey: data.jobKey,
        })
        return { id: `audit-${Date.now()}` }
      }
    )

    // Setup instrument resolver mock
    mockResolveInstrument.mockResolvedValue({
      id: "instrument-001",
      canonicalId: "eli/hr/zakon/2024/152/2505",
      eliUri: "eli/hr/zakon/2024/152/2505",
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o izmjenama i dopunama Zakona o porezu na dohodak",
      shortTitle: null,
      status: "DELTA_ONLY",
      hasBaselineText: false,
      wasCreated: false,
      wasMerged: false,
    })
  })

  it("fetches HTML, stores evidence, and enqueues parse job", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2505_WITH_ELI_HTML,
      contentType: "text/html",
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false, // Disable PDF fetch for this test
    })

    expect(result.success).toBe(true)
    expect(result.htmlEvidence).toBeDefined()
    expect(result.htmlEvidence?.wasCreated).toBe(true)
    expect(result.htmlEvidence?.instrumentId).toBe("instrument-001")
    expect(result.parseJobEnqueued).toBe(true)

    // Verify parse job was enqueued
    expect(deps.parseJobsEnqueued).toHaveLength(1)
    expect(deps.parseJobsEnqueued[0].evidenceId).toBe(result.htmlEvidence?.id)
    expect(deps.parseJobsEnqueued[0].hints?.eliUri).toBe("eli/hr/zakon/2024/152/2505")
  })

  it("skips insert and parse when content unchanged", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    // Pre-populate store with existing evidence
    const contentHash = computeHash(ITEM_2505_WITH_ELI_HTML)
    evidenceStore.set(`${job.source.url}:${contentHash}`, {
      id: "existing-evidence-001",
      contentHash,
      instrumentId: "instrument-001",
    })

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2505_WITH_ELI_HTML,
      contentType: "text/html",
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
    })

    expect(result.success).toBe(true)
    expect(result.htmlEvidence?.wasCreated).toBe(false)
    expect(result.htmlEvidence?.id).toBe("existing-evidence-001")
    expect(result.parseJobEnqueued).toBe(false) // No parse job for unchanged content

    // Verify no parse job was enqueued
    expect(deps.parseJobsEnqueued).toHaveLength(0)

    // Verify SKIPPED audit event
    const skipEvent = auditEvents.find((e) => e.eventType === "FETCH_SKIPPED_UNCHANGED")
    expect(skipEvent).toBeDefined()
    expect(skipEvent?.decision).toBe("SKIPPED")
  })

  it("links to Instrument when ELI is present", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2505_WITH_ELI_HTML,
      contentType: "text/html",
    })

    await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
    })

    // Verify resolveOrCreateInstrument was called with ELI
    expect(mockResolveInstrument).toHaveBeenCalledWith(
      expect.objectContaining({
        eliUri: "eli/hr/zakon/2024/152/2505",
        nnCanonicalKey: "nn:2024:152:2505",
      })
    )

    // Verify INSTRUMENT_LINKED audit event
    const linkEvent = auditEvents.find((e) => e.eventType === "INSTRUMENT_LINKED")
    expect(linkEvent).toBeDefined()
  })

  it("links to Instrument via nnCanonicalKey when no ELI", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob({
      jobKey: "nn:item:2024:152:2506",
      source: {
        sourceType: "NN_SLUZBENI",
        url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2506.html",
        discoveredFromUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024/152",
      },
      nn: { year: 2024, issue: 152, item: 2506, month: 12 },
      hints: { textType: "AMENDMENT", title: "Zakon o izmjenama Zakona o trgovini" },
    })

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2506_NO_ELI_HTML,
      contentType: "text/html",
    })

    await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
    })

    // Verify resolveOrCreateInstrument was called with nnCanonicalKey only
    expect(mockResolveInstrument).toHaveBeenCalledWith(
      expect.objectContaining({
        eliUri: null,
        nnCanonicalKey: "nn:2024:152:2506",
      })
    )
  })

  it("fetches and stores PDF when present", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    const pdfContent = "%PDF-1.4 mock pdf content"
    const pdfUrl = "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2505.pdf"

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2505_WITH_ELI_HTML,
      contentType: "text/html",
    })

    deps.fetchResults.set(pdfUrl, {
      ok: true,
      statusCode: 200,
      content: pdfContent,
      contentType: "application/pdf",
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: true,
    })

    expect(result.success).toBe(true)
    expect(result.pdfEvidence).toBeDefined()
    expect(result.pdfEvidence?.wasCreated).toBe(true)
    expect(result.pdfEvidence?.pdfUrl).toBe(pdfUrl)

    // Verify FETCH_PDF_STORED audit event
    const pdfEvent = auditEvents.find((e) => e.eventType === "FETCH_PDF_STORED")
    expect(pdfEvent).toBeDefined()
    expect(pdfEvent?.decision).toBe("SUCCESS")
  })

  it("retries on 503 with exponential backoff", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    let callCount = 0
    ;(deps.pageFetcher.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++
      if (callCount < 3) {
        return { ok: false, statusCode: 503, error: "Service Unavailable" }
      }
      return {
        ok: true,
        statusCode: 200,
        content: ITEM_2505_WITH_ELI_HTML,
        contentType: "text/html",
      }
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
      maxRetries: 3,
      initialBackoffMs: 10, // Fast for tests
      maxBackoffMs: 100,
    })

    expect(result.success).toBe(true)
    expect(callCount).toBe(3) // Initial + 2 retries

    // Verify FETCH_RETRY audit events
    const retryEvents = auditEvents.filter((e) => e.eventType === "FETCH_RETRY")
    expect(retryEvents).toHaveLength(2)
  })

  it("fails after max retries exhausted", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    ;(deps.pageFetcher.fetchPage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusCode: 503,
      error: "Service Unavailable",
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
      maxRetries: 2,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("Service Unavailable")
    expect(result.parseJobEnqueued).toBe(false)

    // Verify FETCH_FAILED audit event
    const failEvent = auditEvents.find((e) => e.eventType === "FETCH_FAILED")
    expect(failEvent).toBeDefined()
    expect(failEvent?.decision).toBe("FAILED")
  })

  it("does not retry on 404", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    let callCount = 0
    ;(deps.pageFetcher.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++
      return { ok: false, statusCode: 404, error: "Not Found" }
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
      maxRetries: 3,
    })

    expect(result.success).toBe(false)
    expect(callCount).toBe(1) // No retries for 404

    // Verify no retry events
    const retryEvents = auditEvents.filter((e) => e.eventType === "FETCH_RETRY")
    expect(retryEvents).toHaveLength(0)
  })

  it("handles consolidated text type correctly", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob({
      jobKey: "nn:item:2024:152:2509",
      source: {
        sourceType: "NN_SLUZBENI",
        url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2509.html",
        discoveredFromUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024/152",
      },
      nn: { year: 2024, issue: 152, item: 2509, month: 12 },
      hints: { textType: "CONSOLIDATED", title: "Zakon o radu - pročišćeni tekst" },
    })

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2509_CONSOLIDATED_HTML,
      contentType: "text/html",
    })

    mockResolveInstrument.mockResolvedValue({
      id: "instrument-002",
      canonicalId: "eli/hr/zakon/2024/152/2509/procisceni",
      eliUri: "eli/hr/zakon/2024/152/2509/procisceni",
      nnCanonicalKey: "nn:2024:152:2509",
      title: "Zakon o radu - pročišćeni tekst",
      shortTitle: null,
      status: "CONSOLIDATED_AVAILABLE",
      hasBaselineText: false,
      wasCreated: true,
      wasMerged: false,
    })

    const result = await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
    })

    expect(result.success).toBe(true)

    // Verify resolveOrCreateInstrument was called with CONSOLIDATED text type
    expect(mockResolveInstrument).toHaveBeenCalledWith(
      expect.objectContaining({
        textType: "CONSOLIDATED",
      })
    )

    // Verify INSTRUMENT_CREATED audit event (since wasCreated: true)
    const createEvent = auditEvents.find((e) => e.eventType === "INSTRUMENT_CREATED")
    expect(createEvent).toBeDefined()
  })

  it("includes correct hints in parse job", async () => {
    const deps = createMockDependencies()
    const job = createMockFetchJob()

    deps.fetchResults.set(job.source.url, {
      ok: true,
      statusCode: 200,
      content: ITEM_2505_WITH_ELI_HTML,
      contentType: "text/html",
    })

    await processNNFetchJob(job, deps, {
      ...DEFAULT_FETCHER_POLICY,
      fetchPdfs: false,
      parserVersion: "2.0.0",
    })

    expect(deps.parseJobsEnqueued).toHaveLength(1)
    const parseJob = deps.parseJobsEnqueued[0]

    expect(parseJob.parserVersion).toBe("2.0.0")
    expect(parseJob.jobKey).toBe(job.jobKey)
    expect(parseJob.source.sourceType).toBe("NN_SLUZBENI")
    expect(parseJob.nn.year).toBe(2024)
    expect(parseJob.nn.issue).toBe(152)
    expect(parseJob.nn.item).toBe(2505)
    expect(parseJob.hints?.instrumentId).toBe("instrument-001")
    expect(parseJob.hints?.eliUri).toBe("eli/hr/zakon/2024/152/2505")
  })
})
