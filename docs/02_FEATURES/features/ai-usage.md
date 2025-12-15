# Feature: AI Usage Tracking (F080)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

The AI Usage Tracking feature monitors and controls all AI-powered operations in FiskAI (OCR receipt scanning, invoice extraction, expense categorization) by tracking API call volume, token consumption, and costs. The system implements multi-tier rate limiting with per-minute burst protection (10 requests/minute) and subscription-based monthly quotas (20-5000 calls depending on plan). All usage is logged to the AIUsage database table with granular metrics including operation type, model used, token counts, and cost calculations based on OpenAI pricing. The feature integrates with Stripe billing to enforce plan limits, prevent cost overruns, and provide transparency through the /api/ai/usage endpoint that returns current usage statistics, remaining quota, and plan details.

## User Entry Points

| Type     | Path              | Evidence                                           |
| -------- | ----------------- | -------------------------------------------------- |
| API      | /api/ai/usage     | `src/app/api/ai/usage/route.ts:9`                  |
| Function | trackAIUsage      | `src/lib/ai/usage-tracking.ts:50`                  |
| Function | checkRateLimit    | `src/lib/ai/rate-limiter.ts:120`                   |
| Page     | /settings/billing | `src/app/(dashboard)/settings/billing/page.tsx:16` |

## Core Flow

1. User triggers AI operation (OCR, extraction, categorization) → `src/app/api/ai/extract/route.ts:11-35`
2. System retrieves company context from session → `src/app/api/ai/extract/route.ts:19-34`
3. System checks in-memory rate limiter (10 req/min) → `src/lib/ai/rate-limiter.ts:135-146`
4. System checks monthly usage against subscription plan limits → `src/lib/ai/rate-limiter.ts:148-167`
5. If limits exceeded, returns 429 error with retry info → `src/app/api/ai/extract/route.ts:43-56`
6. If allowed, system processes AI request with OpenAI → `src/lib/ai/ocr.ts:26-57`
7. System captures token usage from API response → `src/lib/ai/ocr.ts:59-61`
8. System calculates cost based on model pricing → `src/lib/ai/usage-tracking.ts:31-45`
9. System logs usage to AIUsage table → `src/lib/ai/usage-tracking.ts:73-82`
10. Usage data linked to company for aggregation → `prisma/schema.prisma:1088-1089`
11. System returns usage stats in API response → `src/app/api/ai/extract/route.ts:62-65`
12. Admin/user can view usage via /api/ai/usage endpoint → `src/app/api/ai/usage/route.ts:35-37`

## Key Modules

| Module              | Purpose                                   | Location                                |
| ------------------- | ----------------------------------------- | --------------------------------------- |
| trackAIUsage        | Core tracking function, logs to database  | `src/lib/ai/usage-tracking.ts:50`       |
| checkRateLimit      | Validates request against plan limits     | `src/lib/ai/rate-limiter.ts:120`        |
| getUsageLimits      | Returns current usage and remaining quota | `src/lib/ai/rate-limiter.ts:261`        |
| getUsageThisMonth   | Aggregates monthly usage by operation     | `src/lib/ai/usage-tracking.ts:104`      |
| InMemoryRateLimiter | Per-minute burst protection               | `src/lib/ai/rate-limiter.ts:70-113`     |
| /api/ai/usage       | GET endpoint for usage statistics         | `src/app/api/ai/usage/route.ts:9`       |
| /api/ai/extract     | Enforces rate limits on AI operations     | `src/app/api/ai/extract/route.ts:39-56` |
| AIUsage model       | Database table for usage logs             | `prisma/schema.prisma:1086-1100`        |
| PLAN_LIMITS         | Subscription plan configuration           | `src/lib/ai/rate-limiter.ts:17-64`      |

## Technical Details

### Database Schema

The AIUsage table stores comprehensive tracking data:

```prisma
model AIUsage {
  id         String   @id @default(cuid())
  companyId  String
  operation  String   // ocr_receipt, extract_receipt, extract_invoice, categorize_expense
  tokensUsed Int?     // Total tokens (input + output)
  costCents  Int?     // Calculated cost in EUR cents
  model      String?  // gpt-4o, gpt-4o-mini
  success    Boolean  @default(true)
  createdAt  DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, createdAt])
  @@index([companyId, operation])
}
```

Location: `prisma/schema.prisma:1086-1100`

### Rate Limiting Strategy

The system implements two-tier rate limiting:

**1. Short-term (Per-minute):**

- In-memory Map-based limiter
- 10 requests per minute per company
- Prevents abuse and API hammering
- Returns 429 with retryAfter seconds
- Location: `src/lib/ai/rate-limiter.ts:70-113`

**2. Long-term (Monthly):**

- Database-backed monthly quotas
- Plan-based limits (20-5000 calls)
- Cost limits (€0.50 - €100.00)
- Per-operation limits for lower tiers
- Location: `src/lib/ai/rate-limiter.ts:172-213`

### Subscription Plan Limits

```typescript
PLAN_LIMITS = {
  pausalni:     { totalCalls: 100,   totalCostCents: 200,    perOperation: { ocr: 50,  extract: 50  } }
  obrtnicki:    { totalCalls: 500,   totalCostCents: 1000,   perOperation: { ocr: 250, extract: 250 } }
  obrt_vat:     { totalCalls: 1000,  totalCostCents: 2000   }
  doo_small:    { totalCalls: 2000,  totalCostCents: 5000   }
  doo_standard: { totalCalls: 5000,  totalCostCents: 10000  }
  enterprise:   { totalCalls: 999999, totalCostCents: 999999 }
  default:      { totalCalls: 20,    totalCostCents: 50     } // Trial
}
```

