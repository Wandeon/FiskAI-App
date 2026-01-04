# AI Usage Tracking and Rate Limiting

This document describes the AI usage tracking and rate limiting system implemented in FiskAI.

## Overview

FiskAI uses OpenAI's GPT models for OCR receipt scanning, invoice extraction, and expense categorization. To prevent abuse and control costs, we track all AI usage and implement rate limiting based on subscription plans.

## Components

### 1. Database Schema

**AIUsage Model** (`prisma/schema.prisma`):

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  operation  String   // e.g., "ocr_receipt", "extract_receipt", "extract_invoice"
  tokensUsed Int?
  costCents  Int?     // Cost in cents (EUR)
  model      String?  // e.g., "gpt-4o", "gpt-4o-mini"
  success    Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@index([companyId, createdAt])
  @@index([companyId, operation])
}
```

### 2. Usage Tracking Service

**Location**: `/src/lib/ai/usage-tracking.ts`

**Key Functions**:

- `trackAIUsage(params)` - Logs AI usage with token count and cost
- `getUsageThisMonth(companyId)` - Returns current month usage statistics
- `getUsageStats(companyId, startDate, endDate)` - Returns usage for a date range
- `hasExceededBudget(companyId, budgetCents)` - Checks if monthly budget exceeded

**Pricing** (based on OpenAI pricing):

- `gpt-4o`: €0.0025 per 1K input tokens, €0.01 per 1K output tokens
- `gpt-4o-mini`: €0.00015 per 1K input tokens, €0.0006 per 1K output tokens

### 3. Rate Limiting Service

**Location**: `/src/lib/ai/rate-limiter.ts`

**Features**:

- In-memory rate limiter (10 requests per minute per company)
- Monthly usage limits based on subscription plan
- Per-operation limits for specific AI operations
- Automatic budget tracking

**Plan Limits**:

| Plan          | Monthly Calls | Monthly Budget | OCR Limit | Extract Limit |
| ------------- | ------------- | -------------- | --------- | ------------- |
| pausalni      | 100           | €2.00          | 50        | 50            |
| obrtnicki     | 500           | €10.00         | 250       | 250           |
| obrt_vat      | 1000          | €20.00         | -         | -             |
| doo_small     | 2000          | €50.00         | -         | -             |
| doo_standard  | 5000          | €100.00        | -         | -             |
| enterprise    | Unlimited     | Unlimited      | -         | -             |
| trial/default | 20            | €0.50          | -         | -             |

**Key Functions**:

- `checkRateLimit(companyId, operation)` - Checks if request is allowed
- `getUsageLimits(companyId)` - Returns current usage and limits

### 4. AI Operations with Tracking

All AI functions now accept an optional `companyId` parameter for tracking:

**OCR Functions** (`/src/lib/ai/ocr.ts`):

```typescript
extractFromImage(imageBase64: string, companyId?: string)
extractFromImageUrl(imageUrl: string, companyId?: string)
```

**Extraction Functions** (`/src/lib/ai/extract.ts`):

```typescript
extractReceipt(text: string, companyId?: string)
extractInvoice(text: string, companyId?: string)
```

### 5. API Endpoints

**Extract Endpoint** (`/api/ai/extract`):

- Checks rate limits before processing
- Tracks token usage and costs
- Returns usage information in response
- Returns 429 status code when rate limited

**Usage Endpoint** (`/api/ai/usage`):

- GET endpoint to retrieve current usage and limits
- Authenticated endpoint requiring valid session
- Returns plan, limits, usage, and remaining quota

## Usage Examples

### Track AI Usage Manually

```typescript
import { trackAIUsage } from "@/lib/ai/usage-tracking"

await trackAIUsage({
  companyId: "company_123",
  operation: "ocr_receipt",
  model: "gpt-4o",
  inputTokens: 1000,
  outputTokens: 500,
  success: true,
})
```

### Check Rate Limit

```typescript
import { checkRateLimit } from "@/lib/ai/rate-limiter"

const check = await checkRateLimit("company_123", "ocr_receipt")

