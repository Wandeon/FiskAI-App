# Integrations

[← Back to Index](./00-INDEX.md)

---

> **Last Audit:** 2026-01-14 | **Auditor:** Claude Sonnet 4.5
> **Version:** 3.1.0
>
> Reality-audited against codebase. Comprehensive update covering all integrations including newly documented ePoslovanje inbound worker, Ollama AI configuration, GoCardless bank sync, and GitHub automation.

---

## 12. Integration Ecosystem

### 12.1 External Systems

| System               | Purpose                       | Status        | Location                                                       | Notes                                   |
| -------------------- | ----------------------------- | ------------- | -------------------------------------------------------------- | --------------------------------------- |
| FINA CIS             | Fiscalization (JIR/ZKI)       | ⚠️ 80%        | `/src/lib/fiscal/porezna-client.ts`                            | SOAP integration complete, pending cert |
| IE-Racuni            | E-invoice intermediary        | ⚠️ Planned    | `/src/lib/e-invoice/providers/ie-racuni.ts`                    | API stub ready                          |
| GoCardless           | PSD2 bank sync                | ✅ Production | `/src/lib/bank-sync/providers/gocardless.ts`                   | Primary bank provider                   |
| SaltEdge             | PSD2 bank sync                | ⚠️ Planned    | -                                                              | Secondary provider (not started)        |
| Stripe               | Payments + Terminal + Billing | ✅ Production | `/src/lib/billing/stripe.ts`, `/src/lib/stripe/terminal.ts`    | Subscriptions + POS                     |
| Resend               | Transactional email           | ✅ Production | `/src/lib/email.ts`                                            | All email flows + webhook tracking      |
| Cloudflare R2        | Document storage              | ✅ Production | `/src/lib/r2-client.ts`                                        | 11-year archive                         |
| Cloudflare CDN       | Cache + Purge                 | ✅ Production | `/src/lib/cache/purge.ts`, `/src/app/api/cache/purge/route.ts` | Tag-based invalidation                  |
| Cloudflare Turnstile | Bot protection                | ✅ Production | `/src/lib/turnstile.ts`                                        | Form protection                         |
| PostHog              | Analytics + Web Vitals        | ✅ Production | `/src/lib/analytics.ts`, `/src/lib/web-vitals.ts`              | EU-hosted                               |
| Sentry               | Error tracking                | ✅ Production | `/instrumentation.ts`, `/src/app/global-error.tsx`             | Performance + errors                    |
| Slack                | Alerts                        | ✅ Production | `/src/lib/regulatory-truth/watchdog/slack.ts`                  | Sentinel/Watchdog alerts                |
| DeepSeek             | AI (backup)                   | ✅ Production | `/src/lib/ai/deepseek.ts`                                      | Cost-effective fallback                 |
| HNB API              | Exchange rates                | ✅ Production | `/src/lib/regulatory-truth/fetchers/hnb-fetcher.ts`            | Daily EUR rates                         |
| Narodne novine       | Legal gazette                 | ✅ Production | `/src/lib/regulatory-truth/fetchers/nn-fetcher.ts`             | Regulatory monitoring                   |
| EUR-Lex              | EU legislation                | ✅ Production | `/src/lib/regulatory-truth/fetchers/eurlex-fetcher.ts`         | VAT directives                          |
| VIES                 | EU VAT validation             | ✅ Production | `/src/lib/oib-lookup.ts`                                       | VAT number check                        |
| Sudski Registar      | Company registry              | ✅ Production | `/src/lib/oib-lookup.ts`                                       | OIB lookup                              |
| Pino                 | Structured logging            | ✅ Production | `/src/lib/logger.ts`                                           | JSON logs                               |

### 12.2 E-Invoice Providers

| Provider       | Type         | Status         | Location                                               | Notes                             |
| -------------- | ------------ | -------------- | ------------------------------------------------------ | --------------------------------- |
| ePoslovanje v2 | Intermediary | ✅ Production  | `/src/lib/e-invoice/providers/eposlovanje-einvoice.ts` | Primary e-invoice provider        |
| Mock           | Testing      | ✅ Full        | `/src/lib/e-invoice/providers/mock.ts`                 | Development only                  |
| Mock Fiscal    | Testing      | ✅ Full        | `/src/lib/e-invoice/providers/mock-fiscal.ts`          | Fiscalization testing             |
| IE-Racuni      | Intermediary | 📋 Stub        | `/src/lib/e-invoice/providers/ie-racuni.ts`            | API stub ready, needs credentials |
| FINA Direct    | Direct       | ⚠️ 80%         | `/src/lib/fiscal/porezna-client.ts`                    | Requires certificate              |
| Moj-eRacun     | Intermediary | ❌ Not started | -                                                      | Low priority                      |

#### ePoslovanje Integration Details

**Location:** `/src/lib/e-invoice/providers/eposlovanje-einvoice.ts`

**API Version:** v2 (v1 end-of-support 2026-01-01)

