# Feature: AI Receipt Extraction (F077)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 28

## Purpose

Enables automatic extraction of structured data from receipt images using OpenAI's GPT-4o Vision model. Users can photograph or upload receipt images, and the system extracts vendor details, line items, amounts, dates, and payment methods into structured JSON for expense creation. The feature supports both image-based OCR extraction and text-based extraction, with comprehensive usage tracking and rate limiting per subscription plan.

## User Entry Points

| Type      | Path            | Evidence                                                      |
| --------- | --------------- | ------------------------------------------------------------- |
| API       | /api/ai/extract | `src/app/api/ai/extract/route.ts:11`                          |
| Component | ReceiptScanner  | `src/components/expense/receipt-scanner.tsx:19`               |
| Component | WithFeedback    | `src/components/expense/receipt-scanner-with-feedback.tsx:21` |

## Core Flow

1. User opens receipt scanner component in expense form → `src/components/expense/receipt-scanner.tsx:19`
2. User clicks "Fotografiraj" (camera) or "Učitaj sliku" (upload) → `src/components/expense/receipt-scanner.tsx:167-202`
3. Component converts image to base64 format → `src/components/expense/receipt-scanner.tsx:88-99`
4. Component sends POST request to /api/ai/extract → `src/components/expense/receipt-scanner.tsx:44-48`
5. API validates user session and retrieves company context → `src/app/api/ai/extract/route.ts:12-34`
6. API checks rate limits (per-minute and monthly quotas) → `src/app/api/ai/extract/route.ts:39-56`
7. If rate limit exceeded, returns 429 with retry info → `src/app/api/ai/extract/route.ts:43-56`
8. System strips base64 prefix and calls extractFromImage → `src/app/api/ai/extract/route.ts:59-66`
9. OCR module sends image to GPT-4o with extraction prompt → `src/lib/ai/ocr.ts:26-57`
10. GPT-4o returns structured JSON with receipt data → `src/lib/ai/ocr.ts:63-65`
11. System parses JSON and validates structure → `src/lib/ai/ocr.ts:80`
12. System tracks token usage and calculates cost → `src/lib/ai/ocr.ts:84-93`
13. API returns extracted data with usage stats → `src/app/api/ai/extract/route.ts:62-65`
14. Component optionally uploads receipt image to R2 storage → `src/components/expense/receipt-scanner.tsx:57-75`
15. Component calls onExtracted callback with data → `src/components/expense/receipt-scanner.tsx:77`

## Key Modules

| Module                     | Purpose                                | Location                                                          |
| -------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| POST /api/ai/extract       | API endpoint for extraction requests   | `src/app/api/ai/extract/route.ts:11-84`                           |
| extractFromImage           | GPT-4o Vision OCR for base64 images    | `src/lib/ai/ocr.ts:15-114`                                        |
| extractFromImageUrl        | GPT-4o Vision OCR for URL images       | `src/lib/ai/ocr.ts:116-212`                                       |
| extractReceipt             | Text-based extraction with gpt-4o-mini | `src/lib/ai/extract.ts:54-126`                                    |
| extractInvoice             | Invoice extraction with gpt-4o-mini    | `src/lib/ai/extract.ts:128-200`                                   |
| trackAIUsage               | Logs usage to database                 | `src/lib/ai/usage-tracking.ts:50-99`                              |
| checkRateLimit             | Validates against plan limits          | `src/lib/ai/rate-limiter.ts:120`                                  |
| ReceiptScanner             | UI component for image capture/upload  | `src/components/expense/receipt-scanner.tsx:19-231`               |
| ReceiptScannerWithFeedback | Scanner with AI feedback integration   | `src/components/expense/receipt-scanner-with-feedback.tsx:21-258` |

## Data Types

### ExtractedReceipt Interface

```typescript
interface ExtractedReceipt {
  vendor: string
  vendorOib?: string // Croatian tax ID (11 digits)
  date: string // YYYY-MM-DD format
  items: ExtractedItem[]
  subtotal: number
  vatAmount: number
  total: number
  paymentMethod?: "cash" | "card" | "transfer"
  currency: string // Default: EUR
  confidence: number // 0-1 scale
}
```

Evidence: `src/lib/ai/types.ts:1-12`

### ExtractedItem Interface

```typescript
interface ExtractedItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  vatRate?: number // Default: 25 (Croatian standard VAT)
}
```

