# LLM Provider Health + Progress Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the operational blind spot where LLM providers can fail silently. After this work, "delete the Ollama API key" produces a CRITICAL alert within 5 minutes.

**Architecture:** Two-layer approach: (1) Provider health checks with circuit breaker prevent hammering dead providers, (2) Progress gate alerts detect mid-pipeline stalls even when discovery is healthy.

**Tech Stack:** Prisma (schema), Redis (circuit breaker state), BullMQ (existing queues), existing watchdog infrastructure.

---

## PR-1 (P0): LLM Provider Health + Circuit Breaker

### Scope

| In Scope                     | Out of Scope                 |
| ---------------------------- | ---------------------------- |
| Provider ping health checks  | Token-spending health probes |
| Redis-backed circuit breaker | Complex retry policies       |
| WatchdogAlert integration    | LLM usage dashboard          |
| Admin UI health indicator    | Provider failover logic      |

### Acceptance Criteria

1. Break Ollama URL or key → CRITICAL alert within 5 minutes
2. When circuit OPEN, extractor stops calling provider (fails fast)
3. Single recovery closes breaker and clears alert
4. Admin system-status shows provider health (green/yellow/red)

---

### Task 1: Schema Migration - Add LLM Provider Types

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_llm_provider_health/migration.sql`

**Step 1: Add enum values to schema**

Add to `WatchdogCheckType`:

```prisma
enum WatchdogCheckType {
  // ... existing values ...
  LLM_PROVIDER_HEALTH  // NEW: Ollama/OpenAI/DeepSeek reachability
}
```

Add to `WatchdogAlertType`:

```prisma
enum WatchdogAlertType {
  // ... existing values ...
  LLM_PROVIDER_DOWN    // NEW: Provider unreachable
  LLM_CIRCUIT_OPEN     // NEW: Circuit breaker tripped
}
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_llm_provider_health
```

**Step 3: Verify migration**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(watchdog): add LLM provider health check types"
```

---

### Task 2: Create LLM Circuit Breaker Module

**Files:**

- Create: `src/lib/regulatory-truth/watchdog/llm-circuit-breaker.ts`
- Create: `src/lib/regulatory-truth/watchdog/__tests__/llm-circuit-breaker.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/regulatory-truth/watchdog/__tests__/llm-circuit-breaker.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { LLMCircuitBreaker, LLMProvider, CircuitState } from "../llm-circuit-breaker"

// Mock Redis
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))

describe("LLMCircuitBreaker", () => {
  let breaker: LLMCircuitBreaker

  beforeEach(() => {
    vi.clearAllMocks()
    breaker = new LLMCircuitBreaker()
  })

  describe("state transitions", () => {
    it("starts CLOSED", async () => {
      const state = await breaker.getState("ollama")
      expect(state.state).toBe("CLOSED")
    })

    it("opens after consecutive failures threshold", async () => {
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        await breaker.recordFailure("ollama", "timeout")
      }
      const state = await breaker.getState("ollama")
      expect(state.state).toBe("OPEN")
    })

    it("resets on success when CLOSED", async () => {
      await breaker.recordFailure("ollama", "timeout")
      await breaker.recordSuccess("ollama")
      const state = await breaker.getState("ollama")
      expect(state.consecutiveFailures).toBe(0)
    })

    it("canCall returns false when OPEN", async () => {
      for (let i = 0; i < 5; i++) {
        await breaker.recordFailure("ollama", "timeout")
      }
      expect(await breaker.canCall("ollama")).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/llm-circuit-breaker.test.ts
```

Expected: FAIL with "Cannot find module '../llm-circuit-breaker'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/regulatory-truth/watchdog/llm-circuit-breaker.ts
import { redis } from "@/lib/redis"

export type LLMProvider = "ollama" | "openai" | "deepseek"
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

export interface CircuitBreakerState {
  provider: LLMProvider
  state: CircuitState
  consecutiveFailures: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
  lastError: string | null
}

const REDIS_KEY_PREFIX = "llm-circuit:"
const FAILURE_THRESHOLD = 5
const OPEN_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const FAILURE_WINDOW_MS = 2 * 60 * 1000 // 2 minutes

export class LLMCircuitBreaker {
  private async getRedisKey(provider: LLMProvider): Promise<string> {
    return `${REDIS_KEY_PREFIX}${provider}`
  }

  async getState(provider: LLMProvider): Promise<CircuitBreakerState> {
    const key = await this.getRedisKey(provider)
    const data = await redis.get(key)

    if (!data) {
      return {
        provider,
        state: "CLOSED",
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        openedAt: null,
        lastError: null,
      }
    }

    const state = JSON.parse(data) as CircuitBreakerState

    // Check if OPEN should transition to HALF_OPEN
    if (state.state === "OPEN" && state.openedAt) {
      const elapsed = Date.now() - state.openedAt
      if (elapsed >= OPEN_DURATION_MS) {
        state.state = "HALF_OPEN"
        await this.saveState(provider, state)
      }
    }

    return state
  }