**Environment Variables:**

- `EPOSLOVANJE_API_BASE` - Base URL without path (required)
  - TEST: `https://test.eposlovanje.hr`
  - PROD: `https://eracun.eposlovanje.hr`
- `EPOSLOVANJE_API_KEY` - API key for Authorization header (required)
- `EPOSLOVANJE_TIMEOUT_MS` - Request timeout in milliseconds (optional, default: 15000)

**Key Features:**

- Idempotency via content hash and custom header (`X-Idempotency-Key`)
- Automatic retry with exponential backoff for transient failures
- Comprehensive error mapping (auth, validation, rate limit, temporary failures)
- Circuit breaker integration for provider health monitoring
- Structured logging with security-safe truncation

**API Endpoints:**

- `GET /api/v2/ping` - Connection test
- `POST /api/v2/document/send` - Send outbound invoice (UBL XML)
- `GET /api/v2/document/incoming` - Fetch incoming invoices
- `GET /api/v2/document/{id}/status` - Check invoice status
- `POST /api/v2/document/{id}/archive` - Archive invoice

**Status Mapping:**

- 200/201/202 → `QUEUED`
- 400 → `PROVIDER_REJECTED` (validation errors, inactive account)
- 401/403 → `PROVIDER_AUTH_FAILED`
- 409 → `QUEUED` (idempotent duplicate)
- 429 → `PROVIDER_RATE_LIMIT` (retryable)
- 500/502/503/504 → `PROVIDER_TEMPORARY_FAILURE` (retryable)

#### Inbound Invoice Worker

**Location:** `/src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts`

**Purpose:** Continuously polls ePoslování for incoming B2B invoices

**Configuration:**

- `COMPANY_ID` - Company to poll for (required)
- `POLL_INTERVAL_MS` - Polling frequency (default: 300000 = 5 minutes)
- `MAX_WINDOW_DAYS` - Maximum lookback window on first run (default: 7 days)
- `USE_INTEGRATION_ACCOUNT_INBOUND` - Use IntegrationAccount credentials instead of env vars (default: false)

**Dual-Path Architecture:**

- **V1 Path (Legacy):** Uses `EPOSLOVANJE_API_BASE` + `EPOSLOVANJE_API_KEY` from environment
- **V2 Path (IntegrationAccount):** Uses encrypted credentials from database when `USE_INTEGRATION_ACCOUNT_INBOUND=true`

**Features:**

- Tenant-safe: polls for specific company only
- Graceful shutdown with max 30s wait for current poll
- Comprehensive metrics tracking (fetched, inserted, skipped, errors)
- Automatic deduplication of incoming invoices
- UBL XML parsing and storage

### 12.3 Bank Sync Integration (GoCardless)

**Location:** `/src/lib/bank-sync/providers/gocardless.ts`

**Status:** ✅ Production

**Purpose:** PSD2 bank synchronization for automated transaction fetching

#### Environment Variables

- `GOCARDLESS_SECRET_ID` - Secret ID from GoCardless dashboard (required)
- `GOCARDLESS_SECRET_KEY` - Secret key from GoCardless dashboard (required)
- `GOCARDLESS_BASE_URL` - API base URL (default: `https://bankaccountdata.gocardless.com/api/v2`)

#### Supported Croatian Banks

| Bank                     | Institution ID              |
| ------------------------ | --------------------------- |
| Zagrebačka Banka         | `ZAGREBACKA_BANKA_ZABAHR2X` |
| Privredna Banka Zagreb   | `PBZ_PBZGHR2X`              |
| Erste Bank               | `ERSTE_BANK_GIBAHR2X`       |
| Raiffeisenbank Austria   | `RBA_RZBHHR2X`              |
| OTP Banka                | `OTP_BANKA_OTPVHR2X`        |
| Addiko Bank              | `ADDIKO_BANK_HAABHR22`      |
| Hrvatska Poštanska Banka | `HPB_HABORHR2X`             |

#### Key Features

**Token Management:**

- Automatic token refresh with 60s safety buffer
- Promise deduplication to prevent concurrent refresh race conditions
- In-memory caching of access tokens

**Connection Flow:**

1. Create requisition (connection request) via `createConnection()`
2. User redirected to bank for authentication
3. Handle callback with `handleCallback()` to get account details
4. 90-day consent period

**Transaction Fetching:**

- Incremental sync from specified date
- Automatic deduplication via `externalId`
- Counterparty information (name, IBAN)
- Payment reference extraction

**API Methods:**

```typescript
// Get institution ID for bank name
const institutionId = await gocardlessProvider.getInstitutionId("Zagrebačka Banka")

// Create connection request
const { connectionId, redirectUrl } = await gocardlessProvider.createConnection(
  institutionId,
  "https://app.fiskai.hr/banking/callback",
  "user-reference"
)

// Handle callback after user auth
const { accounts, expiresAt } = await gocardlessProvider.handleCallback(connectionId)

// Fetch transactions since date
const transactions = await gocardlessProvider.fetchTransactions(
  providerAccountId,
  new Date("2025-01-01")
)

// Fetch current balance
const balance = await gocardlessProvider.fetchBalance(providerAccountId)

// Check if connection is still valid
const valid = await gocardlessProvider.isConnectionValid(connectionId)
```