if (!check.allowed) {
  console.log(`Rate limit exceeded: ${check.reason}`)
  console.log(`Retry after: ${check.retryAfter} seconds`)
} else {
  console.log(`Remaining calls: ${check.usage?.remaining}`)
}
```

### Get Usage Statistics

```typescript
import { getUsageThisMonth } from "@/lib/ai/usage-tracking"

const usage = await getUsageThisMonth("company_123")

console.log(`Total calls: ${usage.totalCalls}`)
console.log(`Total cost: €${usage.totalCostCents / 100}`)
console.log(`By operation:`, usage.byOperation)
```

### Get Usage and Limits

```typescript
import { getUsageLimits } from "@/lib/ai/rate-limiter"

const data = await getUsageLimits("company_123")

console.log(`Plan: ${data.plan}`)
console.log(`Usage: ${data.usage.totalCalls} / ${data.limits.totalCalls}`)
console.log(`Remaining: ${data.remaining.calls} calls`)
```

## API Response Examples

### Successful Extraction with Usage Info

```json
{
  "success": true,
  "data": {
    "vendor": "Konzum",
    "date": "2024-12-15",
    "total": 125.5
    // ... other fields
  },
  "usage": {
    "current": 45,
    "limit": 100,
    "remaining": 55
  }
}
```

### Rate Limit Exceeded

```json
{
  "error": "Monthly AI usage limit reached (100 calls). Please upgrade your plan.",
  "usage": {
    "current": 100,
    "limit": 100,
    "remaining": 0
  }
}
```

### Short-term Rate Limit

```json
{
  "error": "Too many requests. Please wait a moment.",
  "retryAfter": 45
}
```

## Monitoring and Analytics

### Database Queries

**Monthly usage by company**:

```sql
SELECT
  "companyId",
  COUNT(*) as total_calls,
  SUM("tokensUsed") as total_tokens,
  SUM("costCents") as total_cost_cents,
  AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate
FROM "AIUsage"
WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY "companyId";
```

**Usage by operation**:

```sql
SELECT
  operation,
  COUNT(*) as calls,
  AVG("tokensUsed") as avg_tokens,
  SUM("costCents") as total_cost
FROM "AIUsage"
WHERE "companyId" = 'company_123'
  AND "createdAt" >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY operation;
```

## Future Enhancements

1. **Redis-based Rate Limiting**: Replace in-memory rate limiter with Redis for distributed systems
2. **Per-User Limits**: Add user-level rate limiting in addition to company-level
3. **Usage Alerts**: Email notifications when approaching limits
4. **Cost Optimization**: Automatic fallback to cheaper models when appropriate
5. **Usage Dashboard**: Admin panel to monitor AI usage across all companies
6. **Custom Budgets**: Allow companies to set custom AI budgets
7. **Overage Billing**: Automatic billing for usage beyond plan limits

## Testing

```bash
# Run database migration
npx prisma migrate dev --name add-ai-usage-tracking

# Generate Prisma client
npx prisma generate

# Test rate limiting
npm test src/lib/ai/rate-limiter.test.ts

# Test usage tracking
npm test src/lib/ai/usage-tracking.test.ts
```

## Security Considerations

- Usage tracking failures are logged but don't block AI operations
- Rate limiting is enforced before making API calls to prevent cost overruns
- Costs are calculated conservatively to avoid underestimating expenses
- All AI endpoints require authentication and company association
- Usage data is isolated per company with proper access controls

## Cost Management

The system helps manage costs through:

1. **Proactive Rate Limiting**: Prevents excessive usage before costs accumulate
2. **Transparent Tracking**: All usage is logged with token counts and costs
3. **Plan-based Budgets**: Automatic enforcement of subscription limits
4. **Short-term Protection**: Per-minute rate limiting prevents abuse
5. **Success Tracking**: Failed requests are logged to identify issues

## Support

For questions or issues with AI usage tracking:

- Check logs in the database for historical usage
- Review company subscription plan and limits
- Contact support for custom limits or plan upgrades