Evidence: `src/lib/ai/types.ts:14-20`

### ExtractionResult Interface

```typescript
interface ExtractionResult<T> {
  success: boolean
  data?: T
  error?: string
  rawText?: string
}
```

Evidence: `src/lib/ai/types.ts:30-35`

## AI Model Configuration

### Image OCR (GPT-4o Vision)

- **Model**: `gpt-4o` → `src/lib/ai/ocr.ts:19`
- **Max tokens**: 1000 → `src/lib/ai/ocr.ts:56`
- **Input format**: Base64 JPEG with data URL → `src/lib/ai/ocr.ts:50-52`
- **Use case**: Receipt images requiring visual processing

### Text Extraction (GPT-4o-mini)

- **Model**: `gpt-4o-mini` → `src/lib/ai/extract.ts:58`
- **Response format**: JSON object mode → `src/lib/ai/extract.ts:70`
- **Use case**: Pre-extracted text or OCR output refinement

## Prompt Engineering

### OCR Prompt Structure

The system prompt instructs GPT-4o to extract receipt data with Croatian context:

```text
Extract receipt data from this image. Return JSON:
{
  "vendor": "business name",
  "vendorOib": "OIB if visible",
  "date": "YYYY-MM-DD",
  "items": [{"description": "", "quantity": 1, "unitPrice": 0, "total": 0, "vatRate": 25}],
  "subtotal": 0,
  "vatAmount": 0,
  "total": 0,
  "paymentMethod": "cash|card|transfer",
  "currency": "EUR",
  "confidence": 0.0-1.0
}
Croatian: PDV=VAT, Ukupno=Total, Gotovina=Cash, Kartica=Card
```

Evidence: `src/lib/ai/ocr.ts:34-47`

### Text Extraction Prompt

Similar structure with system/user message separation:

Evidence: `src/lib/ai/extract.ts:15-30`

## Rate Limiting

### Per-Minute Limits

- **Window**: 60 seconds → `src/lib/ai/rate-limiter.ts:72`
- **Max requests**: 10 per company → `src/lib/ai/rate-limiter.ts:73`
- **Implementation**: In-memory Map with cleanup → `src/lib/ai/rate-limiter.ts:70-113`

### Monthly Subscription Limits

| Plan         | Total Calls | Cost Limit | OCR Limit |
| ------------ | ----------- | ---------- | --------- |
| Trial        | 20          | €0.50      | -         |
| Pausalni     | 100         | €2.00      | 50        |
| Obrtnicki    | 500         | €10.00     | 250       |
| Obrt VAT     | 1,000       | €20.00     | -         |
| DOO Small    | 2,000       | €50.00     | -         |
| DOO Standard | 5,000       | €100.00    | -         |
| Enterprise   | Unlimited   | Unlimited  | -         |

Evidence: `src/lib/ai/rate-limiter.ts:17-64`

### Rate Limit Response

When limits exceeded, returns 429 with:

- Error message explaining the limit
- Current usage stats
- Retry-after seconds (for per-minute limits)

Evidence: `src/app/api/ai/extract/route.ts:43-56`

## Usage Tracking

### AIUsage Database Model

```prisma
model AIUsage {
  id         String   @id @default(cuid())
  companyId  String
  operation  String   // ocr_receipt, extract_receipt, extract_invoice
  tokensUsed Int?
  costCents  Int?     // Cost in EUR cents
  model      String?  // gpt-4o, gpt-4o-mini
  success    Boolean  @default(true)
  createdAt  DateTime @default(now())
}
```

Evidence: `prisma/schema.prisma:1086-1100`

### Cost Calculation

Pricing per 1M tokens (EUR cents):

| Model       | Input | Output |
| ----------- | ----- | ------ |
| gpt-4o      | 250   | 1000   |
| gpt-4o-mini | 15    | 60     |

Formula: `cost = (inputTokens/1M × inputPrice) + (outputTokens/1M × outputPrice)`

Evidence: `src/lib/ai/usage-tracking.ts:17-45`

### Tracking Call Sites

- Successful OCR: `src/lib/ai/ocr.ts:84-93`
- Failed OCR: `src/lib/ai/ocr.ts:98-107`
- Parse error: `src/lib/ai/ocr.ts:67-77`
- Text extraction success: `src/lib/ai/extract.ts:94-104`
- Text extraction failure: `src/lib/ai/extract.ts:109-118`