**Transaction Structure:**

```typescript
interface ProviderTransaction {
  externalId: string // Unique transaction ID
  date: Date // Booking date
  amount: number // Positive for credit, negative for debit
  description: string // Transaction description
  reference?: string // Payment reference
  counterpartyName?: string // Other party name
  counterpartyIban?: string // Other party IBAN
}
```

### 12.4 Bank Import Formats

| Format         | Extension | Status | Notes                  |
| -------------- | --------- | ------ | ---------------------- |
| CSV (generic)  | .csv      | ✅     | Manual column mapping  |
| CAMT.053       | .xml      | ✅     | ISO 20022 standard     |
| Erste CSV      | .csv      | ✅     | Pre-configured mapping |
| Raiffeisen CSV | .csv      | ✅     | Pre-configured mapping |
| PBZ Export     | .csv      | ⚠️ WIP | Parser in development  |
| MT940          | .sta      | ❌     | Not yet implemented    |

### 12.5 Stripe Integration

**Location:** `/src/lib/billing/stripe.ts`, `/src/lib/stripe/terminal.ts`

#### Subscription Billing

```typescript
// Plans configuration
const PLANS = {
  pausalni: { priceEur: 39, invoiceLimit: 50, userLimit: 1 },
  standard: { priceEur: 99, invoiceLimit: 200, userLimit: 5 },
  pro: { priceEur: 199, invoiceLimit: -1, userLimit: -1 }, // unlimited
}

// Key functions
createStripeCustomer(companyId, email, name)
createCheckoutSession(companyId, planId, successUrl, cancelUrl)
createPortalSession(companyId, returnUrl)
handleStripeWebhook(body, signature)
canCreateInvoice(companyId) // Enforces limits
getUsageStats(companyId)
```

#### Stripe Terminal (POS)

```typescript
// Terminal functions
createConnectionToken(companyId)
createTerminalPaymentIntent({ amount, companyId, invoiceRef })
processPaymentOnReader({ readerId, paymentIntentId })
cancelReaderPayment(readerId)
getReaderStatus(readerId)
```

**Webhook Endpoint:** `POST /api/billing/webhook`

**Events handled:**

- `checkout.session.completed` - Activate subscription
- `customer.subscription.updated` - Sync status
- `customer.subscription.deleted` - Downgrade
- `invoice.payment_failed` - Alert (TODO: email)

### 12.6 Resend Email Integration

**Location:** `/src/lib/email.ts`, `/src/lib/email/templates/`

#### Email Templates

| Template         | Purpose            | File                         |
| ---------------- | ------------------ | ---------------------------- |
| Invoice Email    | Invoice delivery   | `invoice-email.tsx`          |
| Welcome Email    | User onboarding    | `welcome-email.tsx`          |
| Password Reset   | Auth flow          | `password-reset-email.tsx`   |
| OTP Code         | 2FA verification   | `otp-code-email.tsx`         |
| Verification     | Email verification | `verification-email.tsx`     |
| Checklist Digest | Weekly digest      | `checklist-digest-email.tsx` |

#### Usage

```typescript
import { sendEmail } from "@/lib/email"

await sendEmail({
  to: "user@example.com",
  subject: "Your Invoice",
  react: <InvoiceEmail invoice={invoice} />,
  attachments: [{ filename: "invoice.pdf", content: pdfBuffer }],
})
```

**Webhook Endpoint:** `POST /api/webhooks/resend`

**Events tracked:**

- `email.delivered` - Delivery confirmation
- `email.opened` - Open tracking
- `email.clicked` - Link click tracking
- `email.bounced` - Bounce handling
- `email.complained` - Spam complaints

### 12.7 Cloudflare Integration

#### R2 Document Storage

**Location:** `/src/lib/r2-client.ts`

```typescript
uploadToR2(key, data, contentType)
downloadFromR2(key)
deleteFromR2(key)
generateR2Key(companyId, contentHash, filename)
```

**Key format:** `attachments/{companyId}/{year}/{month}/{contentHash}.{ext}`

#### CDN Cache Management

**Location:** `/src/lib/cache/purge.ts`, `/src/lib/cache-headers.ts`

```typescript
// Cache tags
const CACHE_TAGS = {
  KB_GUIDES: "kb_guides",
  KB_GLOSSARY: "kb_glossary",
  KB_FAQ: "kb_faq",
  KB_HOWTO: "kb_howto",
  KB_COMPARISONS: "kb_comparisons",
  KB_NEWS: "kb_news",
  MARKETING: "marketing",
  KB_ALL: "kb_all",
}

// Purge by tags
await purgeContentCache(["kb_guides"])

// Purge by URLs
await purgeByUrls(["/vodic/pausalni-obrt"])
```

