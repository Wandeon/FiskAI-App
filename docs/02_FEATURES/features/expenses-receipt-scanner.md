# Feature: Receipt Scanner (F032)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 25

## Purpose

The Receipt Scanner feature enables users to capture or upload receipt images and automatically extract structured data (vendor, date, amounts, items) using AI-powered OCR (Optical Character Recognition). The extracted data auto-populates the expense form, with intelligent category suggestions based on vendor history and description keywords. Images are stored in R2 cloud storage and linked to expense records. The feature includes AI confidence scoring, user feedback collection for accuracy improvement, and rate limiting based on subscription plans, significantly reducing manual data entry for expense tracking.

## User Entry Points

| Type   | Path             | Evidence                                                |
| ------ | ---------------- | ------------------------------------------------------- |
| Page   | /expenses/new    | `src/app/(dashboard)/expenses/new/page.tsx:8`           |
| Button | "Skeniraj račun" | `src/app/(dashboard)/expenses/new/expense-form.tsx:198` |
| Action | createExpense    | `src/app/actions/expense.ts:33`                         |

## Core Flow

1. User navigates to /expenses/new → `src/app/(dashboard)/expenses/new/page.tsx:8`
2. System validates authentication and loads vendors/categories → `src/app/(dashboard)/expenses/new/page.tsx:9-27`
3. User clicks "Skeniraj račun" button → `src/app/(dashboard)/expenses/new/expense-form.tsx:192-199`
4. System displays ReceiptScanner component → `src/app/(dashboard)/expenses/new/expense-form.tsx:167-174`
5. User captures photo or uploads image → `src/components/expense/receipt-scanner.tsx:167-203`
6. System converts image to base64 → `src/components/expense/receipt-scanner.tsx:88-99`
7. System sends image to /api/ai/extract endpoint → `src/components/expense/receipt-scanner.tsx:44-48`
8. API checks rate limits before processing → `src/app/api/ai/extract/route.ts:39-56`
9. System calls OpenAI GPT-4o Vision API for OCR → `src/lib/ai/ocr.ts:15-57`
10. AI extracts structured data with confidence score → `src/lib/ai/ocr.ts:64-80`
11. System uploads receipt image to R2 storage → `src/components/expense/receipt-scanner.tsx:58-75`
12. System tracks AI usage (tokens, cost) → `src/lib/ai/ocr.ts:84-93`
13. Extracted data auto-fills expense form fields → `src/app/(dashboard)/expenses/new/expense-form.tsx:86-132`
14. System suggests category based on vendor/description → `src/app/(dashboard)/expenses/new/expense-form.tsx:52-84`
15. User reviews, edits if needed, and submits expense → `src/app/(dashboard)/expenses/new/expense-form.tsx:134-163`
16. System saves expense with receiptUrl reference → `src/app/actions/expense.ts:65-83`

## Key Modules

| Module                     | Purpose                                         | Location                                                   |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| ExpenseForm                | Main expense creation form with scanner trigger | `src/app/(dashboard)/expenses/new/expense-form.tsx`        |
| ReceiptScanner             | Image capture/upload and extraction UI          | `src/components/expense/receipt-scanner.tsx`               |
| ReceiptScannerWithFeedback | Scanner with AI feedback integration            | `src/components/expense/receipt-scanner-with-feedback.tsx` |
| extractFromImage           | GPT-4o Vision OCR extraction                    | `src/lib/ai/ocr.ts:15`                                     |
| extractReceipt             | Text-based extraction with GPT-4o-mini          | `src/lib/ai/extract.ts:54`                                 |
| /api/ai/extract            | Extraction API endpoint with rate limiting      | `src/app/api/ai/extract/route.ts`                          |
| /api/receipts/upload       | R2 image storage endpoint                       | `src/app/api/receipts/upload/route.ts`                     |
| suggestCategory            | Keyword-based category suggestions              | `src/lib/ai/categorize.ts:20`                              |
| AIFeedback                 | User feedback collection component              | `src/components/ai/ai-feedback.tsx`                        |
| checkRateLimit             | Subscription-based usage enforcement            | `src/lib/ai/rate-limiter.ts:120`                           |

## Receipt Scanner Features

### Image Acquisition