## UI Components

### ReceiptScanner Component

**Features:**

- Camera capture button with device camera access → `src/components/expense/receipt-scanner.tsx:167-184`
- File upload button for gallery images → `src/components/expense/receipt-scanner.tsx:186-202`
- Image preview with processing overlay → `src/components/expense/receipt-scanner.tsx:137-156`
- Error display with red background → `src/components/expense/receipt-scanner.tsx:158-163`
- Cancel/Confirm action buttons → `src/components/expense/receipt-scanner.tsx:206-227`

**Croatian Labels:**

- "Skeniraj račun" (Scan receipt) → `src/components/expense/receipt-scanner.tsx:129`
- "Fotografiraj" (Photograph) → `src/components/expense/receipt-scanner.tsx:175`
- "Učitaj sliku" (Upload image) → `src/components/expense/receipt-scanner.tsx:194`
- "Obrađujem..." (Processing...) → `src/components/expense/receipt-scanner.tsx:151`
- "Greška" (Error) → `src/components/expense/receipt-scanner.tsx:160`

### ReceiptScannerWithFeedback Component

Extends base scanner with AI feedback integration:

- Shows AIFeedback component after extraction → `src/components/expense/receipt-scanner-with-feedback.tsx:182-192`
- Displays confidence score from extraction → `src/components/expense/receipt-scanner-with-feedback.tsx:187`
- Tracks feedback for ocr_receipt operation → `src/components/expense/receipt-scanner-with-feedback.tsx:186`

## Receipt Storage

After successful extraction, images can be uploaded to R2:

1. Create FormData with file → `src/components/expense/receipt-scanner.tsx:60-61`
2. POST to /api/receipts/upload → `src/components/expense/receipt-scanner.tsx:63-66`
3. Receive receiptUrl on success → `src/components/expense/receipt-scanner.tsx:69-70`
4. Attach URL to extracted data → `src/components/expense/receipt-scanner.tsx:77`

Evidence: `src/components/expense/receipt-scanner.tsx:57-75`

## Error Handling

### API Error Cases

| Scenario          | Status | Response                               | Evidence                                |
| ----------------- | ------ | -------------------------------------- | --------------------------------------- |
| No session        | 401    | `{ error: 'Unauthorized' }`            | `src/app/api/ai/extract/route.ts:13-15` |
| No company        | 404    | `{ error: 'Company not found' }`       | `src/app/api/ai/extract/route.ts:26-30` |
| Rate limited      | 429    | `{ error: reason, usage, retryAfter }` | `src/app/api/ai/extract/route.ts:48-55` |
| No input          | 400    | `{ error: 'No input provided' }`       | `src/app/api/ai/extract/route.ts:76`    |
| Extraction failed | 500    | `{ error: message }`                   | `src/app/api/ai/extract/route.ts:77-82` |

### OCR Error Cases

| Scenario        | Result                                    | Evidence                    |
| --------------- | ----------------------------------------- | --------------------------- |
| No API key      | Throws 'OpenAI API key not configured'    | `src/lib/ai/ocr.ts:7-9`     |
| No JSON in resp | `{ success: false, error: 'No JSON...' }` | `src/lib/ai/ocr.ts:66-78`   |
| Parse error     | `{ success: false, error: message }`      | `src/lib/ai/ocr.ts:109-112` |

## Security

### Authentication

- Session required via `auth()` → `src/app/api/ai/extract/route.ts:12-15`
- Company context from CompanyUser → `src/app/api/ai/extract/route.ts:21-31`

### Tenant Isolation

- All usage tracked per companyId → `src/lib/ai/usage-tracking.ts:51`
- Rate limits enforced per company → `src/lib/ai/rate-limiter.ts:75-77`
- AIUsage indexed by companyId → `prisma/schema.prisma:1098-1099`

### API Key Security

- OpenAI key from environment variable → `src/lib/ai/ocr.ts:7-12`
- Lazy-loaded to avoid build errors → `src/lib/ai/ocr.ts:6`

## Dependencies

- **Depends on**:
  - [[auth-session]] - Session validation for API access
  - [[settings-company]] - Company context for tenant isolation
  - OpenAI API - GPT-4o Vision model
  - Cloudflare R2 - Receipt image storage (optional)