**Cache Policy:**

- Marketing pages: `s-maxage=3600, stale-while-revalidate=86400`
- Authenticated routes: Never cached
- API routes: Never cached

#### Turnstile Bot Protection

**Location:** `/src/lib/turnstile.ts`

```typescript
const isValid = await verifyTurnstileToken(token, clientIp)
const clientIp = getClientIp(request.headers)
```

### 12.8 Sentry Error Tracking

**Location:** `/instrumentation.ts`

**Configuration:**

- DSN: `SENTRY_DSN` environment variable
- Sample rate: 10% production, 100% development
- Edge runtime: 5% sample rate
- Filters sensitive headers (auth, cookies)
- Ignores network errors, browser extensions

**Ignored errors:**

- `Failed to fetch` (network)
- `NetworkError`
- `ResizeObserver loop` (browser)
- `NEXT_REDIRECT` (expected)

### 12.9 PostHog Analytics

**Location:** `/src/lib/analytics.ts`, `/src/lib/web-vitals.ts`

#### Configuration

```typescript
posthog.init(POSTHOG_KEY, {
  api_host: "https://eu.i.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: false, // Manual for SPA
  autocapture: false, // GDPR compliance
})
```

#### Web Vitals Tracking

Automatically reports to PostHog:

- **CLS** (Cumulative Layout Shift)
- **LCP** (Largest Contentful Paint)
- **INP** (Interaction to Next Paint)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)

#### Predefined Events

```typescript
const AnalyticsEvents = {
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",
  INVOICE_CREATED: "invoice_created",
  INVOICE_SENT: "invoice_sent",
  INVOICE_FISCALIZED: "invoice_fiscalized",
  // ... more
}
```

### 12.10 Slack Alerting

**Location:** `/src/lib/regulatory-truth/watchdog/slack.ts`

#### Alert Types

```typescript
// Critical alerts
await sendCriticalAlert(type, message, details)

// Audit results
await sendAuditResult(auditReport)

// Content change alerts (Sentinel)
await sendContentAlert({
  conceptId: "pausalni-limit",
  affectedGuides: ["pausalni-obrt"],
  changesDetected: 3,
  severity: "major",
  summary: "Revenue limit changed from 39,816 to 40,000 EUR",
})
```

**Environment variables:**

- `SLACK_WEBHOOK_URL` - Incoming webhook URL
- `SLACK_CHANNEL` - Target channel (default: `#fiskai-alerts`)

### 12.11 Regulatory Truth Layer (Sentinel)

**Location:** `/src/lib/regulatory-truth/`

#### Tier 1 Structured Fetchers (Bypass AI)

| Source         | Fetcher             | Data                     |
| -------------- | ------------------- | ------------------------ |
| HNB            | `hnb-fetcher.ts`    | Daily EUR exchange rates |
| Narodne novine | `nn-fetcher.ts`     | Legal gazette articles   |
| EUR-Lex        | `eurlex-fetcher.ts` | EU legislation metadata  |

```typescript
// Run all Tier 1 fetchers
const result = await runTier1Fetchers()
// Returns: { hnb: { ratesCreated }, nn: { evidenceCreated }, eurlex: { evidenceCreated } }

// Check availability
const status = await getTier1Status()
// Returns: { hnb: { available, lastRate }, nn: { available, latestIssue }, eurlex: { available } }
```

### 12.12 GitHub Integration

**Location:** `/src/lib/fiscal-data/validator/create-pr.ts`, `/src/lib/regulatory-truth/content-sync/`

**Status:** ✅ Production

**Purpose:** Automated pull request creation for data updates and content synchronization

#### Environment Variables

- `GITHUB_TOKEN` - GitHub API token with repo permissions (required)
- `GITHUB_REPO` - Repository in format `owner/repo` (e.g., `your-org/FiskAI`)
- `GITHUB_API` - GitHub API base URL (default: `https://api.github.com`)

#### Use Cases

**1. Fiscal Data Validation PRs**

**Location:** `/src/lib/fiscal-data/validator/create-pr.ts`

Automatically creates PRs when fiscal data validation detects changes in official sources:

```typescript
// Create PR with fiscal data updates
const prUrl = await createUpdatePR(changes)

// Create issue for validation report
const issueUrl = await createValidationIssue(changes, summary)
```

**Features:**

- Automated branch creation: `fiscal-update-[timestamp]`
- Structured commit messages with change summary
- Detailed PR body with:
  - Change table (current vs. new values)
  - Confidence scores
  - Source URLs
  - Extracted text context
- Updates `lastVerified` dates in fiscal data files
- Automatic return to main branch after PR creation

**2. Content Sync PRs**

**Location:** `/src/lib/regulatory-truth/workers/content-sync.worker.ts`

Automatically creates PRs when regulatory rules change:

```typescript
// Create PR for MDX content updates
const prUrl = await gitAdapter.createPR({
  title: "Update pausalni-limit in content files",
  body: generatePRBody(changes),
  baseBranch: "main",
})
```

**Features:**

- Automated branch creation: `content-sync/[conceptId]-[timestamp]`
- Frontmatter updates with changelog entries
- Multi-file commits when concept affects multiple guides
- Structured PR body with regulatory context

#### API Usage

```typescript
// Create pull request
const response = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/pulls`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  },
  body: JSON.stringify({
    title: "PR Title",
    body: "PR Description",
    head: "feature-branch",
    base: "main",
  }),
})

// Create issue
const response = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/issues`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Issue Title",
    body: "Issue Description",
    labels: ["automated", "fiscal-data"],
  }),
})
```

#### Security Considerations

- Token must have `repo` scope for private repositories
- Token stored as environment variable (never in code)
- All API calls use HTTPS
- Token never logged or exposed in error messages

### 12.13 RTL Content Sync

**Location:** `/src/lib/regulatory-truth/content-sync/`, `/src/lib/regulatory-truth/workers/content-sync.worker.ts`

Automatically synchronizes regulatory rule changes from the Regulatory Truth Layer to MDX content files via automated pull requests (see GitHub Integration above).

#### Architecture

| Component            | Purpose                            | Location                                |
| -------------------- | ---------------------------------- | --------------------------------------- |
| Content Sync Worker  | BullMQ worker for sync jobs        | `workers/content-sync.worker.ts`        |
| Concept Registry     | Maps RTL concepts to content files | `content-sync/concept-registry.ts`      |
| Frontmatter Patcher  | Updates MDX frontmatter            | `content-sync/frontmatter-patcher.ts`   |
| Git Adapter          | Branch/commit/PR creation          | `content-sync/GitContentRepoAdapter.ts` |
| Releaser Integration | Event emission on rule publication | `agents/releaser/events.ts`             |

#### Workflow

1. **Trigger:** Releaser agent publishes a regulatory rule change
2. **Event Creation:** `ContentSyncEvent` record created in database with status `PENDING`
3. **Worker Claim:** Content sync worker atomically claims event (UPDATE WHERE status='PENDING')
4. **Concept Mapping:** Looks up which MDX files are affected by the concept
5. **Frontmatter Patch:** Updates MDX frontmatter with changelog entry
6. **Git Operations:**
   - Creates branch: `content-sync/[conceptId]-[timestamp]`
   - Commits changes with structured message
   - Pushes to remote repository
   - Creates GitHub PR with detailed change summary
7. **Status Update:** Marks event as `DONE` on success

#### Configuration

**Environment Variables:**

- `REPO_ROOT` - Repository root directory (default: current working directory)
- `CONTENT_DIR` - Content directory path (default: `content`, relative to REPO_ROOT)
- `GITHUB_TOKEN` - GitHub API token for creating PRs (required)
- `GITHUB_REPO` - Repository in format `owner/repo` (e.g., `your-org/FiskAI`)

**BullMQ Job Options:**

- 8 retry attempts with exponential backoff
- Initial delay: 30s
- Maximum delay: ~30 minutes

#### Concept Registry Example

```typescript
// Maps regulatory concepts to MDX content files
const registry = {
  "pausalni-limit": ["vodici/pausalni-obrt.mdx"],
  "pdv-threshold": ["vodici/pdv-obveznik.mdx", "usporedbe/pausalni-vs-doo.mdx"],
  "contribution-rates": ["vodici/doprinosi.mdx", "kalkulatori/doprinosi.mdx"],
}

// Worker processes sync jobs on rule release
await contentSyncQueue.add("sync", { ruleId, conceptId, changes })
```

#### Error Handling

**Permanent Errors (immediate dead-letter):**

- `UnmappedConceptError` - Concept not found in registry
- `PatchConflictError` - Conflicting frontmatter structure
- Invalid repository configuration

**Transient Errors (retry with backoff):**

- Git operations (network, permissions)
- GitHub API rate limits
- Database connection issues

#### Database Schema

```typescript
interface ContentSyncEvent {
  id: string
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "DEAD_LETTER"
  ruleId: string
  conceptId: string
  changes: Record<string, unknown>
  createdAt: Date
  processingStartedAt?: Date
  completedAt?: Date
  errorMessage?: string
  deadLetterReason?: DeadLetterReason
}
```

### 12.14 AI Providers (Ollama)

**Location:** `/src/lib/ai/`

FiskAI uses Ollama exclusively for all AI operations, supporting both local instances and Ollama Cloud.

#### Configuration Architecture

**Split Configuration Model:**

- **Extraction:** `OLLAMA_EXTRACT_*` - Ollama Cloud with larger models for regulatory fact extraction
- **Embeddings:** `OLLAMA_EMBED_*` - Local Ollama for fast vector generation
- **Legacy/Fallback:** `OLLAMA_*` - Used when specific configs not set

