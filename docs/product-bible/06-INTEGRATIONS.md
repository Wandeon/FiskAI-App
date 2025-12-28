# Integrations

[← Back to Index](./00-INDEX.md)

---

> **Last Audit:** 2025-12-28
> **Auditor:** Claude Code
> **Status:** Updated with PR #111 (Adaptive Sentinel), PR #115 (Living Truth Infrastructure)

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

| Provider    | Type         | Status         | Location                                      | Notes                             |
| ----------- | ------------ | -------------- | --------------------------------------------- | --------------------------------- |
| Mock        | Testing      | ✅ Full        | `/src/lib/e-invoice/providers/mock.ts`        | Development only                  |
| Mock Fiscal | Testing      | ✅ Full        | `/src/lib/e-invoice/providers/mock-fiscal.ts` | Fiscalization testing             |
| IE-Racuni   | Intermediary | ⚠️ Stub        | `/src/lib/e-invoice/providers/ie-racuni.ts`   | API stub ready, needs credentials |
| FINA Direct | Direct       | ⚠️ 80%         | `/src/lib/fiscal/porezna-client.ts`           | Requires certificate              |
| Moj-eRacun  | Intermediary | ❌ Not started | -                                             | Low priority                      |

### 12.3 Bank Import Formats

| Format         | Extension | Status | Notes                  |
| -------------- | --------- | ------ | ---------------------- |
| CSV (generic)  | .csv      | ✅     | Manual column mapping  |
| CAMT.053       | .xml      | ✅     | ISO 20022 standard     |
| Erste CSV      | .csv      | ✅     | Pre-configured mapping |
| Raiffeisen CSV | .csv      | ✅     | Pre-configured mapping |
| PBZ Export     | .csv      | ⚠️ WIP | Parser in development  |
| MT940          | .sta      | ❌     | Not yet implemented    |

### 12.4 Stripe Integration

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

### 12.5 Resend Email Integration

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

### 12.6 Cloudflare Integration

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

### 12.7 Sentry Error Tracking

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

### 12.8 PostHog Analytics

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

### 12.9 Slack Alerting

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

### 12.10 Regulatory Truth Layer (Sentinel)

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

### 12.11 AI Providers

**Location:** `/src/lib/ai/`

| Provider | Purpose                         | Model         | Location      |
| -------- | ------------------------------- | ------------- | ------------- |
| DeepSeek | Text extraction, categorization | deepseek-chat | `deepseek.ts` |
| (Vision) | OCR backup                      | -             | `ocr.ts`      |

```typescript
// DeepSeek JSON response
const result = await deepseekJson({
  model: "deepseek-chat",
  messages: [...],
  response_format: { type: "json_object" },
})
```

### 12.12 FINA Fiscalization

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

### 12.13 OIB/VAT Lookup

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

### 12.14 Cron Jobs

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

### 12.15 Proactive AI Agents

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

### Optional / Development

```bash
# E-Invoice (when ready)
IE_RACUNI_API_KEY=...
IE_RACUNI_API_URL=https://api.ie-racuni.hr/v1
IE_RACUNI_SANDBOX=true

# Sudski Registar (public API, has defaults)
SUDSKI_REGISTAR_CLIENT_ID=...
SUDSKI_REGISTAR_CLIENT_SECRET=...
```

---

## Changelog

- **2025-12-28:** Major audit - added 15+ undocumented integrations
  - Cloudflare (R2, CDN purge, Turnstile)
  - Sentry error tracking
  - PostHog analytics + Web Vitals
  - Slack alerting
  - Regulatory Truth fetchers (HNB, NN, EUR-Lex)
  - OIB/VIES lookup
  - DeepSeek AI
  - Structured logger (Pino)
  - All cron jobs
  - Updated AI agent documentation
  - Added environment variable reference