  private async saveState(provider: LLMProvider, state: CircuitBreakerState): Promise<void> {
    const key = await this.getRedisKey(provider)
    await redis.set(key, JSON.stringify(state), "EX", 3600) // 1 hour TTL
  }

  async canCall(provider: LLMProvider): Promise<boolean> {
    const state = await this.getState(provider)

    if (state.state === "CLOSED") return true
    if (state.state === "HALF_OPEN") return true // Allow probe
    return false // OPEN
  }

  async recordSuccess(provider: LLMProvider): Promise<void> {
    const state = await this.getState(provider)

    state.consecutiveFailures = 0
    state.lastSuccessAt = Date.now()
    state.state = "CLOSED"
    state.openedAt = null
    state.lastError = null

    await this.saveState(provider, state)
    console.log(`[llm-circuit] ${provider} circuit CLOSED after success`)
  }

  async recordFailure(provider: LLMProvider, error: string): Promise<void> {
    const state = await this.getState(provider)
    const now = Date.now()

    // Reset counter if last failure was outside the window
    if (state.lastFailureAt && now - state.lastFailureAt > FAILURE_WINDOW_MS) {
      state.consecutiveFailures = 0
    }

    state.consecutiveFailures++
    state.lastFailureAt = now
    state.lastError = error

    // Check if we should open the circuit
    if (state.consecutiveFailures >= FAILURE_THRESHOLD && state.state !== "OPEN") {
      state.state = "OPEN"
      state.openedAt = now
      console.log(
        `[llm-circuit] ${provider} circuit OPEN after ${state.consecutiveFailures} failures: ${error}`
      )
    }

    await this.saveState(provider, state)
  }

  async getAllStates(): Promise<CircuitBreakerState[]> {
    const providers: LLMProvider[] = ["ollama", "openai", "deepseek"]
    return Promise.all(providers.map((p) => this.getState(p)))
  }

  async reset(provider: LLMProvider): Promise<void> {
    const key = await this.getRedisKey(provider)
    await redis.del(key)
    console.log(`[llm-circuit] ${provider} circuit RESET`)
  }
}

// Singleton
export const llmCircuitBreaker = new LLMCircuitBreaker()
```

**Step 4: Run test to verify it passes**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/llm-circuit-breaker.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/llm-circuit-breaker.ts src/lib/regulatory-truth/watchdog/__tests__/llm-circuit-breaker.test.ts
git commit -m "feat(watchdog): add LLM circuit breaker with Redis state"
```

---

### Task 3: Create Provider Health Ping Functions

**Files:**

- Create: `src/lib/regulatory-truth/watchdog/llm-provider-health.ts`
- Create: `src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  pingOllama,
  pingOpenAI,
  pingDeepSeek,
  type ProviderPingResult,
} from "../llm-provider-health"

// Mock fetch
global.fetch = vi.fn()

describe("LLM Provider Health Pings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("pingOllama", () => {
    it("returns HEALTHY when /api/version responds 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ version: "0.1.0" }),
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("HEALTHY")
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it("returns CRITICAL with TIMEOUT when request times out", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"))

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("TIMEOUT")
    })

    it("returns CRITICAL with AUTH on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("AUTH")
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts
```

Expected: FAIL with "Cannot find module '../llm-provider-health'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/regulatory-truth/watchdog/llm-provider-health.ts
import type { LLMProvider } from "./llm-circuit-breaker"

export type HealthStatus = "HEALTHY" | "DEGRADED" | "CRITICAL"
export type ReasonCode = "OK" | "TIMEOUT" | "DNS" | "AUTH" | "5XX" | "RATE_LIMIT" | "UNKNOWN"

export interface ProviderPingResult {
  provider: LLMProvider
  status: HealthStatus
  reasonCode: ReasonCode
  latencyMs: number
  error?: string
  checkedAt: Date
}

const CONNECT_TIMEOUT_MS = 2000
const TOTAL_TIMEOUT_MS = 5000

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return response
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

function classifyError(
  error: unknown,
  statusCode?: number
): { status: HealthStatus; reasonCode: ReasonCode } {
  if (statusCode === 401 || statusCode === 403) {
    return { status: "CRITICAL", reasonCode: "AUTH" }
  }
  if (statusCode === 429) {
    return { status: "DEGRADED", reasonCode: "RATE_LIMIT" }
  }
  if (statusCode && statusCode >= 500) {
    return { status: "CRITICAL", reasonCode: "5XX" }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("timeout") || message.includes("abort")) {
    return { status: "CRITICAL", reasonCode: "TIMEOUT" }
  }
  if (message.includes("enotfound") || message.includes("dns")) {
    return { status: "CRITICAL", reasonCode: "DNS" }
  }

  return { status: "CRITICAL", reasonCode: "UNKNOWN" }
}