- **Camera Capture** → `src/components/expense/receipt-scanner.tsx:167-184`
  - Mobile camera access via `capture="environment"` → `src/components/expense/receipt-scanner.tsx:181`
  - Rear camera default for receipt scanning
  - Hidden file input triggered by button click → `src/components/expense/receipt-scanner.tsx:177-184`

- **File Upload** → `src/components/expense/receipt-scanner.tsx:186-202`
  - Accepts image/\* file types → `src/components/expense/receipt-scanner.tsx:199`
  - Upload button for desktop/gallery selection
  - Supports JPEG, PNG, WebP, HEIC formats → `src/app/api/receipts/upload/route.ts:12`

- **Image Preview** → `src/components/expense/receipt-scanner.tsx:137-156`
  - Next.js Image component with responsive sizing → `src/components/expense/receipt-scanner.tsx:139-146`
  - Loading overlay during OCR processing → `src/components/expense/receipt-scanner.tsx:147-154`
  - Full-width display with object-contain scaling

### AI Extraction

- **Vision API Integration** → `src/lib/ai/ocr.ts:15-114`
  - OpenAI GPT-4o model for image understanding → `src/lib/ai/ocr.ts:19`
  - Structured JSON prompt for Croatian receipts → `src/lib/ai/ocr.ts:34-47`
  - Handles Croatian terms (PDV=VAT, Ukupno=Total) → `src/lib/ai/ocr.ts:47`
  - Max 1000 tokens for response → `src/lib/ai/ocr.ts:56`

- **Data Extraction Fields** → `src/lib/ai/types.ts:1-20`
  - vendor: Business name → `src/lib/ai/types.ts:2`
  - vendorOib: 11-digit tax ID → `src/lib/ai/types.ts:3`
  - date: YYYY-MM-DD format → `src/lib/ai/types.ts:4`
  - items: Array of line items with qty/price → `src/lib/ai/types.ts:5`
  - subtotal, vatAmount, total: Amounts → `src/lib/ai/types.ts:6-8`
  - paymentMethod: cash/card/transfer → `src/lib/ai/types.ts:9`
  - currency: EUR default → `src/lib/ai/types.ts:10`
  - confidence: 0-1 accuracy score → `src/lib/ai/types.ts:11`

- **Response Parsing** → `src/lib/ai/ocr.ts:63-80`
  - Extracts JSON from response text → `src/lib/ai/ocr.ts:65`
  - Handles non-JSON responses gracefully → `src/lib/ai/ocr.ts:66-78`
  - Returns ExtractionResult with success flag → `src/lib/ai/ocr.ts:95`

### Image Storage

- **R2 Upload Flow** → `src/components/expense/receipt-scanner.tsx:58-75`
  - FormData submission to /api/receipts/upload → `src/components/expense/receipt-scanner.tsx:60-66`
  - Returns receiptUrl on success → `src/components/expense/receipt-scanner.tsx:70`
  - Non-blocking (extraction succeeds even if upload fails) → `src/components/expense/receipt-scanner.tsx:72-74`

- **Storage Configuration** → `src/app/api/receipts/upload/route.ts:11-44`
  - Max file size: 10MB → `src/app/api/receipts/upload/route.ts:11`
  - Allowed types: JPEG, PNG, WebP, HEIC, PDF → `src/app/api/receipts/upload/route.ts:12`
  - Validation before upload → `src/app/api/receipts/upload/route.ts:30-44`

- **R2 Key Generation** → `src/lib/r2-client.ts:56-67`
  - Pattern: `attachments/{companyId}/{year}/{month}/{hash}.{ext}` → `src/lib/r2-client.ts:66`
  - Content hash for deduplication → `src/app/api/receipts/upload/route.ts:51`
  - Tenant-isolated storage paths → `src/lib/r2-client.ts:57`

- **Receipt URL Format** → `src/app/api/receipts/upload/route.ts:60-61`
  - Protocol prefix: `receipts://` → `src/app/api/receipts/upload/route.ts:61`
  - Stored in Expense.receiptUrl field → `src/app/actions/expense.ts:81`

### Form Auto-Population