- **Depended by**:
  - [[expenses-create]] - Uses extracted data to populate expense form
  - [[ai-feedback]] - Collects user feedback on extraction quality
  - [[ai-usage]] - Displays usage statistics from tracking data

## Integrations

### OpenAI API

- Client initialization: `src/lib/ai/ocr.ts:6-13`
- Chat completions with vision: `src/lib/ai/ocr.ts:26-57`
- JSON response format: `src/lib/ai/extract.ts:70`

### Logging

- Pino logger for structured logs → `src/app/api/ai/extract/route.ts:6`
- Rate limit warnings → `src/app/api/ai/extract/route.ts:44-47`
- Extraction errors → `src/app/api/ai/extract/route.ts:78`
- Usage tracking logs → `src/lib/ai/usage-tracking.ts:84-94`

## Verification Checklist

- [x] API endpoint accepts base64-encoded images
- [x] API endpoint accepts text input for extraction
- [x] GPT-4o Vision processes receipt images
- [x] GPT-4o-mini processes text-based extraction
- [x] Structured JSON output matches ExtractedReceipt interface
- [x] Confidence scores included in extraction results
- [x] Per-minute rate limiting (10 req/min) enforced
- [x] Monthly subscription limits enforced
- [x] 429 response includes retry-after for per-minute limits
- [x] Token usage tracked in AIUsage table
- [x] Cost calculation uses correct model pricing
- [x] Croatian terms recognized (PDV, Ukupno, etc.)
- [x] Line items extracted with quantity, price, VAT rate
- [x] Payment method detected (cash/card/transfer)
- [x] Receipt images can be uploaded to R2 storage
- [x] UI shows camera and upload options
- [x] Processing overlay during extraction
- [x] Error messages displayed in Croatian
- [x] Feedback component integration available

## Evidence Links

1. `src/app/api/ai/extract/route.ts:1-84` - Complete API endpoint implementation
2. `src/lib/ai/ocr.ts:1-201` - OCR extraction with GPT-4o Vision
3. `src/lib/ai/extract.ts:1-200` - Text-based extraction with GPT-4o-mini
4. `src/lib/ai/types.ts:1-42` - TypeScript interfaces for extraction
5. `src/lib/ai/usage-tracking.ts:1-98` - Usage tracking and cost calculation
6. `src/lib/ai/rate-limiter.ts:1-100` - Rate limiting configuration and logic
7. `src/components/expense/receipt-scanner.tsx:1-231` - Receipt scanner UI component
8. `src/components/expense/receipt-scanner-with-feedback.tsx:1-258` - Scanner with feedback
9. `prisma/schema.prisma:1086-1100` - AIUsage database model
10. `src/app/api/ai/extract/route.ts:11` - POST handler with logging wrapper
11. `src/app/api/ai/extract/route.ts:21-34` - Company context retrieval
12. `src/app/api/ai/extract/route.ts:39-56` - Rate limit check and 429 response
13. `src/lib/ai/ocr.ts:15-114` - extractFromImage function
14. `src/lib/ai/ocr.ts:26-57` - OpenAI API call with vision
15. `src/lib/ai/ocr.ts:34-47` - Croatian-aware extraction prompt
16. `src/lib/ai/ocr.ts:84-93` - Successful extraction usage tracking
17. `src/lib/ai/extract.ts:54-126` - extractReceipt for text input
18. `src/lib/ai/extract.ts:15-30` - Receipt extraction prompt
19. `src/lib/ai/rate-limiter.ts:17-64` - PLAN_LIMITS configuration
20. `src/lib/ai/rate-limiter.ts:70-113` - InMemoryRateLimiter class
21. `src/lib/ai/usage-tracking.ts:17-26` - MODEL_PRICING configuration
22. `src/lib/ai/usage-tracking.ts:31-45` - Cost calculation function
23. `src/lib/ai/usage-tracking.ts:50-82` - trackAIUsage function
24. `src/components/expense/receipt-scanner.tsx:27-86` - Image processing flow
25. `src/components/expense/receipt-scanner.tsx:44-48` - API fetch call
26. `src/components/expense/receipt-scanner.tsx:57-75` - R2 upload flow
27. `src/components/expense/receipt-scanner-with-feedback.tsx:182-192` - Feedback integration
28. `prisma/schema.prisma:129` - Company.aiUsage relation