#### Environment Variables

**Extraction (Regulatory Truth Layer):**

- `OLLAMA_EXTRACT_ENDPOINT` - API endpoint (e.g., `https://api.ollama.ai`)
- `OLLAMA_EXTRACT_MODEL` - Model for text extraction (e.g., `gemma-3-27b`)
- `OLLAMA_EXTRACT_API_KEY` - API key for authentication

**Embeddings (Vector Generation):**

- `OLLAMA_EMBED_ENDPOINT` - API endpoint (e.g., `http://100.89.2.111:11434` for local via Tailscale)
- `OLLAMA_EMBED_MODEL` - Embedding model (default: `nomic-embed-text`)
- `OLLAMA_EMBED_API_KEY` - API key (use `local` for local instances)
- `OLLAMA_EMBED_DIMS` - Embedding dimensions (default: 768)

**General/Fallback:**

- `OLLAMA_ENDPOINT` - Default API endpoint (default: `http://localhost:11434`)
- `OLLAMA_API_KEY` - Default API key for authentication
- `OLLAMA_MODEL` - Default text model (default: `llama3.2`)
- `OLLAMA_VISION_MODEL` - Vision/OCR model (default: `llava`)

**Priority Resolution:**

- Extraction uses: `OLLAMA_EXTRACT_*` → `OLLAMA_*` → defaults
- Embeddings use: `OLLAMA_EMBED_*` → defaults (never falls back to EXTRACT)

#### Core Functions

**Location:** `/src/lib/ai/ollama-client.ts`

```typescript
// Simple chat completion
const response = await chat(prompt, {
  systemPrompt: "You are a helpful assistant",
  temperature: 0.7,
  maxTokens: 4000,
  jsonMode: false,
  model: "llama3.2",
  companyId: "...", // For usage tracking
  operation: "ollama_chat",
})

// Chat with JSON response
const data = await chatJSON<ExpenseData>(prompt, {
  systemPrompt: "Extract invoice data",
  temperature: 0.3,
  model: "gemma-3-27b",
})

// Vision/OCR for images
const text = await vision(imageBase64, "Extract text from this receipt", {
  temperature: 0.3,
  jsonMode: false,
})

// Vision with JSON response
const parsed = await visionJSON<ReceiptData>(imageBase64, "Parse receipt")

// Check availability
const available = await isAvailable()
```

#### Features

- **Circuit Breaker:** Automatic failfast when provider is unhealthy
- **Retry Logic:** Exponential backoff with configurable attempts (default: 3)
- **Usage Tracking:** Automatic token counting and cost tracking per company
- **Error Handling:** Typed errors (`OllamaError`, `CircuitOpenError`)
- **Timeout Protection:** Configurable timeouts with abort controller
- **Security:** API keys never exposed to client (server-side only)

#### Use Cases

| Use Case                    | Model Type | Config Vars            | Location                                                      |
| --------------------------- | ---------- | ---------------------- | ------------------------------------------------------------- |
| Receipt OCR                 | Vision     | `OLLAMA_VISION_MODEL`  | `/src/lib/ai/ocr.ts`                                          |
| Expense categorization      | Text       | `OLLAMA_MODEL`         | `/src/lib/ai/categorize.ts`                                   |
| Invoice data extraction     | Text       | `OLLAMA_MODEL`         | `/src/lib/ai/extract.ts`                                      |
| Regulatory fact extraction  | Text       | `OLLAMA_EXTRACT_MODEL` | `/src/lib/regulatory-truth/agents/ollama-config.ts`           |
| Document embeddings         | Embedding  | `OLLAMA_EMBED_MODEL`   | `/src/lib/article-agent/verification/embedder.ts`             |
| Semantic concept matching   | Embedding  | `OLLAMA_EMBED_MODEL`   | `/src/lib/assistant/query-engine/semantic-concept-matcher.ts` |
| News classification         | Text       | `OLLAMA_MODEL`         | `/src/lib/news/pipeline/ollama-client.ts`                     |
| Bank transaction processing | Text       | `OLLAMA_MODEL`         | `/src/lib/banking/import/processor.ts`                        |

#### Legacy DeepSeek Integration

**Status:** ⚠️ Deprecated - maintained for backward compatibility only

**Location:** `/src/lib/ai/deepseek.ts`

DeepSeek was the original AI provider but has been superseded by Ollama. The integration remains available but is no longer actively used in new features.

```typescript
// Legacy DeepSeek usage (not recommended for new code)
const result = await deepseekJson({
  model: "deepseek-chat",
  messages: [...],
  response_format: { type: "json_object" },
})
```

### 12.15 FINA Fiscalization

**Location:** `/src/lib/fiscal/`

#### Components