- **Field Mapping** → `src/app/(dashboard)/expenses/new/expense-form.tsx:86-132`
  - vendorName: Direct assignment → `src/app/(dashboard)/expenses/new/expense-form.tsx:88`
  - vendorOib: If present in receipt → `src/app/(dashboard)/expenses/new/expense-form.tsx:89`
  - date: Extracted date → `src/app/(dashboard)/expenses/new/expense-form.tsx:90`
  - netAmount: Calculated from total - VAT → `src/app/(dashboard)/expenses/new/expense-form.tsx:92-97`
  - description: Concatenated items → `src/app/(dashboard)/expenses/new/expense-form.tsx:118-123`
  - receiptUrl: Storage reference → `src/app/(dashboard)/expenses/new/expense-form.tsx:125-128`

- **VAT Rate Detection** → `src/app/(dashboard)/expenses/new/expense-form.tsx:99-105`
  - Calculates rate from extracted amounts → `src/app/(dashboard)/expenses/new/expense-form.tsx:101`
  - Matches to 25%, 13%, or 5% → `src/app/(dashboard)/expenses/new/expense-form.tsx:102-104`
  - Tolerates 1% variance for OCR errors

- **Payment Method Mapping** → `src/app/(dashboard)/expenses/new/expense-form.tsx:107-115`
  - cash → CASH → `src/app/(dashboard)/expenses/new/expense-form.tsx:110`
  - card → CARD → `src/app/(dashboard)/expenses/new/expense-form.tsx:111`
  - transfer → TRANSFER → `src/app/(dashboard)/expenses/new/expense-form.tsx:112`

## Category Suggestions

### Auto-Suggestion Trigger

- **Real-Time Suggestions** → `src/app/(dashboard)/expenses/new/expense-form.tsx:52-84`
  - Triggered on description or vendor change → `src/app/(dashboard)/expenses/new/expense-form.tsx:52`
  - 500ms debounce to reduce API calls → `src/app/(dashboard)/expenses/new/expense-form.tsx:82`
  - Requires at least one field populated → `src/app/(dashboard)/expenses/new/expense-form.tsx:54-56`

- **Suggestion API** → `src/app/api/ai/suggest-category/route.ts:9-66`
  - Calls suggestCategoryByVendor first → `src/app/api/ai/suggest-category/route.ts:38-43`
  - Then suggestCategory for description → `src/app/api/ai/suggest-category/route.ts:45-48`
  - Deduplicates and returns top 3 → `src/app/api/ai/suggest-category/route.ts:50-56`

### Vendor-Based Suggestions

- **Historical Matching** → `src/lib/ai/categorize.ts:49-90`
  - Finds contact by name → `src/lib/ai/categorize.ts:54-62`
  - Queries most recent expense from vendor → `src/lib/ai/categorize.ts:67-78`
  - Returns previous category with 95% confidence → `src/lib/ai/categorize.ts:80-86`
  - Reason: "Prethodno korišteno za {vendor}" → `src/lib/ai/categorize.ts:85`

### Keyword-Based Suggestions

- **Category Keywords** → `src/lib/ai/categorize.ts:5-18`
  - OFFICE: papir, toner, uredski → `src/lib/ai/categorize.ts:6`
  - TRAVEL: gorivo, cestarina, parking → `src/lib/ai/categorize.ts:7`
  - TELECOM: mobitel, internet, A1 → `src/lib/ai/categorize.ts:8`
  - 12 predefined categories with Croatian keywords

- **Matching Algorithm** → `src/lib/ai/categorize.ts:20-47`
  - Case-insensitive matching → `src/lib/ai/categorize.ts:28`
  - Confidence: matches × 0.3, max 0.9 → `src/lib/ai/categorize.ts:40`
  - Includes matched keywords in reason → `src/lib/ai/categorize.ts:36-42`
  - Sorted by confidence, top 3 returned → `src/lib/ai/categorize.ts:46`

### Suggestion UI

- **Badge Display** → `src/app/(dashboard)/expenses/new/expense-form.tsx:216-247`
  - Sparkles icon for AI indication → `src/app/(dashboard)/expenses/new/expense-form.tsx:219`
  - Clickable badges with confidence % → `src/app/(dashboard)/expenses/new/expense-form.tsx:228-237`
  - Hover tooltip with reason → `src/app/(dashboard)/expenses/new/expense-form.tsx:238-242`
  - Auto-selects category on click → `src/app/(dashboard)/expenses/new/expense-form.tsx:231`

