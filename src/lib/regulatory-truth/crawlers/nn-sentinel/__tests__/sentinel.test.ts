// src/lib/regulatory-truth/crawlers/nn-sentinel/__tests__/sentinel.test.ts
/**
 * Tests for NN Sentinel
 *
 * Tests verify:
 * 1. Deterministic enumeration - same inputs produce same outputs in same order
 * 2. NNEnqueuedJob-based idempotency - race-proof global dedupe
 * 3. Per-issue counters - coverage tracking even in summary mode
 * 4. Anomaly handling - stops on suspicious patterns
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { parseYearPage, parseIssuePage } from "../parser"
import { runNNSentinelEnumeration } from "../sentinel"
import type {
  NNSentinelConfig,
  NNListingFetcher,
  NNFetchJob,
  NNSentinelDependencies,
} from "../types"

// =============================================================================
// Test Fixtures
// =============================================================================

const FIXTURES_DIR = join(__dirname, "fixtures/nn")

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8")
}

const YEAR_2024_HTML = loadFixture("year-2024.html")
const ISSUE_151_HTML = loadFixture("issue-151.html")
const ISSUE_152_HTML = loadFixture("issue-152.html")
const ISSUE_EMPTY_HTML = loadFixture("issue-empty.html")

// =============================================================================
// Mock Dependencies
// =============================================================================

class MockListingFetcher implements NNListingFetcher {
  private yearPages: Map<number, string> = new Map()
  private issuePages: Map<string, string> = new Map()

  setYearPage(year: number, html: string): void {
    this.yearPages.set(year, html)
  }

  setIssuePage(year: number, issue: number, html: string): void {
    this.issuePages.set(`${year}/${issue}`, html)
  }

  async fetchYearPage(year: number): Promise<string> {
    const html = this.yearPages.get(year)
    if (!html) {
      throw new Error(`No fixture for year ${year}`)
    }
    return html
  }

  async fetchIssuePage(year: number, issue: number): Promise<string> {
    const html = this.issuePages.get(`${year}/${issue}`)
    if (!html) {
      throw new Error(`No fixture for issue ${year}/${issue}`)
    }
    return html
  }
}

// Mock NNEnqueuedJob table
class MockEnqueuedJobDb {
  jobs: Map<
    string,
    { jobKey: string; firstSchedulerRunId: string; latestSchedulerRunId?: string }
  > = new Map()

  reset(): void {
    this.jobs.clear()
  }

  tryCreate(jobKey: string, schedulerRunId: string): { success: boolean; alreadyExists: boolean } {
    if (this.jobs.has(jobKey)) {
      // Update latestSchedulerRunId
      const existing = this.jobs.get(jobKey)!
      existing.latestSchedulerRunId = schedulerRunId
      return { success: false, alreadyExists: true }
    }
    this.jobs.set(jobKey, { jobKey, firstSchedulerRunId: schedulerRunId })
    return { success: true, alreadyExists: false }
  }
}

// Mock checkpoint table
class MockCheckpointDb {
  checkpoints: Map<
    string,
    {
      id: string
      schedulerRunId: string
      year: number
      lastCompletedIssueNumber: number | null
      status: string
      anomalyCount: number
      totalIssuesDiscovered: number
      totalItemsEnqueued: number
      totalItemsSkipped: number
    }
  > = new Map()

  reset(): void {
    this.checkpoints.clear()
  }

  getCheckpoint(schedulerRunId: string, year: number) {
    return this.checkpoints.get(`${schedulerRunId}:${year}`)
  }
}

// Mock audit events
class MockAuditDb {
  events: Array<{
    schedulerRunId: string
    eventType: string
    decision: string
    reasonCode: string
    year?: number
    issue?: number
    item?: number
    jobKey?: string
    details?: unknown
  }> = []

  reset(): void {
    this.events = []
  }

  getEvents(schedulerRunId: string) {
    return this.events.filter((e) => e.schedulerRunId === schedulerRunId)
  }

  getEnqueuedJobKeys(schedulerRunId: string): string[] {
    return this.events
      .filter((e) => e.schedulerRunId === schedulerRunId && e.reasonCode === "ENQUEUED_ITEM")
      .map((e) => e.jobKey!)
  }

  getIssueSummaries(schedulerRunId: string) {
    return this.events.filter(
      (e) => e.schedulerRunId === schedulerRunId && e.reasonCode === "ISSUE_SUMMARY"
    )
  }
}

const mockEnqueuedJobDb = new MockEnqueuedJobDb()
const mockCheckpointDb = new MockCheckpointDb()
const mockAuditDb = new MockAuditDb()

// Mock the database module
vi.mock("@/lib/db", () => ({
  dbReg: {
    nNEnqueuedJob: {
      create: vi.fn(async ({ data }) => {
        const result = mockEnqueuedJobDb.tryCreate(data.jobKey, data.firstSchedulerRunId)
        if (!result.success) {
          const error = new Error("Unique constraint failed on jobKey")
          ;(error as Error & { code: string }).code = "P2002"
          throw error
        }
        return { jobKey: data.jobKey }
      }),
      update: vi.fn(async ({ where, data }) => {
        const job = mockEnqueuedJobDb.jobs.get(where.jobKey)
        if (job && data.latestSchedulerRunId) {
          job.latestSchedulerRunId = data.latestSchedulerRunId
        }
        return job
      }),
    },
    nNSentinelCheckpoint: {
      findUnique: vi.fn(async ({ where }) => {
        const key = `${where.schedulerRunId_year.schedulerRunId}:${where.schedulerRunId_year.year}`
        return mockCheckpointDb.checkpoints.get(key) || null
      }),
      create: vi.fn(async ({ data }) => {
        const checkpoint = {
          id: `cp-${Date.now()}-${Math.random()}`,
          ...data,
          lastCompletedIssueNumber: null,
          anomalyCount: 0,
          totalIssuesDiscovered: 0,
          totalItemsEnqueued: 0,
          totalItemsSkipped: 0,
        }
        mockCheckpointDb.checkpoints.set(`${data.schedulerRunId}:${data.year}`, checkpoint)
        return checkpoint
      }),
      update: vi.fn(async ({ where, data }) => {
        const checkpoint = Array.from(mockCheckpointDb.checkpoints.values()).find(
          (c) => c.id === where.id
        )
        if (checkpoint) {
          Object.assign(checkpoint, data)
        }
        return checkpoint
      }),
    },
    nNSentinelAuditEvent: {
      create: vi.fn(async ({ data }) => {
        mockAuditDb.events.push({
          schedulerRunId: data.schedulerRunId,
          eventType: data.eventType,
          decision: data.decision,
          reasonCode: data.reasonCode,
          year: data.year ?? undefined,
          issue: data.issue ?? undefined,
          item: data.item ?? undefined,
          jobKey: data.jobKey ?? undefined,
          details: data.details ?? undefined,
        })
        return { id: `ae-${Date.now()}` }
      }),
    },
  },
}))

// =============================================================================
// HTML Parsing Tests
// =============================================================================

describe("parseYearPage", () => {
  it("extracts issues from year page HTML", () => {
    const issues = parseYearPage(YEAR_2024_HTML, 2024)

    expect(issues.length).toBe(2)
    expect(issues[0].issueNumber).toBe(151)
    expect(issues[1].issueNumber).toBe(152)
  })

  it("returns issues sorted by issue number ascending", () => {
    // Year page has issues in DOM order: 152, 151
    // Should return sorted: 151, 152
    const issues = parseYearPage(YEAR_2024_HTML, 2024)

    expect(issues[0].issueNumber).toBe(151)
    expect(issues[1].issueNumber).toBe(152)

    // Verify strictly ascending
    for (let i = 1; i < issues.length; i++) {
      expect(issues[i].issueNumber).toBeGreaterThan(issues[i - 1].issueNumber)
    }
  })
})

describe("parseIssuePage", () => {
  it("extracts items from issue page HTML", () => {
    const items = parseIssuePage(ISSUE_152_HTML, 2024, 152)

    expect(items.length).toBe(5)
  })

  it("returns items sorted by item number ascending", () => {
    // Issue 152 has items in DOM order: 2506, 2505, 2508, 2507, 2509
    // Should return sorted: 2505, 2506, 2507, 2508, 2509
    const items = parseIssuePage(ISSUE_152_HTML, 2024, 152)

    expect(items[0].itemNumber).toBe(2505)
    expect(items[1].itemNumber).toBe(2506)
    expect(items[2].itemNumber).toBe(2507)
    expect(items[3].itemNumber).toBe(2508)
    expect(items[4].itemNumber).toBe(2509)

    // Verify strictly ascending
    for (let i = 1; i < items.length; i++) {
      expect(items[i].itemNumber).toBeGreaterThan(items[i - 1].itemNumber)
    }
  })

  it("detects consolidated text type from title", () => {
    const items = parseIssuePage(ISSUE_152_HTML, 2024, 152)
    const consolidated = items.find((i) => i.itemNumber === 2509)

    expect(consolidated?.textType).toBe("CONSOLIDATED")
  })

  it("detects amendment text type from title", () => {
    const items = parseIssuePage(ISSUE_152_HTML, 2024, 152)
    const amendment = items.find((i) => i.itemNumber === 2505)

    expect(amendment?.textType).toBe("AMENDMENT")
  })

  it("returns empty array for empty issue page", () => {
    const items = parseIssuePage(ISSUE_EMPTY_HTML, 2024, 999)
    expect(items.length).toBe(0)
  })
})

// =============================================================================
// Deterministic Enumeration Tests
// =============================================================================

describe("Deterministic Enumeration", () => {
  beforeEach(() => {
    mockEnqueuedJobDb.reset()
    mockCheckpointDb.reset()
    mockAuditDb.reset()
  })

  it("produces identical jobKeys when running twice with same inputs", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    const enqueuedJobs1: NNFetchJob[] = []
    const deps1: NNSentinelDependencies = {
      fetcher,
      enqueueJob: async (job) => {
        enqueuedJobs1.push(job)
      },
    }

    // First run
    await runNNSentinelEnumeration(config, "run-1", "run-1", deps1)
    const jobKeys1 = enqueuedJobs1.map((j) => j.jobKey)

    // Reset mocks but not enqueuedJobDb (to test idempotency)
    mockCheckpointDb.reset()
    mockAuditDb.reset()

    const enqueuedJobs2: NNFetchJob[] = []
    const deps2: NNSentinelDependencies = {
      fetcher,
      enqueueJob: async (job) => {
        enqueuedJobs2.push(job)
      },
    }

    // Second run - should skip all (already enqueued)
    const result2 = await runNNSentinelEnumeration(config, "run-2", "run-2", deps2)

    expect(result2.itemsEnqueued).toBe(0)
    expect(result2.itemsSkipped).toBe(8) // All 8 items skipped

    // Verify first run had correct order
    expect(jobKeys1).toEqual([
      "nn:item:2024:151:2500",
      "nn:item:2024:151:2501",
      "nn:item:2024:151:2502",
      "nn:item:2024:152:2505",
      "nn:item:2024:152:2506",
      "nn:item:2024:152:2507",
      "nn:item:2024:152:2508",
      "nn:item:2024:152:2509",
    ])
  })

  it("produces jobKeys in deterministic order", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    const enqueuedJobs: NNFetchJob[] = []
    const deps: NNSentinelDependencies = {
      fetcher,
      enqueueJob: async (job) => {
        enqueuedJobs.push(job)
      },
    }

    await runNNSentinelEnumeration(config, "run-1", "run-1", deps)

    // Issue 151 items come before issue 152 items (sorted by issue)
    // Within each issue, items are sorted by item number
    const jobKeys = enqueuedJobs.map((j) => j.jobKey)

    // Issue 151: 2500, 2501, 2502
    expect(jobKeys[0]).toBe("nn:item:2024:151:2500")
    expect(jobKeys[1]).toBe("nn:item:2024:151:2501")
    expect(jobKeys[2]).toBe("nn:item:2024:151:2502")

    // Issue 152: 2505, 2506, 2507, 2508, 2509 (note: sorted despite DOM order)
    expect(jobKeys[3]).toBe("nn:item:2024:152:2505")
    expect(jobKeys[4]).toBe("nn:item:2024:152:2506")
    expect(jobKeys[5]).toBe("nn:item:2024:152:2507")
    expect(jobKeys[6]).toBe("nn:item:2024:152:2508")
    expect(jobKeys[7]).toBe("nn:item:2024:152:2509")
  })
})

// =============================================================================
// NNEnqueuedJob Idempotency Tests
// =============================================================================

describe("NNEnqueuedJob-based Idempotency", () => {
  beforeEach(() => {
    mockEnqueuedJobDb.reset()
    mockCheckpointDb.reset()
    mockAuditDb.reset()
  })

  it("prevents duplicate enqueues across different runs", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    // First run
    const jobs1: NNFetchJob[] = []
    await runNNSentinelEnumeration(config, "run-A", "run-A", {
      fetcher,
      enqueueJob: async (job) => jobs1.push(job),
    })

    expect(jobs1.length).toBe(8)
    expect(mockEnqueuedJobDb.jobs.size).toBe(8)

    // Reset checkpoint but keep NNEnqueuedJob state
    mockCheckpointDb.reset()
    mockAuditDb.reset()

    // Second run (different schedulerRunId)
    const jobs2: NNFetchJob[] = []
    const result2 = await runNNSentinelEnumeration(config, "run-B", "run-B", {
      fetcher,
      enqueueJob: async (job) => jobs2.push(job),
    })

    // No new jobs should be enqueued
    expect(jobs2.length).toBe(0)
    expect(result2.itemsEnqueued).toBe(0)
    expect(result2.itemsSkipped).toBe(8)

    // NNEnqueuedJob table should still have 8 jobs
    expect(mockEnqueuedJobDb.jobs.size).toBe(8)

    // latestSchedulerRunId should be updated
    const firstJob = mockEnqueuedJobDb.jobs.get("nn:item:2024:151:2500")
    expect(firstJob?.firstSchedulerRunId).toBe("run-A")
    expect(firstJob?.latestSchedulerRunId).toBe("run-B")
  })
})

// =============================================================================
// Per-Issue Counter Tests
// =============================================================================

describe("Per-Issue Counters", () => {
  beforeEach(() => {
    mockEnqueuedJobDb.reset()
    mockCheckpointDb.reset()
    mockAuditDb.reset()
  })

  it("produces per-issue summaries for coverage tracking", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    const result = await runNNSentinelEnumeration(config, "run-1", "run-1", {
      fetcher,
      enqueueJob: async () => {},
    })

    expect(result.issueSummaries.length).toBe(2)

    const issue151 = result.issueSummaries.find((s) => s.issue === 151)
    expect(issue151?.itemsDiscovered).toBe(3)
    expect(issue151?.itemsEnqueued).toBe(3)
    expect(issue151?.itemsSkippedAlreadyEnqueued).toBe(0)

    const issue152 = result.issueSummaries.find((s) => s.issue === 152)
    expect(issue152?.itemsDiscovered).toBe(5)
    expect(issue152?.itemsEnqueued).toBe(5)
  })

  it("logs ISSUE_SUMMARY audit events", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    await runNNSentinelEnumeration(config, "run-1", "run-1", {
      fetcher,
      enqueueJob: async () => {},
    })

    const summaries = mockAuditDb.getIssueSummaries("run-1")
    expect(summaries.length).toBe(2)
  })
})

// =============================================================================
// Anomaly Handling Tests
// =============================================================================

describe("Anomaly Handling", () => {
  beforeEach(() => {
    mockEnqueuedJobDb.reset()
    mockCheckpointDb.reset()
    mockAuditDb.reset()
  })

  it("pauses when issue page has no items", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_EMPTY_HTML) // Empty issue
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
      policy: { stopOnAnomaly: true },
    }

    const result = await runNNSentinelEnumeration(config, "run-1", "run-1", {
      fetcher,
      enqueueJob: async () => {},
    })

    expect(result.paused).toBe(true)
    expect(result.pauseReason).toContain("zero items")
  })

  it("continues without stopping when stopOnAnomaly is false", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_EMPTY_HTML) // Empty issue
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
      policy: { stopOnAnomaly: false },
    }

    const result = await runNNSentinelEnumeration(config, "run-1", "run-1", {
      fetcher,
      enqueueJob: async () => {},
    })

    // Should continue to issue 152 even though 151 was empty
    expect(result.paused).toBe(false)
    expect(result.itemsEnqueued).toBe(5) // Only issue 152 items
  })
})

// =============================================================================
// Job Key Format Tests
// =============================================================================

describe("Job Key Format", () => {
  beforeEach(() => {
    mockEnqueuedJobDb.reset()
    mockCheckpointDb.reset()
    mockAuditDb.reset()
  })

  it("generates jobKeys in correct format", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    const enqueuedJobs: NNFetchJob[] = []
    await runNNSentinelEnumeration(config, "run-1", "run-1", {
      fetcher,
      enqueueJob: async (job) => enqueuedJobs.push(job),
    })

    // Check format: nn:item:YYYY:ISSUE:ITEM
    for (const job of enqueuedJobs) {
      expect(job.jobKey).toMatch(/^nn:item:\d{4}:\d+:\d+$/)
    }
  })

  it("includes correct metadata in fetch jobs", async () => {
    const fetcher = new MockListingFetcher()
    fetcher.setYearPage(2024, YEAR_2024_HTML)
    fetcher.setIssuePage(2024, 151, ISSUE_151_HTML)
    fetcher.setIssuePage(2024, 152, ISSUE_152_HTML)

    const config: NNSentinelConfig = {
      yearStart: 2024,
      yearEnd: 2024,
      crawlMode: "BACKFILL",
    }

    const enqueuedJobs: NNFetchJob[] = []
    await runNNSentinelEnumeration(config, "run-1", "run-1", {
      fetcher,
      enqueueJob: async (job) => enqueuedJobs.push(job),
    })

    const job = enqueuedJobs.find((j) => j.nn.item === 2509)
    expect(job).toBeDefined()
    expect(job!.source.sourceType).toBe("NN_SLUZBENI")
    expect(job!.nn.year).toBe(2024)
    expect(job!.nn.issue).toBe(152)
    expect(job!.hints?.textType).toBe("CONSOLIDATED")
    expect(job!.audit.enumeratorVersion).toBeDefined()
  })
})
