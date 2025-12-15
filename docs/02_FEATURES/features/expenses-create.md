# Feature: Create Expense (F029)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 26

## Purpose

The Create Expense feature enables users to record business expenses with AI-powered receipt scanning, automatic category suggestions, VAT calculation, and vendor management. The feature includes OCR extraction from receipt images, intelligent category recommendations based on description and vendor history, automatic status assignment based on payment method, and R2 cloud storage for receipt attachments, forming the core expense tracking workflow in FiskAI.

## User Entry Points

| Type   | Path           | Evidence                                                    |
| ------ | -------------- | ----------------------------------------------------------- |
| Page   | /expenses/new  | `src/app/(dashboard)/expenses/new/page.tsx:8`               |
| Action | createExpense  | `src/app/actions/expense.ts:33`                             |
| Button | Skeniraj račun | `src/app/(dashboard)/expenses/new/expense-form.tsx:192-199` |

## Core Flow

1. User navigates to /expenses/new → `src/app/(dashboard)/expenses/new/page.tsx:8`
2. System validates user authentication with requireAuth() → `src/app/(dashboard)/expenses/new/page.tsx:9`
3. System retrieves current company via requireCompany() → `src/app/(dashboard)/expenses/new/page.tsx:10`
4. System sets tenant context for data isolation → `src/app/(dashboard)/expenses/new/page.tsx:12-15`
5. System fetches vendors (SUPPLIER/BOTH contacts) and expense categories in parallel → `src/app/(dashboard)/expenses/new/page.tsx:17-27`
6. System renders ExpenseForm with pre-populated data → `src/app/(dashboard)/expenses/new/page.tsx:38`
7. User optionally scans receipt using camera/upload → `src/app/(dashboard)/expenses/new/expense-form.tsx:192-199`
8. System extracts receipt data via OpenAI GPT-4o OCR → `src/lib/ai/ocr.ts:15-114`
9. System uploads receipt image to R2 storage → `src/app/api/receipts/upload/route.ts:14-82`
10. System auto-fills form with extracted data → `src/app/(dashboard)/expenses/new/expense-form.tsx:86-132`
11. System suggests categories based on description/vendor → `src/app/api/ai/suggest-category/route.ts:9-66`
12. User fills/reviews expense details (category, amounts, dates) → `src/app/(dashboard)/expenses/new/expense-form.tsx:202-330`
13. User submits form, triggering client-side validation → `src/app/(dashboard)/expenses/new/expense-form.tsx:134-139`
14. System calls createExpense server action with tenant context → `src/app/actions/expense.ts:33-93`
15. System validates category and vendor existence → `src/app/actions/expense.ts:38-62`
16. System determines status (PAID if payment method, else DRAFT) → `src/app/actions/expense.ts:64`
17. System creates Expense with Decimal precision → `src/app/actions/expense.ts:66-84`
18. System revalidates /expenses route cache → `src/app/actions/expense.ts:86`
19. User redirected to /expenses with success notification → `src/app/(dashboard)/expenses/new/expense-form.tsx:158-159`

## Key Modules

| Module                    | Purpose                                          | Location                                            |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| NewExpensePage            | Server component for expense creation page       | `src/app/(dashboard)/expenses/new/page.tsx`         |
| ExpenseForm               | Client form with AI suggestions and OCR scanning | `src/app/(dashboard)/expenses/new/expense-form.tsx` |
| createExpense             | Server action for expense creation               | `src/app/actions/expense.ts:33-93`                  |
| ReceiptScanner            | Camera/upload component for receipt scanning     | `src/components/expense/receipt-scanner.tsx`        |
| extractFromImage          | OpenAI GPT-4o OCR extraction                     | `src/lib/ai/ocr.ts:15-114`                          |
| suggestCategory           | Keyword-based category suggestions               | `src/lib/ai/categorize.ts:20-47`                    |
| suggestCategoryByVendor   | Vendor history-based suggestions                 | `src/lib/ai/categorize.ts:49-90`                    |
| uploadToR2                | R2 cloud storage for receipt images              | `src/app/api/receipts/upload/route.ts:14-82`        |
| requireCompanyWithContext | Tenant-isolated database operations wrapper      | `src/lib/auth-utils.ts:75-89`                       |

## Expense Form Features

### Basic Information Fields