| File                     | Purpose                     |
| ------------------------ | --------------------------- |
| `porezna-client.ts`      | SOAP communication with CIS |
| `xml-builder.ts`         | Invoice XML generation      |
| `xml-signer.ts`          | XML digital signing         |
| `certificate-parser.ts`  | FINA certificate parsing    |
| `envelope-encryption.ts` | Secure key storage          |
| `should-fiscalize.ts`    | Fiscalization rules         |
| `qr-generator.ts`        | Receipt QR codes            |
| `pos-fiscalize.ts`       | POS integration             |

#### Endpoints

```typescript
// Test: https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest
// Prod: https://cis.porezna-uprava.hr:8449/FiskalizacijaService

const response = await submitToPorezna(signedXml, "TEST")
// Returns: { success, jir?, zki?, errorCode?, errorMessage? }
```

### 12.16 OIB/VAT Lookup

**Location:** `/src/lib/oib-lookup.ts`

#### Sources

1. **VIES** - EU VAT Information Exchange System
2. **Sudski Registar** - Croatian Court Registry

```typescript
// Lookup by OIB
const result = await lookupOib("12345678901")
// Returns: { success, name, address, city, postalCode, vatNumber, source }

// Search by name
const results = await searchCompanies("Primjer d.o.o.")
// Returns: { success, results: [{ name, oib, mbs, address }] }
```

### 12.17 Cron Jobs

| Endpoint                       | Schedule    | Purpose                    |
| ------------------------------ | ----------- | -------------------------- |
| `/api/cron/deadline-reminders` | Daily       | Tax deadline alerts        |
| `/api/cron/bank-sync`          | Daily       | GoCardless sync            |
| `/api/cron/email-sync`         | Hourly      | Email inbox sync           |
| `/api/cron/fiscal-processor`   | Every 5 min | Fiscalization queue        |
| `/api/cron/fiscal-retry`       | Hourly      | Failed fiscalization retry |
| `/api/cron/fetch-news`         | Daily       | News aggregation           |
| `/api/cron/checklist-digest`   | Weekly      | User digest emails         |
| `/api/cron/certificate-check`  | Daily       | Cert expiration check      |

### 12.18 Proactive AI Agents

FiskAI uses AI agents that **act proactively**, not just respond to queries.

#### Agent: The Watchdog (Regulatory Guardian)

**Trigger:** Daily cron job + every invoice creation

**Purpose:** Monitor revenue limits and warn before thresholds are breached

**Algorithm:**

```typescript
1. current_revenue = Sum(Invoices.total) WHERE year = current
2. proximity = current_revenue / 60000  // 2025 threshold for pausalni
3. If proximity > 0.85 → Level 1 Warning (Dashboard Banner)
4. If proximity > 0.95 → Level 2 Emergency (Email to User + Accountant)
5. Action: Display link to "Prijelaz na D.O.O." guide
```

**UI Components:**

- `card:pausalni-status` - Shows limit progress bar
- `card:insights-widget` - Displays proactive warnings

**Implementation:**

```typescript
// Runs in /api/cron/deadline-reminders
const revenue = await getYearlyRevenue(companyId)
const threshold = 60000 // EUR
const percentage = (revenue / threshold) * 100

if (percentage > 95) {
  await sendEmail({
    template: "threshold-emergency",
    to: [user.email, accountant?.email],
    data: { revenue, threshold, percentage },
  })
  await createNotification({
    type: "warning",
    priority: "high",
    message: "HITNO: Priblizavate se limitu pausalnog obrta",
  })
} else if (percentage > 85) {
  await createNotification({
    type: "warning",
    priority: "medium",
    message: `Ostvarili ste ${percentage.toFixed(0)}% pausalnog limita`,
  })
}
```

#### Agent: The Clerk (OCR & Categorization)

**Trigger:** Document upload to Expense Vault

**Purpose:** Extract invoice data and auto-categorize expenses

**Algorithm:**

```typescript
1. Input: JPEG/PNG/PDF from expense upload
2. Extract: Use DeepSeek/Vision via /api/ai/extract for text extraction
3. Parse: Date, Amount, Vendor OIB, VAT amount, Line items
4. Lookup: Check vendor OIB against Contact database
5. If unknown vendor: Search Sudski Registar (OIB API) → auto-create Contact
6. Categorize: Match description to expense categories using AI
7. VAT check: Verify deductibility via VIES if vendor has VAT ID
8. If amount > 665 EUR: Suggest asset capitalization
```

**Confidence Thresholds:**

- **High (>0.9):** Auto-fill fields, minimal review required
- **Medium (0.7-0.9):** Auto-fill with "Please verify" prompt
- **Low (<0.7):** Manual entry required, show extracted text

#### Agent: The Matcher (Bank Reconciliation)

**Trigger:** Bank transaction import (daily PSD2 sync or manual upload)

**Purpose:** Auto-match bank transactions to invoices

**Algorithm:**