Location: `src/lib/ai/rate-limiter.ts:17-64`

### Cost Calculation

Pricing based on OpenAI rates (EUR cents per 1M tokens):

```typescript
MODEL_PRICING = {
  'gpt-4o':      { input: 250,  output: 1000 }  // €2.50 in, €10.00 out
  'gpt-4o-mini': { input: 15,   output: 60   }  // €0.15 in, €0.60 out
}
```

Formula: `cost = (inputTokens/1M * inputPrice) + (outputTokens/1M * outputPrice)`

Location: `src/lib/ai/usage-tracking.ts:17-45`

### Integration Points

**AI Operations with Tracking:**

- extractFromImage (OCR) → `src/lib/ai/ocr.ts:15` → Uses gpt-4o
- extractFromImageUrl (OCR) → `src/lib/ai/ocr.ts:119` → Uses gpt-4o
- extractReceipt (text) → `src/lib/ai/extract.ts:54` → Uses gpt-4o-mini
- extractInvoice (text) → `src/lib/ai/extract.ts:124` → Uses gpt-4o-mini

All functions accept optional `companyId` parameter for tracking.

**Tracking Call Sites:**

- Success case: `src/lib/ai/ocr.ts:84-93`
- Failure case: `src/lib/ai/ocr.ts:98-107`
- Parse error case: `src/lib/ai/ocr.ts:67-77`

### API Response Format

**Successful extraction with usage info:**

```json
{
  "success": true,
  "data": { "vendor": "Konzum", "total": 125.50, ... },
  "usage": {
    "current": 45,
    "limit": 100,
    "remaining": 55
  }
}
```

**Rate limit exceeded:**

```json
{
  "error": "Monthly AI usage limit reached (100 calls). Please upgrade your plan.",
  "usage": { "current": 100, "limit": 100, "remaining": 0 }
}
```

**Short-term rate limit:**

```json
{
  "error": "Too many requests. Please wait a moment.",
  "retryAfter": 45
}
```

### Usage Statistics Endpoint

GET /api/ai/usage returns comprehensive usage data:

```json
{
  "plan": "pausalni",
  "limits": {
    "totalCalls": 100,
    "totalCostCents": 200,
    "perOperationLimits": { "ocr_receipt": 50, "extract_receipt": 50 }
  },
  "usage": {
    "totalCalls": 45,
    "totalTokens": 125000,
    "totalCostCents": 87,
    "byOperation": {
      "ocr_receipt": { "calls": 30, "tokens": 90000, "costCents": 65 },
      "extract_receipt": { "calls": 15, "tokens": 35000, "costCents": 22 }
    }
  },
  "remaining": {
    "calls": 55,
    "costCents": 113
  }
}
```

Location: `src/app/api/ai/usage/route.ts:9-45`

## Evidence Links

1. **API Endpoint:** `/api/ai/usage` route handler with authentication and usage retrieval
   `src/app/api/ai/usage/route.ts:9-45`

2. **Core Tracking Function:** `trackAIUsage()` logs operation, tokens, cost to database
   `src/lib/ai/usage-tracking.ts:50-99`

3. **Rate Limiter:** `checkRateLimit()` enforces per-minute and monthly limits
   `src/lib/ai/rate-limiter.ts:120-256`

4. **Usage Aggregation:** `getUsageThisMonth()` calculates monthly totals by operation
   `src/lib/ai/usage-tracking.ts:104-160`

5. **Limits Retrieval:** `getUsageLimits()` returns plan limits and remaining quota
   `src/lib/ai/rate-limiter.ts:261-305`

6. **Database Schema:** AIUsage model with company relation and indexed fields
   `prisma/schema.prisma:1086-1100`

7. **Plan Configuration:** PLAN_LIMITS defines quotas per subscription tier
   `src/lib/ai/rate-limiter.ts:17-64`

8. **Cost Calculation:** MODEL_PRICING and calculateCost() for OpenAI pricing
   `src/lib/ai/usage-tracking.ts:17-45`

9. **In-Memory Limiter:** InMemoryRateLimiter class for burst protection
   `src/lib/ai/rate-limiter.ts:70-113`

10. **Extract Endpoint:** Rate limit enforcement before AI processing
    `src/app/api/ai/extract/route.ts:39-56`

11. **OCR Integration:** Tracking calls in extractFromImage with token capture
    `src/lib/ai/ocr.ts:59-93`

12. **Extract Integration:** Tracking calls in extractReceipt with error handling
    `src/lib/ai/extract.ts:73-106`

13. **Billing Integration:** Company subscription fields used for limit checks
    `src/lib/billing/stripe.ts:26-48` and `prisma/schema.prisma:96-102`

14. **Usage Documentation:** Comprehensive guide with examples and monitoring queries
    `docs/AI_USAGE_TRACKING.md:1-281`

## Related Features

- F032: Receipt Scanner - Primary consumer of AI usage tracking for OCR operations
- F033: Expense Creation - Uses AI categorization with usage tracking
- F020: Invoicing - Uses AI extraction for invoice data with usage tracking
- F070: Settings Billing - Displays AI usage stats and subscription management

## Notes

- Usage tracking failures are logged but don't block AI operations (fail-open design)
- Costs are calculated conservatively with Math.ceil() to avoid underestimation
- All AI endpoints require authentication and valid company association
- Usage data is fully isolated per company with cascade deletion
- In-memory rate limiter performs periodic cleanup (1% chance per request)
- Rate limiting defaults to allowing requests if check fails (availability priority)
- Monthly calculations use start-of-month timestamp for consistent windows
- Success/failure tracking enables quality monitoring and debugging