## AI Feedback System

### Feedback Component

- **AIFeedback Integration** → `src/components/ai/ai-feedback.tsx:9-229`
  - Three feedback options: correct/incorrect/partial → `src/components/ai/ai-feedback.tsx:32-34`
  - Compact and full display modes → `src/components/ai/ai-feedback.tsx:25`
  - Confidence badge display → `src/components/ai/ai-feedback.tsx:231-260`

- **Feedback Collection Flow** → `src/components/ai/ai-feedback.tsx:36-68`
  - Correct: Submit immediately → `src/components/ai/ai-feedback.tsx:74-76`
  - Incorrect/Partial: Show notes textarea → `src/components/ai/ai-feedback.tsx:71-73`
  - Optional notes submission → `src/components/ai/ai-feedback.tsx:79-83`

- **Confidence Badge** → `src/components/ai/ai-feedback.tsx:236-260`
  - High (≥80%): Green "Visoka pouzdanost" → `src/components/ai/ai-feedback.tsx:242-243`
  - Medium (≥60%): Yellow "Srednja pouzdanost" → `src/components/ai/ai-feedback.tsx:244-245`
  - Low (<60%): Red "Niska pouzdanost" → `src/components/ai/ai-feedback.tsx:246-247`

### Feedback API

- **Submission Endpoint** → `src/app/api/ai/feedback/route.ts:27-81`
  - Validates schema with Zod → `src/app/api/ai/feedback/route.ts:38-45`
  - Stores in AIFeedback table → `src/app/api/ai/feedback/route.ts:62-71`
  - Returns success response → `src/components/ai/ai-feedback.tsx:42-52`

- **Feedback Schema** → `src/app/api/ai/feedback/route.ts:14-21`
  - entityType: "expense" → `src/app/api/ai/feedback/route.ts:15`
  - entityId: Expense ID → `src/app/api/ai/feedback/route.ts:16`
  - operation: ocr_receipt, ocr_invoice, category_suggestion → `src/app/api/ai/feedback/route.ts:17`
  - feedback: correct/incorrect/partial → `src/app/api/ai/feedback/route.ts:18`
  - correction: JSON object (optional) → `src/app/api/ai/feedback/route.ts:19`
  - notes: Free text (optional) → `src/app/api/ai/feedback/route.ts:20`

## Rate Limiting

### Subscription-Based Limits

- **Plan Configuration** → `src/lib/ai/rate-limiter.ts:17-64`
  - pausalni: 100 calls/month, 50 OCR receipts → `src/lib/ai/rate-limiter.ts:25-33`
  - obrtnicki: 500 calls/month, 250 OCR receipts → `src/lib/ai/rate-limiter.ts:34-42`
  - obrt_vat: 1000 calls/month → `src/lib/ai/rate-limiter.ts:43-46`
  - doo_small: 2000 calls/month → `src/lib/ai/rate-limiter.ts:47-50`
  - doo_standard: 5000 calls/month → `src/lib/ai/rate-limiter.ts:51-54`
  - enterprise: Unlimited → `src/lib/ai/rate-limiter.ts:55-58`
  - default/trial: 20 calls → `src/lib/ai/rate-limiter.ts:60-63`

- **Multi-Tier Checks** → `src/lib/ai/rate-limiter.ts:120-256`
  - Per-minute limit: 10 requests → `src/lib/ai/rate-limiter.ts:73`
  - Monthly total calls limit → `src/lib/ai/rate-limiter.ts:172-191`
  - Monthly total cost limit → `src/lib/ai/rate-limiter.ts:194-213`
  - Per-operation limits (if configured) → `src/lib/ai/rate-limiter.ts:216-240`

### Rate Limit Enforcement

- **Pre-Request Check** → `src/app/api/ai/extract/route.ts:39-56`
  - Checks before processing image → `src/app/api/ai/extract/route.ts:41`
  - Returns 429 status if exceeded → `src/app/api/ai/extract/route.ts:48-55`
  - Includes usage stats in response → `src/app/api/ai/extract/route.ts:64`

- **In-Memory Limiter** → `src/lib/ai/rate-limiter.ts:70-115`
  - 1-minute sliding window → `src/lib/ai/rate-limiter.ts:72`
  - Prevents abuse with retryAfter → `src/lib/ai/rate-limiter.ts:94-98`
  - Auto-cleanup of expired entries → `src/lib/ai/rate-limiter.ts:81-83`