- **Category Selection** → `src/app/(dashboard)/expenses/new/expense-form.tsx:205-215`
  - Dropdown populated from ExpenseCategory table → `src/app/(dashboard)/expenses/new/page.tsx:23-26`
  - Includes global categories (companyId: null) and company-specific → `src/app/(dashboard)/expenses/new/page.tsx:24`
  - Auto-sets VAT deductible default from category → `src/app/(dashboard)/expenses/new/expense-form.tsx:212`
  - Required field validation → `src/app/(dashboard)/expenses/new/expense-form.tsx:136`

- **AI Category Suggestions** → `src/app/(dashboard)/expenses/new/expense-form.tsx:216-247`
  - Real-time suggestions as user types → `src/app/(dashboard)/expenses/new/expense-form.tsx:52-84`
  - 500ms debounce to avoid excessive API calls → `src/app/(dashboard)/expenses/new/expense-form.tsx:82`
  - Keyword-based matching → `src/lib/ai/categorize.ts:20-47`
  - Vendor history matching (95% confidence) → `src/lib/ai/categorize.ts:49-90`
  - Confidence percentage display → `src/app/(dashboard)/expenses/new/expense-form.tsx:235`
  - Hover tooltip with reasoning → `src/app/(dashboard)/expenses/new/expense-form.tsx:238-242`
  - Top 3 suggestions shown → `src/app/api/ai/suggest-category/route.ts:56`

- **Vendor Selection** → `src/app/(dashboard)/expenses/new/expense-form.tsx:249-255`
  - Dropdown populated from Contact table → `src/app/(dashboard)/expenses/new/page.tsx:18-22`
  - Filtered by type: SUPPLIER or BOTH → `src/app/(dashboard)/expenses/new/page.tsx:19`
  - Optional field (allows "Nepoznat" vendor) → `src/app/(dashboard)/expenses/new/expense-form.tsx:252`
  - Auto-fills vendorName state → `src/app/(dashboard)/expenses/new/expense-form.tsx:251`

- **Vendor OIB** → `src/app/(dashboard)/expenses/new/expense-form.tsx:256-259`
  - Optional 11-digit tax identification → `src/app/(dashboard)/expenses/new/expense-form.tsx:258`
  - Auto-filled from OCR extraction → `src/app/(dashboard)/expenses/new/expense-form.tsx:89`

- **Description** → `src/app/(dashboard)/expenses/new/expense-form.tsx:260-263`
  - Required text field → `src/app/(dashboard)/expenses/new/expense-form.tsx:262`
  - Auto-filled from receipt items → `src/app/(dashboard)/expenses/new/expense-form.tsx:117-123`
  - Triggers category suggestions → `src/app/(dashboard)/expenses/new/expense-form.tsx:52-84`

- **Date Fields** → `src/app/(dashboard)/expenses/new/expense-form.tsx:264-271`
  - Date (defaults to today) → `src/app/(dashboard)/expenses/new/expense-form.tsx:37`
  - Due Date (optional) → `src/app/(dashboard)/expenses/new/expense-form.tsx:38`
  - Auto-extracted from receipt → `src/app/(dashboard)/expenses/new/expense-form.tsx:90`

### Amount Fields

- **Financial Calculations** → `src/app/(dashboard)/expenses/new/expense-form.tsx:47-49`
  - Net amount input (EUR) → `src/app/(dashboard)/expenses/new/expense-form.tsx:279-281`
  - VAT calculated as net × (vatRate / 100) → `src/app/(dashboard)/expenses/new/expense-form.tsx:48`
  - Total calculated as net + VAT → `src/app/(dashboard)/expenses/new/expense-form.tsx:49`
  - Real-time updates on input changes → `src/app/(dashboard)/expenses/new/expense-form.tsx:47-49`

- **VAT Configuration** → `src/app/(dashboard)/expenses/new/expense-form.tsx:282-296`
  - VAT rate dropdown (25%, 13%, 5%, 0%) → `src/app/(dashboard)/expenses/new/expense-form.tsx:284-289`
  - Defaults to 25% → `src/app/(dashboard)/expenses/new/expense-form.tsx:41`
  - VAT deductible checkbox → `src/app/(dashboard)/expenses/new/expense-form.tsx:292-295`
  - Auto-set from category default → `src/app/(dashboard)/expenses/new/expense-form.tsx:212`
  - Auto-detected from OCR extraction → `src/app/(dashboard)/expenses/new/expense-form.tsx:100-105`