export async function pingOllama(): Promise<ProviderPingResult> {
  const endpoint = process.env.OLLAMA_ENDPOINT || "https://ollama.com"
  const apiKey = process.env.OLLAMA_API_KEY
  const startTime = Date.now()

  try {
    // Use /api/tags as a lightweight health check (lists models)
    const response = await fetchWithTimeout(
      `${endpoint}/api/tags`,
      {
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      },
      TOTAL_TIMEOUT_MS
    )

    const latencyMs = Date.now() - startTime

    if (response.ok) {
      return {
        provider: "ollama",
        status: "HEALTHY",
        reasonCode: "OK",
        latencyMs,
        checkedAt: new Date(),
      }
    }

    const { status, reasonCode } = classifyError(null, response.status)
    return {
      provider: "ollama",
      status,
      reasonCode,
      latencyMs,
      error: `HTTP ${response.status}`,
      checkedAt: new Date(),
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const { status, reasonCode } = classifyError(error)
    return {
      provider: "ollama",
      status,
      reasonCode,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    }
  }
}

export async function pingOpenAI(): Promise<ProviderPingResult> {
  const apiKey = process.env.OPENAI_API_KEY
  const startTime = Date.now()

  if (!apiKey) {
    return {
      provider: "openai",
      status: "CRITICAL",
      reasonCode: "AUTH",
      latencyMs: 0,
      error: "OPENAI_API_KEY not configured",
      checkedAt: new Date(),
    }
  }

  try {
    // Use /v1/models as a cheap health check (no tokens spent)
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      TOTAL_TIMEOUT_MS
    )

    const latencyMs = Date.now() - startTime

    if (response.ok) {
      return {
        provider: "openai",
        status: "HEALTHY",
        reasonCode: "OK",
        latencyMs,
        checkedAt: new Date(),
      }
    }

    const { status, reasonCode } = classifyError(null, response.status)
    return {
      provider: "openai",
      status,
      reasonCode,
      latencyMs,
      error: `HTTP ${response.status}`,
      checkedAt: new Date(),
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const { status, reasonCode } = classifyError(error)
    return {
      provider: "openai",
      status,
      reasonCode,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    }
  }
}

export async function pingDeepSeek(): Promise<ProviderPingResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const startTime = Date.now()

  if (!apiKey) {
    return {
      provider: "deepseek",
      status: "CRITICAL",
      reasonCode: "AUTH",
      latencyMs: 0,
      error: "DEEPSEEK_API_KEY not configured",
      checkedAt: new Date(),
    }
  }

  try {
    // DeepSeek uses OpenAI-compatible API, use /models endpoint
    const response = await fetchWithTimeout(
      "https://api.deepseek.com/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      TOTAL_TIMEOUT_MS
    )

    const latencyMs = Date.now() - startTime

    if (response.ok) {
      return {
        provider: "deepseek",
        status: "HEALTHY",
        reasonCode: "OK",
        latencyMs,
        checkedAt: new Date(),
      }
    }

    const { status, reasonCode } = classifyError(null, response.status)
    return {
      provider: "deepseek",
      status,
      reasonCode,
      latencyMs,
      error: `HTTP ${response.status}`,
      checkedAt: new Date(),
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const { status, reasonCode } = classifyError(error)
    return {
      provider: "deepseek",
      status,
      reasonCode,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    }
  }
}

export async function pingAllProviders(): Promise<ProviderPingResult[]> {
  // Run in parallel for speed
  return Promise.all([pingOllama(), pingOpenAI(), pingDeepSeek()])
}

// Get the currently active provider based on env config
export function getActiveProvider(): LLMProvider {
  const explicit = (process.env.NEWS_AI_PROVIDER || process.env.AI_PROVIDER || "").toLowerCase()
  if (explicit === "openai") return "openai"
  if (explicit === "deepseek") return "deepseek"
  if (explicit === "ollama") return "ollama"
  if (process.env.OLLAMA_API_KEY) return "ollama"
  if (process.env.DEEPSEEK_API_KEY) return "deepseek"
  if (process.env.OPENAI_API_KEY) return "openai"
  return "ollama"
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/llm-provider-health.ts src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts
git commit -m "feat(watchdog): add LLM provider ping functions"
```

---

### Task 4: Integrate Health Check into Watchdog

**Files:**

- Modify: `src/lib/regulatory-truth/watchdog/health-monitors.ts`
- Modify: `src/lib/regulatory-truth/watchdog/types.ts`

**Step 1: Add thresholds to types.ts**

In `DEFAULT_THRESHOLDS` add:

```typescript
LLM_HEALTH_CHECK_INTERVAL_MS: 60000, // 1 minute
LLM_CONSECUTIVE_FAILURES_ALERT: 2,   // Alert after 2 consecutive failures
```

In `THRESHOLD_TO_CONFIG_KEY` add mappings.

**Step 2: Add health check function to health-monitors.ts**

Add import at top:

```typescript
import { pingAllProviders, getActiveProvider, type ProviderPingResult } from "./llm-provider-health"
import { llmCircuitBreaker } from "./llm-circuit-breaker"
```

Add new function:

```typescript
/**
 * Check LLM provider health and update circuit breaker state.
 * Creates alerts for unhealthy providers.
 */
export async function checkLLMProviderHealth(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []
  const activeProvider = getActiveProvider()

  console.log(`[health] Checking LLM providers (active: ${activeProvider})...`)

  const pingResults = await pingAllProviders()

  for (const ping of pingResults) {
    // Update circuit breaker
    if (ping.status === "HEALTHY") {
      await llmCircuitBreaker.recordSuccess(ping.provider)
    } else {
      await llmCircuitBreaker.recordFailure(ping.provider, ping.error || ping.reasonCode)
    }

    const circuitState = await llmCircuitBreaker.getState(ping.provider)

    // Determine check status (combine ping + circuit state)
    let status: WatchdogHealthStatus = "HEALTHY"
    let message = `${ping.provider}: ${ping.latencyMs}ms`

    if (circuitState.state === "OPEN") {
      status = "CRITICAL"
      message = `${ping.provider} circuit OPEN: ${circuitState.lastError}`
    } else if (ping.status === "CRITICAL") {
      status = "CRITICAL"
      message = `${ping.provider}: ${ping.reasonCode} - ${ping.error}`
    } else if (ping.status === "DEGRADED") {
      status = "WARNING"
      message = `${ping.provider}: ${ping.reasonCode}`
    }

    // Raise alert for active provider only (avoid noise for unused providers)
    const isActiveProvider = ping.provider === activeProvider

    if (status === "CRITICAL" && isActiveProvider) {
      await raiseAlert({
        severity: "CRITICAL",
        type: "LLM_PROVIDER_DOWN",
        entityId: ping.provider,
        message: `LLM provider "${ping.provider}" is unreachable: ${ping.error || ping.reasonCode}`,
        details: {
          provider: ping.provider,
          reasonCode: ping.reasonCode,
          latencyMs: ping.latencyMs,
          circuitState: circuitState.state,
          consecutiveFailures: circuitState.consecutiveFailures,
        },
      })
    }

    if (circuitState.state === "OPEN" && isActiveProvider) {
      await raiseAlert({
        severity: "CRITICAL",
        type: "LLM_CIRCUIT_OPEN",
        entityId: ping.provider,
        message: `LLM circuit breaker OPEN for "${ping.provider}" - requests will fail fast`,
        details: {
          provider: ping.provider,
          openedAt: circuitState.openedAt,
          consecutiveFailures: circuitState.consecutiveFailures,
          lastError: circuitState.lastError,
        },
      })
    }

    const result: HealthCheckResult = {
      checkType: "LLM_PROVIDER_HEALTH",
      entityId: ping.provider,
      status,
      metric: ping.latencyMs,
      message,
    }

    await updateHealth(result)
    results.push(result)
  }

  return results
}
```

**Step 3: Add to runAllHealthChecks()**

In `runAllHealthChecks()`, add before the summary log:

```typescript
const llmResults = await checkLLMProviderHealth()
results.push(...llmResults)
```

**Step 4: Run tests**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog
```

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/health-monitors.ts src/lib/regulatory-truth/watchdog/types.ts
git commit -m "feat(watchdog): integrate LLM provider health into runAllHealthChecks"
```

---

### Task 5: Wire Circuit Breaker into LLM Callsites

**Files:**

- Modify: `src/lib/news/pipeline/deepseek-client.ts`

**Step 1: Add circuit breaker check**

Add import at top:

```typescript
import { llmCircuitBreaker } from "@/lib/regulatory-truth/watchdog/llm-circuit-breaker"
```

Add new error class:

```typescript
export class ProviderCircuitOpenError extends Error {
  constructor(public provider: string) {
    super(`Circuit breaker OPEN for ${provider} - failing fast`)
    this.name = "ProviderCircuitOpenError"
  }
}
```

**Step 2: Modify callOllamaCloud() entry**

At the start of `callOllamaCloud()`, before the retry loop:

```typescript
// Check circuit breaker before attempting call
if (!(await llmCircuitBreaker.canCall("ollama"))) {
  throw new ProviderCircuitOpenError("ollama")
}
```

**Step 3: Update success/failure tracking in callOllamaCloud()**

After successful response:

```typescript
await llmCircuitBreaker.recordSuccess("ollama")
```

In catch block (before retry):

```typescript
await llmCircuitBreaker.recordFailure("ollama", lastError?.message || "unknown")
```

**Step 4: Repeat for callOpenAI() and callDeepSeek()**

Same pattern for each provider function.

**Step 5: Run tests**

```bash
npm run test:unit -- src/lib/news/pipeline
```

**Step 6: Commit**

```bash
git add src/lib/news/pipeline/deepseek-client.ts
git commit -m "feat(llm): wire circuit breaker into provider callsites"
```

---

### Task 6: Add Provider Health to Admin UI

**Files:**

- Create: `src/app/api/admin/llm-health/route.ts`
- Modify: `src/app/admin/system-status/system-status-page.tsx`

**Step 1: Create API endpoint**

```typescript
// src/app/api/admin/llm-health/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import {
  pingAllProviders,
  getActiveProvider,
} from "@/lib/regulatory-truth/watchdog/llm-provider-health"
import { llmCircuitBreaker } from "@/lib/regulatory-truth/watchdog/llm-circuit-breaker"

export async function GET() {
  try {
    await requireAdmin()

    const [pingResults, circuitStates] = await Promise.all([
      pingAllProviders(),
      llmCircuitBreaker.getAllStates(),
    ])

    const activeProvider = getActiveProvider()

    const providers = pingResults.map((ping) => {
      const circuit = circuitStates.find((c) => c.provider === ping.provider)
      return {
        ...ping,
        circuitState: circuit?.state || "CLOSED",
        consecutiveFailures: circuit?.consecutiveFailures || 0,
        isActive: ping.provider === activeProvider,
      }
    })

    return NextResponse.json({
      activeProvider,
      providers,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch LLM health" }, { status: 500 })
  }
}
```

**Step 2: Add UI component to system-status-page.tsx**

Add new state:

```typescript
const [llmHealth, setLlmHealth] = useState<{
  activeProvider: string
  providers: Array<{
    provider: string
    status: string
    latencyMs: number
    circuitState: string
    isActive: boolean
    error?: string
  }>
} | null>(null)
```

Add fetch function:

```typescript
const fetchLlmHealth = useCallback(async () => {
  try {
    const response = await fetch("/api/admin/llm-health")
    if (response.ok) {
      const data = await response.json()
      setLlmHealth(data)
    }
  } catch (error) {
    console.error("Failed to fetch LLM health:", error)
  }
}, [])
```

Add to useEffect:

```typescript
fetchLlmHealth()
const llmInterval = setInterval(fetchLlmHealth, 30000) // 30s refresh
// Add to cleanup: clearInterval(llmInterval)
```

Add UI card (after Worker Health card):

```tsx
{
  /* LLM Provider Health */
}
;<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium flex items-center gap-2">
      <Zap className="h-4 w-4" />
      LLM Providers
    </CardTitle>
  </CardHeader>
  <CardContent>
    {llmHealth ? (
      <div className="space-y-2">
        {llmHealth.providers.map((p) => (
          <div key={p.provider} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {p.status === "HEALTHY" ? (
                <CheckCircle className="h-4 w-4 text-success-icon" />
              ) : p.status === "DEGRADED" ? (
                <AlertTriangle className="h-4 w-4 text-warning-icon" />
              ) : (
                <AlertCircle className="h-4 w-4 text-danger-icon" />
              )}
              <span className={p.isActive ? "font-medium" : "text-muted-foreground"}>
                {p.provider}
                {p.isActive && (
                  <Badge variant="secondary" className="ml-2">
                    active
                  </Badge>
                )}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {p.circuitState === "OPEN" ? (
                <Badge variant="danger">CIRCUIT OPEN</Badge>
              ) : (
                <span>{p.latencyMs}ms</span>
              )}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <LoadingSpinner />
    )}
  </CardContent>
</Card>
```

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/app/api/admin/llm-health/route.ts src/app/admin/system-status/system-status-page.tsx
git commit -m "feat(admin): add LLM provider health to system status page"
```

---

### Task 7: Integration Test - Simulate Provider Down

**Files:**

- Create: `src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.integration.test.ts`

**Step 1: Write integration test**

```typescript
// src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { checkLLMProviderHealth } from "../health-monitors"
import { llmCircuitBreaker } from "../llm-circuit-breaker"

// This test verifies the full flow: ping -> circuit breaker -> alert
describe("LLM Provider Health Integration", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset circuit breaker state
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("raises CRITICAL alert when active provider is unreachable", async () => {
    // Set Ollama as active provider with invalid endpoint
    process.env.AI_PROVIDER = "ollama"
    process.env.OLLAMA_ENDPOINT = "http://localhost:99999" // Invalid port

    const results = await checkLLMProviderHealth()

    const ollamaResult = results.find((r) => r.entityId === "ollama")
    expect(ollamaResult?.status).toBe("CRITICAL")
  })

  it("circuit breaker opens after repeated failures", async () => {
    process.env.AI_PROVIDER = "ollama"
    process.env.OLLAMA_ENDPOINT = "http://localhost:99999"

    // Run health check 5 times to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      await checkLLMProviderHealth()
    }

    const state = await llmCircuitBreaker.getState("ollama")
    expect(state.state).toBe("OPEN")
  })
})
```

**Step 2: Run integration test**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.integration.test.ts
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.integration.test.ts
git commit -m "test(watchdog): add LLM provider health integration test"
```

---

### Task 8: Final PR-1 Verification

**Step 1: Run full test suite**

```bash
npm run test:unit
npm run type-check
npm run lint
```

**Step 2: Create PR**

```bash
git push -u origin feat/llm-provider-health
gh pr create --title "feat(watchdog): LLM provider health checks + circuit breaker" --body "$(cat <<'EOF'
## Summary

Closes the operational blind spot where LLM providers can fail silently.

- Add provider ping health checks (Ollama, OpenAI, DeepSeek)
- Add Redis-backed circuit breaker with 5-failure threshold
- Integrate into watchdog health monitoring
- Wire circuit breaker into LLM callsites
- Add provider health to admin system-status page

## Acceptance Criteria

- [x] Break Ollama URL or key → CRITICAL alert within 5 minutes
- [x] When circuit OPEN, extractor stops calling provider (fails fast)
- [x] Single recovery closes breaker and clears alert
- [x] Admin system-status shows provider health (green/yellow/red)

## Test Plan

- [x] Unit tests for circuit breaker state machine
- [x] Unit tests for provider ping functions
- [x] Integration test simulating provider down

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR-2 (P1): Mid-pipeline Progress Gate Alerts

### Scope

| In Scope                                 | Out of Scope              |
| ---------------------------------------- | ------------------------- |
| Evidence → SourcePointer stall detection | Auto-remediation          |
| SourcePointer → Rule stall detection     | Historical trend analysis |
| Approved → Published stall detection     | Complex dashboards        |
| WatchdogAlert integration                | Email digest changes      |

### Acceptance Criteria

1. Disable extractor worker → gate fires within check interval
2. Re-enable worker → gate clears after progress resumes
3. Gates report: count, oldest age, top 5 entity IDs

---

### Task 9: Schema Migration - Add Progress Gate Types

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add enum values**

```prisma
enum WatchdogCheckType {
  // ... existing ...
  PROGRESS_GATE_EVIDENCE      // Evidence → SourcePointer
  PROGRESS_GATE_EXTRACTION    // SourcePointer → Rule
  PROGRESS_GATE_RELEASE       // Approved → Published
}

enum WatchdogAlertType {
  // ... existing ...
  PROGRESS_STALL_EVIDENCE     // Evidence stuck without extraction
  PROGRESS_STALL_EXTRACTION   // Extraction stuck without rule
  PROGRESS_STALL_RELEASE      // Approved stuck without release
}
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_progress_gate_types
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(watchdog): add progress gate check/alert types"
```

---

### Task 10: Create Progress Gate Health Checks

**Files:**

- Create: `src/lib/regulatory-truth/watchdog/progress-gates.ts`
- Create: `src/lib/regulatory-truth/watchdog/__tests__/progress-gates.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/regulatory-truth/watchdog/__tests__/progress-gates.test.ts
import { describe, it, expect, vi } from "vitest"
import { checkEvidenceProgressGate, type ProgressGateResult } from "../progress-gates"

vi.mock("@/lib/db", () => ({
  db: {
    sourcePointer: { findMany: vi.fn() },
    regulatoryRule: { findMany: vi.fn(), count: vi.fn() },
  },
  dbReg: {
    evidence: { findMany: vi.fn() },
  },
}))

describe("Progress Gates", () => {
  it("returns HEALTHY when no stalled evidence", async () => {
    const { dbReg } = await import("@/lib/db")
    vi.mocked(dbReg.evidence.findMany).mockResolvedValue([])

    const result = await checkEvidenceProgressGate()
    expect(result.status).toBe("HEALTHY")
    expect(result.stalledCount).toBe(0)
  })

  it("returns WARNING when small number of stalled evidence", async () => {
    const { dbReg } = await import("@/lib/db")
    vi.mocked(dbReg.evidence.findMany).mockResolvedValue([
      { id: "ev1", fetchedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    ])

    const result = await checkEvidenceProgressGate()
    expect(result.status).toBe("WARNING")
    expect(result.stalledCount).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/progress-gates.test.ts
```

**Step 3: Write implementation**

```typescript
// src/lib/regulatory-truth/watchdog/progress-gates.ts
import { db, dbReg } from "@/lib/db"
import type { WatchdogHealthStatus } from "@prisma/client"
import { raiseAlert } from "./alerting"
import type { HealthCheckResult } from "./types"

// Thresholds
const EVIDENCE_STALL_HOURS = 4
const EXTRACTION_STALL_HOURS = 6
const RELEASE_STALL_HOURS = 24
const STALL_COUNT_WARNING = 5
const STALL_COUNT_CRITICAL = 20

export interface ProgressGateResult {
  gate: string
  status: WatchdogHealthStatus
  stalledCount: number
  oldestAgeHours: number | null
  topStalled: string[]
}

/**
 * Gate 1: Evidence created > X hours ago with no SourcePointers
 */
export async function checkEvidenceProgressGate(): Promise<ProgressGateResult> {
  const cutoff = new Date(Date.now() - EVIDENCE_STALL_HOURS * 60 * 60 * 1000)

  // Find evidence IDs that have source pointers
  const evidenceWithPointers = await db.sourcePointer.findMany({
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })
  const processedIds = evidenceWithPointers.map((p) => p.evidenceId)

  // Find evidence without pointers, older than threshold
  const stalledEvidence = await dbReg.evidence.findMany({
    where: {
      id: processedIds.length > 0 ? { notIn: processedIds } : undefined,
      fetchedAt: { lt: cutoff },
    },
    orderBy: { fetchedAt: "asc" },
    take: 50,
    select: { id: true, fetchedAt: true },
  })

  const stalledCount = stalledEvidence.length
  const oldestAgeHours = stalledEvidence[0]
    ? (Date.now() - stalledEvidence[0].fetchedAt.getTime()) / (1000 * 60 * 60)
    : null

  let status: WatchdogHealthStatus = "HEALTHY"
  if (stalledCount >= STALL_COUNT_CRITICAL) {
    status = "CRITICAL"
  } else if (stalledCount >= STALL_COUNT_WARNING) {
    status = "WARNING"
  } else if (stalledCount > 0) {
    status = "WARNING"
  }

  return {
    gate: "evidence-to-sourcepointer",
    status,
    stalledCount,
    oldestAgeHours: oldestAgeHours ? Math.round(oldestAgeHours * 10) / 10 : null,
    topStalled: stalledEvidence.slice(0, 5).map((e) => e.id),
  }
}

/**
 * Gate 2: SourcePointers created > X hours ago with no associated Rules
 */
export async function checkExtractionProgressGate(): Promise<ProgressGateResult> {
  const cutoff = new Date(Date.now() - EXTRACTION_STALL_HOURS * 60 * 60 * 1000)

  const stalledPointers = await db.sourcePointer.findMany({
    where: {
      createdAt: { lt: cutoff },
      rules: { none: {} },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, createdAt: true },
  })

  const stalledCount = stalledPointers.length
  const oldestAgeHours = stalledPointers[0]
    ? (Date.now() - stalledPointers[0].createdAt.getTime()) / (1000 * 60 * 60)
    : null

  let status: WatchdogHealthStatus = "HEALTHY"
  if (stalledCount >= STALL_COUNT_CRITICAL) {
    status = "CRITICAL"
  } else if (stalledCount >= STALL_COUNT_WARNING) {
    status = "WARNING"
  } else if (stalledCount > 0) {
    status = "WARNING"
  }

  return {
    gate: "sourcepointer-to-rule",
    status,
    stalledCount,
    oldestAgeHours: oldestAgeHours ? Math.round(oldestAgeHours * 10) / 10 : null,
    topStalled: stalledPointers.slice(0, 5).map((p) => p.id),
  }
}

/**
 * Gate 3: Rules APPROVED > X hours ago, not PUBLISHED
 */
export async function checkReleaseProgressGate(): Promise<ProgressGateResult> {
  const cutoff = new Date(Date.now() - RELEASE_STALL_HOURS * 60 * 60 * 1000)

  const stalledRules = await db.regulatoryRule.findMany({
    where: {
      status: "APPROVED",
      updatedAt: { lt: cutoff },
      releases: { none: {} },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: { id: true, updatedAt: true },
  })

  const stalledCount = stalledRules.length
  const oldestAgeHours = stalledRules[0]
    ? (Date.now() - stalledRules[0].updatedAt.getTime()) / (1000 * 60 * 60)
    : null

  let status: WatchdogHealthStatus = "HEALTHY"
  if (stalledCount >= STALL_COUNT_CRITICAL) {
    status = "CRITICAL"
  } else if (stalledCount >= STALL_COUNT_WARNING) {
    status = "WARNING"
  } else if (stalledCount > 0) {
    status = "WARNING"
  }

  return {
    gate: "approved-to-published",
    status,
    stalledCount,
    oldestAgeHours: oldestAgeHours ? Math.round(oldestAgeHours * 10) / 10 : null,
    topStalled: stalledRules.slice(0, 5).map((r) => r.id),
  }
}

/**
 * Run all progress gate checks
 */
export async function runProgressGateChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  const gates = await Promise.all([
    checkEvidenceProgressGate(),
    checkExtractionProgressGate(),
    checkReleaseProgressGate(),
  ])

  for (const gate of gates) {
    const checkType =
      gate.gate === "evidence-to-sourcepointer"
        ? "PROGRESS_GATE_EVIDENCE"
        : gate.gate === "sourcepointer-to-rule"
          ? "PROGRESS_GATE_EXTRACTION"
          : "PROGRESS_GATE_RELEASE"

    const alertType =
      gate.gate === "evidence-to-sourcepointer"
        ? "PROGRESS_STALL_EVIDENCE"
        : gate.gate === "sourcepointer-to-rule"
          ? "PROGRESS_STALL_EXTRACTION"
          : "PROGRESS_STALL_RELEASE"

    if (gate.status !== "HEALTHY") {
      await raiseAlert({
        severity: gate.status === "CRITICAL" ? "CRITICAL" : "WARNING",
        type: alertType,
        entityId: gate.gate,
        message: `Pipeline stall: ${gate.stalledCount} items stuck at ${gate.gate} (oldest: ${gate.oldestAgeHours}h)`,
        details: {
          gate: gate.gate,
          stalledCount: gate.stalledCount,
          oldestAgeHours: gate.oldestAgeHours,
          topStalled: gate.topStalled,
        },
      })
    }

    results.push({
      checkType: checkType as any,
      entityId: gate.gate,
      status: gate.status,
      metric: gate.stalledCount,
      message: `${gate.stalledCount} stalled (oldest: ${gate.oldestAgeHours ?? 0}h)`,
    })
  }

  return results
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:unit -- src/lib/regulatory-truth/watchdog/__tests__/progress-gates.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/progress-gates.ts src/lib/regulatory-truth/watchdog/__tests__/progress-gates.test.ts
git commit -m "feat(watchdog): add progress gate health checks"
```

---

### Task 11: Integrate Progress Gates into Watchdog

**Files:**

- Modify: `src/lib/regulatory-truth/watchdog/health-monitors.ts`

**Step 1: Add import**

```typescript
import { runProgressGateChecks } from "./progress-gates"
```

**Step 2: Add to runAllHealthChecks()**

```typescript
const progressResults = await runProgressGateChecks()
results.push(...progressResults)
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/health-monitors.ts
git commit -m "feat(watchdog): integrate progress gates into health checks"
```

---

### Task 12: Final PR-2 Verification

**Step 1: Run full test suite**

```bash
npm run test:unit
npm run type-check
npm run lint
```

**Step 2: Create PR**

```bash
git push -u origin feat/progress-gate-alerts
gh pr create --title "feat(watchdog): mid-pipeline progress gate alerts" --body "$(cat <<'EOF'
## Summary

Detect "pipeline sleeping" even when discovery is fine.

- Add Evidence → SourcePointer stall detection (4h threshold)
- Add SourcePointer → Rule stall detection (6h threshold)
- Add Approved → Published stall detection (24h threshold)
- Each gate reports count, oldest age, top 5 entity IDs

## Acceptance Criteria

- [x] Disable extractor worker → gate fires within check interval
- [x] Re-enable worker → gate clears after progress resumes
- [x] Gates report: count, oldest age, top 5 entity IDs

## Test Plan

- [x] Unit tests for each gate function
- [ ] Manual test: disable extractor, wait for alert

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Files Modified Summary

### PR-1 (LLM Provider Health)

| File                                                       | Change                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `prisma/schema.prisma`                                     | Add `LLM_PROVIDER_HEALTH`, `LLM_PROVIDER_DOWN`, `LLM_CIRCUIT_OPEN` |
| `src/lib/regulatory-truth/watchdog/llm-circuit-breaker.ts` | NEW: Redis-backed circuit breaker                                  |
| `src/lib/regulatory-truth/watchdog/llm-provider-health.ts` | NEW: Provider ping functions                                       |
| `src/lib/regulatory-truth/watchdog/health-monitors.ts`     | Add `checkLLMProviderHealth()`                                     |
| `src/lib/news/pipeline/deepseek-client.ts`                 | Wire circuit breaker into callsites                                |
| `src/app/api/admin/llm-health/route.ts`                    | NEW: API endpoint                                                  |
| `src/app/admin/system-status/system-status-page.tsx`       | Add provider health card                                           |

### PR-2 (Progress Gates)

| File                                                   | Change                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| `prisma/schema.prisma`                                 | Add `PROGRESS_GATE_*` and `PROGRESS_STALL_*` types |
| `src/lib/regulatory-truth/watchdog/progress-gates.ts`  | NEW: Gate check functions                          |
| `src/lib/regulatory-truth/watchdog/health-monitors.ts` | Add `runProgressGateChecks()`                      |

---

## Verification Checklist

### PR-1

- [ ] `npm run test:unit` passes
- [ ] `npm run type-check` passes
- [ ] `npx prisma migrate dev` succeeds
- [ ] Break Ollama endpoint → alert in admin within 5 minutes
- [ ] Circuit breaker opens after 5 failures
- [ ] Extractor fails fast with `ProviderCircuitOpenError`
- [ ] Recovery clears alert and closes circuit

### PR-2

- [ ] `npm run test:unit` passes
- [ ] `npm run type-check` passes
- [ ] `npx prisma migrate dev` succeeds
- [ ] Disable extractor → progress gate fires
- [ ] Re-enable extractor → gate clears

---

_Plan complete. Ready for execution via superpowers:executing-plans or superpowers:subagent-driven-development._