### Usage Tracking

- **Token Tracking** → `src/lib/ai/ocr.ts:59-61`
  - Captures prompt_tokens and completion_tokens → `src/lib/ai/ocr.ts:60-61`
  - Tracks per operation (ocr_receipt, extract_receipt) → `src/lib/ai/ocr.ts:70`

- **Cost Calculation** → `src/lib/ai/rate-limiter.ts:194-213`
  - Stored in cents (EUR) → `prisma/schema.prisma:1093`
  - Compared against plan budget limits

- **AIUsage Records** → `prisma/schema.prisma:1086-1100`
  - companyId: Tenant isolation → `prisma/schema.prisma:1088`
  - operation: Operation type → `prisma/schema.prisma:1091`
  - tokensUsed: Total tokens → `prisma/schema.prisma:1092`
  - costCents: EUR cents → `prisma/schema.prisma:1093`
  - model: AI model used → `prisma/schema.prisma:1094`
  - success: Operation result → `prisma/schema.prisma:1095`

## Data

### Database Tables

- **Expense** → `prisma/schema.prisma:345-374`
  - receiptUrl: Storage reference → `prisma/schema.prisma:361`
  - Stores extracted amounts and dates
  - Links to ExpenseCategory and Contact (vendor)
  - Contains all financial fields populated from OCR

- **AIFeedback** → `prisma/schema.prisma:1066-1084`
  - companyId: Tenant context → `prisma/schema.prisma:1068`
  - userId: Feedback submitter → `prisma/schema.prisma:1069`
  - entityType, entityId: Reference to expense → `prisma/schema.prisma:1071-1072`
  - operation: ocr_receipt, etc. → `prisma/schema.prisma:1073`
  - feedback: correct/incorrect/partial → `prisma/schema.prisma:1075`
  - correction: JSON corrections → `prisma/schema.prisma:1076`
  - notes: User notes → `prisma/schema.prisma:1077`

- **AIUsage** → `prisma/schema.prisma:1086-1100`
  - Tracks all AI operations per company
  - Used for rate limiting and billing
  - Indexed by company and operation type

### Data Types

- **ExtractedReceipt** → `src/lib/ai/types.ts:1-12`
  - Interface for OCR output
  - Includes confidence score for validation
  - Extends with receiptUrl after upload → `src/app/(dashboard)/expenses/new/expense-form.tsx:18-20`

- **CategorySuggestion** → `src/lib/ai/types.ts:37-42`
  - categoryId, categoryName: Target category
  - confidence: 0-1 score
  - reason: Human-readable explanation

## Error Handling

### Extraction Errors

- **API Error Display** → `src/components/expense/receipt-scanner.tsx:158-163`
  - Red banner with error message → `src/components/expense/receipt-scanner.tsx:159-161`
  - Allows retry without losing preview

- **Graceful Degradation** → `src/components/expense/receipt-scanner.tsx:72-74`
  - Receipt storage failure doesn't block extraction
  - Logs warning but continues → `src/components/expense/receipt-scanner.tsx:74`

### Rate Limit Errors

- **429 Response Handling** → `src/app/api/ai/extract/route.ts:48-55`
  - Returns usage stats and retry time
  - Includes human-readable reason → `src/lib/ai/rate-limiter.ts:184`