- **Totals Display** → `src/app/(dashboard)/expenses/new/expense-form.tsx:298-306`
  - Net amount display → `src/app/(dashboard)/expenses/new/expense-form.tsx:301`
  - VAT amount display → `src/app/(dashboard)/expenses/new/expense-form.tsx:302`
  - Total amount with bold styling → `src/app/(dashboard)/expenses/new/expense-form.tsx:303`
  - Croatian currency formatting (EUR) → `src/app/(dashboard)/expenses/new/expense-form.tsx:165`

### Receipt Scanning

- **Scanner UI** → `src/app/(dashboard)/expenses/new/expense-form.tsx:167-174`
  - Camera capture button → `src/components/expense/receipt-scanner.tsx:167-184`
  - File upload button → `src/components/expense/receipt-scanner.tsx:186-203`
  - Image preview with loading overlay → `src/components/expense/receipt-scanner.tsx:137-156`
  - Receipt attached indicator → `src/app/(dashboard)/expenses/new/expense-form.tsx:179-190`

- **OCR Extraction** → `src/lib/ai/ocr.ts:15-114`
  - OpenAI GPT-4o model for vision → `src/lib/ai/ocr.ts:19`
  - Base64 image processing → `src/components/expense/receipt-scanner.tsx:40-41`
  - Extracts: vendor, OIB, date, items, amounts, payment method → `src/lib/ai/ocr.ts:34-46`
  - Croatian language context awareness → `src/lib/ai/ocr.ts:47`
  - Confidence scoring (0-1) → `src/lib/ai/ocr.ts:45`
  - Token usage tracking → `src/lib/ai/ocr.ts:59-92`