```typescript
1. Input: BankTransaction row from sync
2. Extract: pozivNaBroj (payment reference number) from description
3. Match strategies (in order):
   a. Exact match: transaction.pozivNaBroj === invoice.invoiceNumber
   b. Fuzzy match: transaction.amount === invoice.total (±0.05 EUR tolerance)
   c. Vendor match: transaction.counterparty contains invoice.customer.name
4. If match confidence > 0.9: Auto-mark invoice as PAID
5. Else: Add to reconciliation queue for manual review
6. Create reconciliation record with match confidence
```

**Match Statuses:**

- `UNMATCHED` - New transaction, no invoice found
- `AUTO_MATCHED` - High confidence (>0.9), pending confirmation
- `MANUAL_MATCHED` - User-confirmed match
- `IGNORED` - User marked as non-invoice (e.g., expense, transfer)

---

## 13. Environment Variables

### Required for Production

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_URL=https://fiskai.hr
NEXTAUTH_SECRET=...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=FiskAI <noreply@fiskai.hr>
RESEND_WEBHOOK_SECRET=whsec_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PAUSALNI=price_...
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_PRO=price_...

# Cloudflare
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=fiskai-documents
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
CACHE_PURGE_SECRET=...
TURNSTILE_SECRET_KEY=...

# Analytics & Monitoring
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
SENTRY_DSN=https://...@sentry.io/...

# Bank Sync
GOCARDLESS_SECRET_ID=...
GOCARDLESS_SECRET_KEY=...

# AI
DEEPSEEK_API_KEY=...

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SLACK_CHANNEL=#fiskai-alerts
```

### E-Invoice Integrations

```bash
# ePoslovanje (Primary - Production)
EPOSLOVANJE_API_BASE=https://eracun.eposlovanje.hr  # or https://test.eposlovanje.hr for testing
EPOSLOVANJE_API_KEY=...
EPOSLOVANJE_TIMEOUT_MS=15000  # Optional, default 15000

# Inbound Invoice Worker (optional)
USE_INTEGRATION_ACCOUNT_INBOUND=true  # Use IntegrationAccount credentials instead of env vars
COMPANY_ID=...  # Company to poll for (worker-specific)
POLL_INTERVAL_MS=300000  # 5 minutes
MAX_WINDOW_DAYS=7  # Lookback window

# IE-Računi (Secondary - Stub Ready)
IE_RACUNI_API_KEY=...
IE_RACUNI_API_URL=https://api.ie-racuni.hr/v1
IE_RACUNI_SANDBOX=true
```

### AI Configuration (Ollama)

```bash
# Extraction (Regulatory Truth Layer) - Ollama Cloud with larger models
OLLAMA_EXTRACT_ENDPOINT=https://api.ollama.ai
OLLAMA_EXTRACT_MODEL=gemma-3-27b
OLLAMA_EXTRACT_API_KEY=...

# Embeddings - Local Ollama for fast vector generation
OLLAMA_EMBED_ENDPOINT=http://100.89.2.111:11434  # Tailscale address
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_API_KEY=local
OLLAMA_EMBED_DIMS=768

# General/Fallback (used if EXTRACT/EMBED not set)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_API_KEY=...
OLLAMA_MODEL=llama3.2
OLLAMA_VISION_MODEL=llava

# Legacy DeepSeek (deprecated, backward compatibility only)
DEEPSEEK_API_KEY=...
```

### GitHub Integration

```bash
# Automated PR creation for fiscal data and content sync
GITHUB_TOKEN=ghp_...  # Token with repo permissions
GITHUB_REPO=your-org/FiskAI  # Repository in owner/repo format
GITHUB_API=https://api.github.com  # Optional, defaults to GitHub API
```

### Optional / Development

```bash
# Sudski Registar (public API, has defaults)
SUDSKI_REGISTAR_CLIENT_ID=...
SUDSKI_REGISTAR_CLIENT_SECRET=...

# Content Sync Worker (optional overrides)
REPO_ROOT=...  # Default: current working directory
CONTENT_DIR=content  # Default: content (relative to REPO_ROOT)
```

---

## Changelog

- **2026-01-14:** Comprehensive integration update (v3.1.0)
  - **ePoslovanje:** Documented v2 API details, inbound invoice worker, dual-path architecture
  - **Ollama AI:** Complete split configuration documentation (EXTRACT/EMBED/general)
  - **GoCardless:** Full bank sync integration with Croatian banks, token management
  - **GitHub Integration:** Automated PR creation for fiscal data validation and content sync
  - **RTL Content Sync:** Expanded workflow, error handling, and database schema
  - Updated environment variables section with all new configs
- **2025-12-29:** Added RTL Content Sync integration (PR #140)
- **2025-12-28:** Major audit - added 15+ undocumented integrations
  - Cloudflare (R2, CDN purge, Turnstile)
  - Sentry error tracking
  - PostHog analytics + Web Vitals
  - Slack alerting
  - Regulatory Truth fetchers (HNB, NN, EUR-Lex)
  - OIB/VIES lookup
  - DeepSeek AI (now marked as deprecated)
  - Structured logger (Pino)
  - All cron jobs
  - Updated AI agent documentation
  - Added environment variable reference