- **Client Error Display** → `src/components/expense/receipt-scanner.tsx:52-54`
  - Shows API error message to user
  - Sets processing state to false

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/(dashboard)/expenses/new/page.tsx:9`
  - [[company-management]] - Company context required → `src/app/(dashboard)/expenses/new/page.tsx:10`
  - [[expense-categories]] - Category selection → `src/app/(dashboard)/expenses/new/page.tsx:23-26`
  - [[contacts]] - Vendor lookup → `src/app/(dashboard)/expenses/new/page.tsx:17-22`
  - [[billing-subscription]] - Rate limit enforcement → `src/lib/ai/rate-limiter.ts:149-162`
  - OpenAI API - GPT-4o Vision and GPT-4o-mini → `src/lib/ai/ocr.ts:6-13`
  - Cloudflare R2 - Image storage → `src/lib/r2-client.ts:5-12`

- **Depended by**:
  - [[expenses-list]] - Created expenses appear in list
  - [[expense-detail]] - Receipts viewable from expense detail
  - [[expense-analytics]] - OCR data used in reporting

## Integrations

### OpenAI Integration

- **GPT-4o Vision** → `src/lib/ai/ocr.ts:19`
  - Primary OCR model for images
  - Vision capabilities for receipt scanning
  - 1000 token max response

- **GPT-4o-mini** → `src/lib/ai/extract.ts:58`
  - Text extraction (fallback)
  - JSON mode enabled → `src/lib/ai/extract.ts:70`
  - Lower cost alternative

### R2 Storage Integration

- **S3-Compatible API** → `src/lib/r2-client.ts:5-12`
  - Cloudflare R2 endpoint
  - AWS SDK v3 client
  - Tenant-isolated buckets

- **Upload Command** → `src/lib/r2-client.ts:16-30`
  - PutObjectCommand with content type
  - Returns storage key

## Verification Checklist

- [ ] User can access receipt scanner from /expenses/new
- [ ] Camera capture works on mobile devices
- [ ] File upload accepts image files
- [ ] Image preview displays before processing
- [ ] OCR extraction returns structured data
- [ ] Extracted data populates form fields correctly
- [ ] VAT rate detection matches common rates (25%, 13%, 5%)
- [ ] Receipt images upload to R2 storage
- [ ] Receipt URL saved with expense record
- [ ] Category suggestions appear based on vendor
- [ ] Keyword-based suggestions work for descriptions
- [ ] Clicking suggestion badge selects category
- [ ] AI confidence score displays correctly
- [ ] Feedback component allows correct/incorrect/partial
- [ ] Notes textarea appears for incorrect feedback
- [ ] Feedback submissions save to database
- [ ] Rate limiting enforces per-minute limits
- [ ] Rate limiting enforces monthly subscription limits
- [ ] 429 errors display with retry information
- [ ] AI usage tracked in AIUsage table
- [ ] Error messages display for failed extractions
- [ ] Receipt storage failure doesn't block extraction
- [ ] Tenant isolation prevents cross-company access
- [ ] Payment method mapping works correctly
- [ ] Item concatenation creates readable description

## Evidence Links

1. Entry point page → `src/app/(dashboard)/expenses/new/page.tsx:8`
2. Expense form component → `src/app/(dashboard)/expenses/new/expense-form.tsx:27`
3. Receipt scanner component → `src/components/expense/receipt-scanner.tsx:19`
4. Receipt scanner with feedback → `src/components/expense/receipt-scanner-with-feedback.tsx:21`
5. OCR extraction function → `src/lib/ai/ocr.ts:15`
6. Text extraction function → `src/lib/ai/extract.ts:54`
7. Extraction API endpoint → `src/app/api/ai/extract/route.ts:11`
8. Receipt upload API → `src/app/api/receipts/upload/route.ts:14`
9. R2 client integration → `src/lib/r2-client.ts:16`
10. Category suggestion algorithm → `src/lib/ai/categorize.ts:20`
11. Vendor-based suggestions → `src/lib/ai/categorize.ts:49`
12. Suggestion API endpoint → `src/app/api/ai/suggest-category/route.ts:9`
13. AI feedback component → `src/components/ai/ai-feedback.tsx:19`
14. Feedback API endpoint → `src/app/api/ai/feedback/route.ts:27`
15. Rate limiter implementation → `src/lib/ai/rate-limiter.ts:120`
16. Plan limits configuration → `src/lib/ai/rate-limiter.ts:17`
17. Create expense action → `src/app/actions/expense.ts:33`
18. Expense schema definition → `prisma/schema.prisma:345`
19. AIFeedback schema → `prisma/schema.prisma:1066`
20. AIUsage schema → `prisma/schema.prisma:1086`
21. ExtractedReceipt type → `src/lib/ai/types.ts:1`
22. CategorySuggestion type → `src/lib/ai/types.ts:37`
23. Form auto-population logic → `src/app/(dashboard)/expenses/new/expense-form.tsx:86`
24. Category suggestion UI → `src/app/(dashboard)/expenses/new/expense-form.tsx:216`
25. R2 key generation → `src/lib/r2-client.ts:56`