- **Receipt Upload** → `src/app/api/receipts/upload/route.ts:14-82`
  - R2 cloud storage integration → `src/app/api/receipts/upload/route.ts:56-57`
  - File type validation (JPEG, PNG, WEBP, HEIC, PDF) → `src/app/api/receipts/upload/route.ts:12`
  - 10MB file size limit → `src/app/api/receipts/upload/route.ts:11`
  - SHA-256 content hashing for deduplication → `src/app/api/receipts/upload/route.ts:51`
  - Receipt URL generation (receipts:// protocol) → `src/app/api/receipts/upload/route.ts:61`
  - Stored in Expense.receiptUrl → `src/app/actions/expense.ts:82`

- **Auto-fill Logic** → `src/app/(dashboard)/expenses/new/expense-form.tsx:86-132`
  - Vendor name and OIB → `src/app/(dashboard)/expenses/new/expense-form.tsx:88-89`
  - Date extraction → `src/app/(dashboard)/expenses/new/expense-form.tsx:90`
  - Net amount calculation (total - VAT) → `src/app/(dashboard)/expenses/new/expense-form.tsx:92-97`
  - VAT rate detection (±1% tolerance) → `src/app/(dashboard)/expenses/new/expense-form.tsx:100-105`
  - Payment method mapping → `src/app/(dashboard)/expenses/new/expense-form.tsx:107-115`
  - Items description concatenation → `src/app/(dashboard)/expenses/new/expense-form.tsx:117-123`
  - Receipt URL storage → `src/app/(dashboard)/expenses/new/expense-form.tsx:126-128`

### Payment Information

- **Payment Method** → `src/app/(dashboard)/expenses/new/expense-form.tsx:309-323`
  - Dropdown: Nije plaćeno, Gotovina, Kartica, Virman, Ostalo → `src/app/(dashboard)/expenses/new/expense-form.tsx:315-319`
  - Maps to PaymentMethod enum (CASH, CARD, TRANSFER, OTHER) → `src/app/actions/expense.ts:79`
  - Auto-extracted from receipt → `src/app/(dashboard)/expenses/new/expense-form.tsx:107-115`
  - Determines expense status (PAID vs DRAFT) → `src/app/actions/expense.ts:64`

- **Status Assignment** → `src/app/actions/expense.ts:64`
  - PAID if payment method provided → `src/app/actions/expense.ts:64`
  - DRAFT if no payment method → `src/app/actions/expense.ts:64`
  - Payment date set to current time if PAID → `src/app/actions/expense.ts:80`

### Notes Field

- **Optional Notes Textarea** → `src/app/(dashboard)/expenses/new/expense-form.tsx:325-330`
  - 3 rows, unlimited length → `src/app/(dashboard)/expenses/new/expense-form.tsx:328`
  - Stored in Expense.notes → `src/app/actions/expense.ts:81`

## Server-Side Processing

### Authentication & Tenant Isolation

- **Multi-Layer Security** → `src/app/actions/expense.ts:35-37`
  - requireAuth() validates session → `src/lib/auth-utils.ts:12-18`
  - requireCompanyWithContext() enforces tenant scope → `src/lib/auth-utils.ts:75-89`
  - runWithTenant() wraps database operations → `src/lib/auth-utils.ts:86-88`
  - All queries auto-filtered by companyId → `src/lib/prisma-extensions.ts:52-76`

### Category Validation

- **Special Handling for Global Categories** → `src/app/actions/expense.ts:38-52`
  - Explicit OR query (companyId OR null) → `src/app/actions/expense.ts:46`
  - Cannot use tenant middleware (global categories have companyId: null) → `src/app/actions/expense.ts:40-42`
  - Company-specific categories tenant-isolated → `src/app/actions/expense.ts:46`
  - Returns error if category not found → `src/app/actions/expense.ts:50-52`

### Vendor Validation

- **Optional Vendor Check** → `src/app/actions/expense.ts:54-62`
  - Only validates if vendorId provided → `src/app/actions/expense.ts:55`
  - Automatically filtered by tenant context → `src/app/actions/expense.ts:56-58`
  - Returns error if vendor not found → `src/app/actions/expense.ts:59-61`
  - Allows null vendor (unknown supplier) → `src/app/actions/expense.ts:69`

### Database Transaction

- **Expense Creation** → `src/app/actions/expense.ts:66-84`
  - Creates Expense record → `src/app/actions/expense.ts:66`
  - Links to category (required) → `src/app/actions/expense.ts:68`
  - Links to vendor (optional) → `src/app/actions/expense.ts:69`
  - Sets description and dates → `src/app/actions/expense.ts:70-72`
  - Decimal precision for amounts → `src/app/actions/expense.ts:73-75`
  - VAT deductible flag (defaults to true) → `src/app/actions/expense.ts:76`
  - Currency (defaults to EUR) → `src/app/actions/expense.ts:77`
  - Status (PAID or DRAFT) → `src/app/actions/expense.ts:78`
  - Payment method and date → `src/app/actions/expense.ts:79-80`
  - Notes and receipt URL → `src/app/actions/expense.ts:81-82`
  - Auto-adds companyId via tenant middleware → `src/lib/prisma-extensions.ts:52-76`

## Validation

### Client-Side Validation

1. **Required Fields** → `src/app/(dashboard)/expenses/new/expense-form.tsx:136-138`
   - Category must be selected → `src/app/(dashboard)/expenses/new/expense-form.tsx:136`
   - Description required → `src/app/(dashboard)/expenses/new/expense-form.tsx:137`
   - Net amount must be > 0 → `src/app/(dashboard)/expenses/new/expense-form.tsx:138`

2. **Input Constraints** → `src/app/(dashboard)/expenses/new/expense-form.tsx:258-280`
   - OIB max 11 characters → `src/app/(dashboard)/expenses/new/expense-form.tsx:258`
   - Net amount: min=0, step=0.01 → `src/app/(dashboard)/expenses/new/expense-form.tsx:280`
   - Date fields required → `src/app/(dashboard)/expenses/new/expense-form.tsx:266`

### Server-Side Validation

1. **Authentication** → `src/app/actions/expense.ts:35`
   - Session validation via requireAuth()

2. **Category Verification** → `src/app/actions/expense.ts:43-52`
   - Category exists and accessible (company or global)
   - Returns error if not found

3. **Vendor Verification** → `src/app/actions/expense.ts:55-62`
   - Vendor belongs to company (tenant-filtered query)
   - Returns error if vendor not found

## AI Features

### Category Suggestions

- **Keyword Matching** → `src/lib/ai/categorize.ts:5-18`
  - 12 categories with Croatian keywords → `src/lib/ai/categorize.ts:6-17`
  - Case-insensitive matching → `src/lib/ai/categorize.ts:28`
  - Confidence: 0.3 per keyword match (max 0.9) → `src/lib/ai/categorize.ts:40`
  - Shows matched keywords in reason → `src/lib/ai/categorize.ts:36-41`
  - Top 3 suggestions returned → `src/lib/ai/categorize.ts:46`

- **Vendor History** → `src/lib/ai/categorize.ts:49-90`
  - Finds contact by name (case-insensitive) → `src/lib/ai/categorize.ts:54-62`
  - Queries previous expenses from vendor → `src/lib/ai/categorize.ts:67-78`
  - Returns most recent category used → `src/lib/ai/categorize.ts:80-86`
  - 95% confidence for vendor matches → `src/lib/ai/categorize.ts:84`
  - Reason: "Prethodno korišteno za {vendor}" → `src/lib/ai/categorize.ts:85`

### OCR Extraction

- **Image Processing** → `src/lib/ai/ocr.ts:15-114`
  - OpenAI GPT-4o model → `src/lib/ai/ocr.ts:19`
  - Vision API with image_url content type → `src/lib/ai/ocr.ts:50-52`
  - 1000 max tokens → `src/lib/ai/ocr.ts:56`
  - JSON extraction from response → `src/lib/ai/ocr.ts:65`
  - Structured data: vendor, OIB, items, amounts → `src/lib/ai/ocr.ts:34-46`
  - Croatian context handling → `src/lib/ai/ocr.ts:47`

- **Rate Limiting** → `src/app/api/ai/extract/route.ts:39-56`
  - Checks before processing → `src/app/api/ai/extract/route.ts:41`
  - Operation: 'ocr_receipt' or 'extract_receipt' → `src/app/api/ai/extract/route.ts:40`
  - Returns 429 if exceeded → `src/app/api/ai/extract/route.ts:48-55`
  - Usage statistics returned → `src/app/api/ai/extract/route.ts:51`

- **Usage Tracking** → `src/lib/ai/ocr.ts:59-106`
  - Tracks input/output tokens → `src/lib/ai/ocr.ts:60-61`
  - Records success/failure → `src/lib/ai/ocr.ts:74`
  - Links to companyId → `src/lib/ai/ocr.ts:85`
  - Operation: 'ocr_receipt' → `src/lib/ai/ocr.ts:70`
  - Model: 'gpt-4o' → `src/lib/ai/ocr.ts:88`

## Data

### Database Tables

- **Expense** → `prisma/schema.prisma:345-374`
  - Primary expense record with financial data
  - Key fields:
    - categoryId: Foreign key to ExpenseCategory (required) → `prisma/schema.prisma:349`
    - vendorId: Foreign key to Contact (optional) → `prisma/schema.prisma:348`
    - description: Expense description → `prisma/schema.prisma:350`
    - date: Expense date → `prisma/schema.prisma:351`
    - dueDate: Payment due date (optional) → `prisma/schema.prisma:352`
    - netAmount: Decimal(10,2) → `prisma/schema.prisma:353`
    - vatAmount: Decimal(10,2) → `prisma/schema.prisma:354`
    - totalAmount: Decimal(10,2) → `prisma/schema.prisma:355`
    - vatDeductible: Boolean, default true → `prisma/schema.prisma:356`
    - currency: Default EUR → `prisma/schema.prisma:357`
    - status: ExpenseStatus (DRAFT, PENDING, PAID, CANCELLED) → `prisma/schema.prisma:358`
    - paymentMethod: PaymentMethod enum (optional) → `prisma/schema.prisma:359`
    - paymentDate: DateTime (optional) → `prisma/schema.prisma:360`
    - receiptUrl: Storage reference (optional) → `prisma/schema.prisma:361`
    - notes: Optional text → `prisma/schema.prisma:362`
  - Indexes: companyId, date, status, categoryId → `prisma/schema.prisma:370-373`

- **ExpenseCategory** → `prisma/schema.prisma:376-390`
  - Category definitions (global and company-specific)
  - Key fields:
    - companyId: Null for global categories → `prisma/schema.prisma:378`
    - name: Display name → `prisma/schema.prisma:379`
    - code: Uppercase identifier → `prisma/schema.prisma:380`
    - vatDeductibleDefault: Default VAT setting → `prisma/schema.prisma:381`
    - isActive: Boolean → `prisma/schema.prisma:382`
  - Unique constraint: (companyId, code) → `prisma/schema.prisma:388`
  - Global categories accessible to all tenants → `src/app/(dashboard)/expenses/new/page.tsx:24`

- **Contact** → `prisma/schema.prisma:148-171`
  - Vendor information
  - Type filter: SUPPLIER or BOTH → `src/app/(dashboard)/expenses/new/page.tsx:19`
  - Used in vendor dropdown → `src/app/(dashboard)/expenses/new/expense-form.tsx:249-255`
  - Links to expenses via vendorId → `prisma/schema.prisma:368`

### Data Flow

1. **Page Load** → `src/app/(dashboard)/expenses/new/page.tsx:17-27`
   - Fetch SUPPLIER/BOTH contacts (id, name) ordered by name
   - Fetch active expense categories (global + company-specific) ordered by name
   - Pass to ExpenseForm component

2. **Receipt Scanning** → `src/components/expense/receipt-scanner.tsx:27-86`
   - User captures/uploads image
   - Convert to base64 → `src/components/expense/receipt-scanner.tsx:41`
   - POST to /api/ai/extract → `src/components/expense/receipt-scanner.tsx:44-48`
   - Upload to /api/receipts/upload → `src/components/expense/receipt-scanner.tsx:60-66`
   - Return extracted data + receiptUrl → `src/components/expense/receipt-scanner.tsx:77`

3. **Category Suggestions** → `src/app/(dashboard)/expenses/new/expense-form.tsx:52-84`
   - Debounced on description/vendor change (500ms)
   - POST to /api/ai/suggest-category
   - Receive top 3 suggestions with confidence
   - Display as clickable badges

4. **Form Submission** → `src/app/(dashboard)/expenses/new/expense-form.tsx:134-163`
   - Collect form state (category, vendor, amounts, dates, notes, receiptUrl)
   - Convert string dates to Date objects → `src/app/(dashboard)/expenses/new/expense-form.tsx:145-146`
   - Send to createExpense action
   - Handle success/error responses

5. **Server Processing** → `src/app/actions/expense.ts:33-93`
   - Validate category and vendor
   - Determine status from payment method
   - Create expense with Decimal precision
   - Revalidate route cache
   - Return success result

## Enums

### ExpenseStatus

- **Values** → `prisma/schema.prisma:834-839`
  - DRAFT: Not yet paid
  - PENDING: Awaiting payment
  - PAID: Payment completed
  - CANCELLED: Expense cancelled

### PaymentMethod

- **Values** → `prisma/schema.prisma:841-846`
  - CASH: Gotovina
  - CARD: Kartica
  - TRANSFER: Virman
  - OTHER: Ostalo

### ContactType

- **Values** → `prisma/schema.prisma:792-796`
  - CUSTOMER: Only buyer
  - SUPPLIER: Only vendor
  - BOTH: Can be buyer or vendor

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/(dashboard)/expenses/new/page.tsx:9`
  - [[company-management]] - Company must exist → `src/app/(dashboard)/expenses/new/page.tsx:10`
  - [[contacts]] - Vendor selection requires SUPPLIER/BOTH contacts → `src/app/(dashboard)/expenses/new/page.tsx:18-22`
  - [[expense-categories]] - Category selection required → `src/app/(dashboard)/expenses/new/page.tsx:23-26`
  - [[openai-integration]] - OCR and extraction → `src/lib/ai/ocr.ts:6-13`
  - [[r2-storage]] - Receipt upload → `src/app/api/receipts/upload/route.ts:7`
  - [[ai-rate-limiting]] - Usage tracking and limits → `src/app/api/ai/extract/route.ts:9`

- **Depended by**:
  - [[expenses-list]] - Redirects to expense list on success → `src/app/(dashboard)/expenses/new/expense-form.tsx:159`
  - [[expense-detail]] - Created expenses viewable at /expenses/:id
  - [[ai-usage-tracking]] - Tracks OCR and category suggestion usage
  - [[expense-reports]] - Expenses included in financial reports

## Integrations

### OpenAI Integration

- **GPT-4o OCR** → `src/lib/ai/ocr.ts:15-114`
  - Vision model for receipt extraction
  - Structured JSON output
  - Token usage tracking
  - Croatian language support

- **GPT-4o-mini Extraction** → `src/lib/ai/extract.ts:54-126`
  - Text-based receipt parsing
  - Fallback for OCR failures
  - Lower cost alternative

### R2 Cloud Storage

- **Receipt Upload** → `src/app/api/receipts/upload/route.ts:14-82`
  - Cloudflare R2 integration
  - SHA-256 content hashing
  - Deduplication by content hash
  - receipts:// URL protocol
  - 10MB file size limit
  - Multiple format support (JPEG, PNG, WEBP, HEIC, PDF)

### Category Suggestion System

- **Keyword Matching** → `src/lib/ai/categorize.ts:5-47`
  - 12 predefined categories with Croatian keywords
  - No external AI required
  - Fast, local processing

- **Vendor History** → `src/lib/ai/categorize.ts:49-90`
  - Database-driven suggestions
  - High confidence (95%) for repeated vendors
  - Tenant-isolated queries

### Toast Notifications

- **Sonner Integration** → `src/lib/toast.ts:1-32`
  - Success: "Trošak je spremljen" → `src/app/(dashboard)/expenses/new/expense-form.tsx:158`
  - Success: "Podaci uspješno izvučeni iz računa!" → `src/app/(dashboard)/expenses/new/expense-form.tsx:131`
  - Error: Validation messages → `src/app/(dashboard)/expenses/new/expense-form.tsx:136-138`
  - Error: Server-side errors → `src/app/actions/expense.ts:51,61,91`

## Verification Checklist

- [ ] User can access /expenses/new with authentication
- [ ] Vendors dropdown populates with SUPPLIER/BOTH contacts only
- [ ] Categories dropdown shows global and company-specific categories
- [ ] Receipt scanner opens camera/file picker
- [ ] OCR extraction auto-fills form fields
- [ ] Receipt uploaded to R2 storage successfully
- [ ] Category suggestions appear while typing description
- [ ] Vendor history suggestions prioritized (95% confidence)
- [ ] VAT calculations update in real-time
- [ ] VAT deductible auto-set from category default
- [ ] Client validation prevents submission of invalid data
- [ ] Category validation ensures global/company categories accessible
- [ ] Vendor validation enforces tenant isolation
- [ ] Payment method determines status (PAID vs DRAFT)
- [ ] Expense created with Decimal precision
- [ ] Payment date set automatically when payment method selected
- [ ] User redirected to /expenses on success
- [ ] Toast notification displayed on success/error
- [ ] Tenant isolation prevents cross-company access
- [ ] Currency defaults to EUR
- [ ] Notes field optional
- [ ] AI usage tracked for rate limiting
- [ ] Receipt URL stored in expense record

## Evidence Links

1. Entry point page component → `src/app/(dashboard)/expenses/new/page.tsx:8`
2. Expense form client component → `src/app/(dashboard)/expenses/new/expense-form.tsx:27`
3. Server action for creation → `src/app/actions/expense.ts:33`
4. Receipt scanner component → `src/components/expense/receipt-scanner.tsx:19`
5. OCR extraction logic → `src/lib/ai/ocr.ts:15`
6. Category suggestion API → `src/app/api/ai/suggest-category/route.ts:9`
7. Keyword-based categorization → `src/lib/ai/categorize.ts:20`
8. Vendor history suggestions → `src/lib/ai/categorize.ts:49`
9. Receipt upload API → `src/app/api/receipts/upload/route.ts:14`
10. Expense schema definition → `prisma/schema.prisma:345`
11. ExpenseCategory schema → `prisma/schema.prisma:376`
12. Contact model for vendors → `prisma/schema.prisma:148`
13. ExpenseStatus enum → `prisma/schema.prisma:834`
14. PaymentMethod enum → `prisma/schema.prisma:841`
15. ContactType enum → `prisma/schema.prisma:792`
16. Category validation logic → `src/app/actions/expense.ts:43`
17. Vendor validation logic → `src/app/actions/expense.ts:56`
18. Status determination → `src/app/actions/expense.ts:64`
19. Database create transaction → `src/app/actions/expense.ts:66`
20. Route revalidation → `src/app/actions/expense.ts:86`
21. Success redirect → `src/app/(dashboard)/expenses/new/expense-form.tsx:159`
22. Tenant context wrapper → `src/lib/auth-utils.ts:75`
23. AI extraction API → `src/app/api/ai/extract/route.ts:11`
24. Auto-fill logic → `src/app/(dashboard)/expenses/new/expense-form.tsx:86`
25. Category suggestions UI → `src/app/(dashboard)/expenses/new/expense-form.tsx:216`
26. Totals calculation → `src/app/(dashboard)/expenses/new/expense-form.tsx:47`
