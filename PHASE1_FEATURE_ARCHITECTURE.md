# Phase 1 MVP - Feature Architecture & Data Flow Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FiskAI Platform                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CLIENT LAYER (Browser)                                             │
│  ├── Invoice Form (new: IBAN field)                                 │
│  ├── PDF Preview with QR barcode                                    │
│  ├── Bank Statement Upload (new)                                    │
│  └── Reconciliation Dashboard (new)                                 │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  SERVER LAYER (Next.js)                                             │
│  ├─ generateISO20022Barcode()           [NEW - Barcode]             │
│  ├─ fiscalizeInvoice() → FINA           [UPDATED - Real API]        │
│  ├─ parseCSV() + matchTransactions()    [NEW - Reconciliation]      │
│  └─ recurseTransaction() → EInvoice     [NEW - Match & update]      │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  EXTERNAL APIS                                                       │
│  ├─ FINA (Croatian E-Invoicing)         [Real UBL XML submission]   │
│  └─ Banks (CSV export)                  [Erste, Raiffeisenbank, etc]│
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  DATABASE (PostgreSQL)                                              │
│  ├─ EInvoice (updated: +bankAccount, +includeBarcode)              │
│  ├─ EInvoiceLine                                                    │
│  ├─ BankTransaction (NEW)                                          │
│  ├─ BankImport (NEW)                                               │
│  └─ AuditLog                                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: 2D Barcode Payment (ISO 20022)

### Data Flow Diagram

```
┌──────────────────┐
│  User creates    │
│  invoice with    │  Step 1: Input IBAN
│  buyer/items     │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Invoice Form                             │
│  ├─ Buyer info                           │
│  ├─ Line items                           │
│  ├─ [NEW] IBAN input field               │
│  │   └─ Validation: ^HR\d{2}\d{17}$      │
│  └─ [NEW] includeBarcode checkbox        │
└────────┬─────────────────────────────────┘
         │
         ▼ Step 2: Submit
┌──────────────────────────────────────────┐
│  createEInvoice() server action          │
│  ├─ Save invoice (incl. bankAccount)     │
│  ├─ Generate PDF                         │
│  └─ If includeBarcode=true:              │
│      └─ generateISO20022Barcode()        │
└────────┬─────────────────────────────────┘
         │
         ▼ Step 3: Generate QR
┌──────────────────────────────────────────┐
│  generateISO20022Barcode()               │
│  ├─ Input: EInvoice, IBAN                │
│  ├─ Create ISO 20022 XML structure:      │
│  │   ├─ Creditor: Company IBAN + name    │
│  │   ├─ Debtor ref: Invoice number       │
│  │   ├─ Amount: invoice.grossAmount      │
│  │   └─ Date: issueDate + dueDate        │
│  ├─ Encode XML → QR code                 │
│  └─ Output: SVG string (40x40mm)         │
└────────┬─────────────────────────────────┘
         │
         ▼ Step 4: Embed in PDF
┌──────────────────────────────────────────┐
│  Invoice PDF Template                    │
│  ├─ Header: Invoice number               │
│  ├─ Body: Line items table               │
│  ├─ Summary: Amounts                     │
│  └─ Footer:                              │
│      ├─ Barcode image (40x40mm QR)       │
│      ├─ Label: "Plaćanje QR kodom"       │
│      └─ Fallback: "N/A" if no IBAN       │
└────────┬─────────────────────────────────┘
         │
         ▼ Step 5: Customer receives
┌──────────────────────────────────────────┐
│  Customer opens PDF in banking app       │
│  ├─ Scans QR barcode                     │
│  ├─ Banking app recognizes:              │
│  │   ├─ Creditor IBAN                    │
│  │   ├─ Amount to pay                    │
│  │   ├─ Reference number                 │
│  │   └─ Payment deadline                 │
│  └─ One-click payment processing         │
└──────────────────────────────────────────┘
```

### Database Schema Changes

```sql
-- BEFORE:
CREATE TABLE "EInvoice" (
  id TEXT PRIMARY KEY,
  companyId TEXT,
  invoiceNumber TEXT,
  issueDate TIMESTAMP,
  -- ... other fields
);

-- AFTER:
ALTER TABLE "EInvoice"
ADD COLUMN "bankAccount" VARCHAR(34),           -- IBAN (optional)
ADD COLUMN "includeBarcode" BOOLEAN DEFAULT true;

-- Example data:
INSERT INTO "EInvoice" (id, invoiceNumber, bankAccount, includeBarcode)
VALUES ('inv-123', 'INV-2025-001', 'HR6321000001234567890', true);
```

### Component & Function Signatures

```typescript
// NEW FILE: src/lib/barcode.ts
export function generateISO20022Barcode(
  invoice: EInvoice & { lines: EInvoiceLine[] },
  company: Company,
  iban: string
): string {
  // Validate IBAN format
  if (!/^HR\d{2}\d{17}$/.test(iban)) {
    throw new InvalidIBANError('Invalid Croatian IBAN format')
  }

  // Build ISO 20022 XML structure
  const iso20022Data = {
    creditor: {
      name: company.name,
      iban: iban,
    },
    amount: Number(invoice.grossAmount),
    currency: 'EUR' | 'HRK',
    reference: invoice.invoiceNumber,
    deadline: invoice.dueDate?.toISOString() || null,
  }

  // Encode → QR code
  const qrSVG = QRCode.toDataURL(JSON.stringify(iso20022Data))
  return qrSVG  // Returns: data:image/png;base64,...
}

// UPDATED: src/lib/pdf/invoice-template.tsx
interface InvoiceTemplateProps {
  invoice: EInvoice & { lines: EInvoiceLine[] }
  company: Company
  qrBarcode?: string  // NEW: Optional QR code image
}

export function InvoiceTemplate({ invoice, company, qrBarcode }: InvoiceTemplateProps) {
  return (
    <Document>
      {/* ... header, lines, summary ... */}
      <View style={styles.footer}>
        {qrBarcode ? (
          <>
            <Image src={qrBarcode} style={styles.qrCode} />
            <Text style={styles.qrLabel}>Plaćanje QR kodom</Text>
          </>
        ) : (
          <Text style={styles.fallbackText}>Nema QR koda - plaćanje po uputama</Text>
        )}
      </View>
    </Document>
  )
}

// UPDATED: src/app/actions/e-invoice.ts
export async function createEInvoice(data: EInvoiceFormInput) {
  // ... validate & save invoice ...

  // NEW: Generate barcode if enabled
  let qrBarcode: string | undefined
  if (data.includeBarcode && data.bankAccount) {
    qrBarcode = generateISO20022Barcode(
      invoice,
      company,
      data.bankAccount
    )
  }

  // Generate PDF with barcode
  const pdf = await renderToStream(
    <InvoiceTemplate invoice={invoice} company={company} qrBarcode={qrBarcode} />
  )

  // Save file...
}
```

---

## Feature 2: FINA Fiscalization (Real API)

### Data Flow Diagram

```
┌──────────────────────────┐
│  User clicks             │
│  "Fiscalize" button      │
│  on invoice              │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  fiscalizeInvoice(invoiceId)             │
│  └─ Server action called                 │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  FINAFiscalProvider.fiscalize()          │
│                                          │
│  Step 1: Validate                        │
│  ├─ Check all required fields exist      │
│  ├─ Verify amounts match (sum of lines)  │
│  └─ Confirm not already fiscalized       │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Step 2: Convert to UBL 2.1 XML          │
│  ├─ Map EInvoice → EN 16931 structure    │
│  ├─ Include seller (Company):            │
│  │   ├─ Name, OIB (PartyIdentification)  │
│  │   └─ Address, contact info            │
│  ├─ Include buyer (Contact):             │
│  │   ├─ Name, OIB                        │
│  │   └─ Address, reference (if B2B)      │
│  ├─ Include lines (EInvoiceLine[]):      │
│  │   ├─ Description, quantity, unit      │
│  │   ├─ Unit price, net amount           │
│  │   └─ VAT rate, VAT category           │
│  └─ XML format: UBL 2.1 schema           │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Step 3: Submit to FINA                  │
│  ├─ HTTP POST with XML payload           │
│  │   └─ URL: https://servis-eracun...    │
│  ├─ Headers:                             │
│  │   ├─ Content-Type: application/xml    │
│  │   └─ Authorization: Bearer [token]    │
│  ├─ Timeout: 30 seconds                  │
│  └─ mTLS: If required                    │
└────────┬─────────────────────────────────┘
         │
         ▼ [3 retries with exponential backoff]
┌──────────────────────────────────────────┐
│  Receive Response from FINA              │
│                                          │
│  SUCCESS:                                │
│  ├─ Extract fiscal reference:            │
│  │   └─ Format: FINA-XXXXXXXXX           │
│  └─ Status: 200-299                      │
│                                          │
│  FAILURE (retry logic):                  │
│  ├─ Timeout → Wait 5s, retry             │
│  ├─ Network error → Wait 10s, retry      │
│  ├─ Validation error → Log, don't retry  │
│  └─ Rate limited → Queue & retry later   │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Update Database                         │
│  ├─ EInvoice.status = "FISCALIZED"       │
│  ├─ EInvoice.fiscalReference = "FINA-..." │
│  ├─ Log to AuditLog:                     │
│  │   ├─ entity: "EInvoice"               │
│  │   ├─ action: "FISCALIZE"              │
│  │   ├─ changes: full request/response   │
│  │   └─ timestamp: now()                 │
│  └─ Save timestamp                       │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Return to User                          │
│  ├─ Success: Toast "Fiscalized! Ref:..." │
│  ├─ Error: Toast "Failed: [reason]"      │
│  │          Show "Retry" button if error  │
│  └─ Invoice detail page refreshes        │
│      └─ Shows "FISCALIZED ✓"             │
└──────────────────────────────────────────┘
```

### Provider Architecture

```typescript
// INTERFACE: src/lib/e-invoice/fiscal-provider.ts (existing)
interface FiscalProvider {
  fiscalize(invoice: EInvoice): Promise<FiscalizeResult>
  verify(fiscalRef: string): Promise<boolean>
}

interface FiscalizeResult {
  success: boolean
  fiscalRef?: string        // FINA-XXXXXXXXX if success
  error?: string           // Error message if failed
  timestamp?: Date
}

// IMPLEMENTATIONS:
class MockFiscalProvider implements FiscalProvider {
  // Current: Used for testing, always succeeds
  async fiscalize(invoice) {
    return { success: true, fiscalRef: `MOCK-${invoice.id.slice(0,8)}` }
  }
}

class FINAFiscalProvider implements FiscalProvider {
  // NEW: Real FINA API submission
  async fiscalize(invoice: EInvoice): Promise<FiscalizeResult> {
    try {
      // 1. Validate
      validateInvoice(invoice)

      // 2. Convert to UBL 2.1 XML
      const ubl21XML = this.toUBL21(invoice)

      // 3. Submit with retries
      const response = await this.submitWithRetry(ubl21XML, 3)

      // 4. Parse response
      const fiscalRef = extractFiscalRef(response)

      return {
        success: true,
        fiscalRef: fiscalRef,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
      }
    }
  }

  private async submitWithRetry(xml: string, maxRetries: number): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://servis-eracun.mfin.hr/api/submit', {
          method: 'POST',
          body: xml,
          headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Bearer ${process.env.FINA_API_KEY}`,
          },
          timeout: 30000,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        return await response.text()  // XML response
      } catch (error) {
        const waitTime = Math.pow(5, attempt) * 1000  // 5s, 25s, 125s

        if (attempt < maxRetries) {
          console.log(`Retry ${attempt}/${maxRetries} after ${waitTime}ms...`)
          await sleep(waitTime)
        } else {
          throw error
        }
      }
    }
  }

  private toUBL21(invoice: EInvoice): string {
    // Convert to EN 16931 compliant UBL 2.1 XML
    // Returns XML string
  }
}

// USAGE: src/lib/e-invoice/providers/index.ts
export const FISCAL_PROVIDER = process.env.FINA_ENABLED === 'true'
  ? new FINAFiscalProvider()
  : new MockFiscalProvider()
```

### Environment Variables

```bash
# .env.local (on VPS)

# FINA Credentials (obtained from FINA team)
FINA_ENABLED=true                          # Toggle real vs mock
FINA_API_KEY=sk_test_xxxxxxxxxxxx          # API token from FINA
FINA_API_URL=https://test.servis-eracun.mfin.hr  # Test: replace with prod URL later
FINA_PROVIDER_ID=provider-12345            # Provider ID assigned by FINA

# Optional: If using mTLS certificate authentication
FINA_CERT_PATH=/etc/fiskai/fina-cert.pem   # Path to client certificate
FINA_KEY_PATH=/etc/fiskai/fina-key.pem     # Path to private key
```

---

## Feature 3: Bank Reconciliation (Payment Matching)

### Data Flow Diagram

```
┌──────────────────────────────────────┐
│  Accountant downloads CSV            │
│  from bank (Erste, Raiffeisenbank)   │
└────────┬──────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Upload CSV File                     │
│  ├─ File input (drag-drop support)   │
│  ├─ Select bank type (Erste, etc)    │
│  └─ Click "Import"                   │
└────────┬──────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  parseCSV(content, bankName)                                │
│                                                              │
│  Step 1: Format Detection                                   │
│  ├─ Erste format: Date,Description,Debit,Credit,Balance     │
│  ├─ Raiffeisenbank: Date,Reference,Description,Debit,Credit │
│  ├─ moja banka: Date,Reference,Amount,Balance,Description   │
│  └─ Generic fallback: Attempt 4-column parse                │
│                                                              │
│  Step 2: Row Processing                                     │
│  ├─ Parse date (handle DD.MM.YYYY, YYYY-MM-DD)             │
│  ├─ Extract reference (find invoice number in description)  │
│  ├─ Clean amount (remove HRK symbol, convert decimal)       │
│  └─ Validate: Numeric amount, valid date                    │
│                                                              │
│  Step 3: Return Array of Transactions                       │
│  └─ ParsedTransaction[] {                                   │
│       date, reference, amount, description, type             │
│     }                                                        │
└────────┬──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  matchTransactionsToInvoices(transactions, unpaidInvoices)  │
│                                                              │
│  ALGORITHM for each transaction:                            │
│                                                              │
│  1. EXACT MATCH (Confidence: 100)                           │
│     └─ IF invoice# found in reference                       │
│        THEN match → confidenceScore = 100                   │
│                                                              │
│  2. AMOUNT + DATE MATCH (Confidence: 85)                    │
│     └─ IF amount == invoice.gross                           │
│        AND date within 3 days of issueDate                  │
│        THEN match → confidenceScore = 85                    │
│                                                              │
│  3. PARTIAL AMOUNT MATCH (Confidence: 70)                   │
│     └─ IF amount within ±5% of invoice.gross                │
│        AND date within 5 days                               │
│        THEN match → confidenceScore = 70                    │
│                                                              │
│  4. NO MATCH (Confidence: 0)                                │
│     └─ No conditions met → confidenceScore = 0              │
│                                                              │
│  5. AMBIGUOUS MATCHES (Confidence: 50)                      │
│     └─ Multiple invoices match criteria                     │
│        THEN return all with = 50, let user pick              │
│                                                              │
│  Output: ReconciliationResult[]                             │
│  {                                                          │
│    transactionId, matchedInvoiceId, confidence, reason      │
│  }                                                          │
└────────┬──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Save to Database                                            │
│                                                              │
│  FOR each transaction:                                      │
│  INSERT INTO BankTransaction (                              │
│    id, companyId, date, reference, amount,                  │
│    matchedInvoiceId, matchStatus, confidenceScore           │
│  )                                                          │
│                                                              │
│  FOR the import:                                            │
│  INSERT INTO BankImport (                                   │
│    id, companyId, fileName, bankName, uploadedAt            │
│  )                                                          │
│                                                              │
│  Log to AuditLog: Import completed, X matched, Y unmatched  │
└────────┬──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Display Reconciliation Results Page                         │
│                                                              │
│  MATCHED (confidence >= 85):                                │
│  ├─ Green row background                                    │
│  ├─ Show: Date | Reference | Amount | Matched Invoice #    │
│  └─ Action: "✓ Reconcile" button                            │
│                                                              │
│  PARTIAL (confidence 60-85):                                │
│  ├─ Yellow row background                                   │
│  ├─ Show: [same as matched]                                 │
│  └─ Action: Accept match OR select correct invoice          │
│                                                              │
│  UNMATCHED (confidence < 60):                               │
│  ├─ Red row background                                      │
│  ├─ Show: [same as matched]                                 │
│  └─ Action: Manual select OR skip                           │
│                                                              │
│  SUMMARY STATS:                                             │
│  └─ "15 of 20 matched" with progress bar                    │
└────────┬──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  User clicks "Reconcile" button for a transaction           │
│                                                              │
│  reconcileTransaction(transactionId, invoiceId, confirm)    │
└────────┬──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Update Database                                             │
│                                                              │
│  UPDATE BankTransaction                                     │
│  SET matchedInvoiceId = invoiceId,                          │
│      matchStatus = 'MATCHED'                                │
│                                                              │
│  UPDATE EInvoice                                            │
│  SET paidAt = BankTransaction.date,                         │
│      status = 'PAID_VERIFIED'  (or update existing status)   │
│                                                              │
│  INSERT INTO AuditLog                                       │
│  (action='RECONCILE', entity='Invoice', ...                 │
└────────┬──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  User sees updated invoice                                   │
│  ├─ Status: "Plaćeno" (Paid)                                │
│  ├─ Amount: Paid via bank transfer                          │
│  ├─ Date: Shows actual payment date from bank               │
│  └─ Invoice removed from "Unpaid" list                      │
│                                                              │
│  Dashboard updated:                                         │
│  ├─ Outstanding balance decreased                           │
│  ├─ Reconciliation % increased                              │
│  └─ Cash flow view updated                                  │
└──────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- NEW TABLE: Bank Transactions
CREATE TABLE "BankTransaction" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "importId" TEXT NOT NULL,              -- Which import this came from

  -- Transaction data from CSV
  "date" TIMESTAMP NOT NULL,             -- Transaction date
  "reference" TEXT,                      -- Payment reference (invoice #)
  "amount" DECIMAL(10,2) NOT NULL,       -- Amount in original currency
  "description" TEXT,                    -- Counterparty name
  "currency" VARCHAR(3) DEFAULT 'HRK',   -- HRK or EUR

  -- Reconciliation
  "matchedInvoiceId" TEXT,               -- FK to EInvoice
  "matchStatus" VARCHAR(20) DEFAULT 'UNMATCHED',  -- MATCHED|PARTIAL|UNMATCHED
  "confidenceScore" INTEGER,             -- 0-100

  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "reconciledAt" TIMESTAMP,              -- When manually confirmed

  FOREIGN KEY ("companyId") REFERENCES "Company"(id),
  FOREIGN KEY ("importId") REFERENCES "BankImport"(id),
  FOREIGN KEY ("matchedInvoiceId") REFERENCES "EInvoice"(id)
);

-- NEW TABLE: Bank Imports (tracking)
CREATE TABLE "BankImport" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,              -- Original CSV filename
  "bankName" VARCHAR(50),                -- Erste, Raiffeisenbank, etc
  "rowCount" INTEGER,                    -- Number of transactions in CSV
  "matchedCount" INTEGER DEFAULT 0,      -- How many matched
  "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY ("companyId") REFERENCES "Company"(id)
);

-- INDEX for fast lookups during reconciliation
CREATE INDEX "BankTransaction_companyId_matchStatus_idx"
  ON "BankTransaction"("companyId", "matchStatus");

CREATE INDEX "BankTransaction_matchedInvoiceId_idx"
  ON "BankTransaction"("matchedInvoiceId");
```

### Component Signatures

```typescript
// NEW: src/lib/banking/csv-parser.ts
interface ParsedTransaction {
  date: Date
  reference: string      // Invoice number extracted from description
  amount: Decimal
  description: string    // Counterparty name
  type: 'debit' | 'credit'
}

export function parseCSV(
  content: string,
  bankName: 'Erste' | 'Raiffeisenbank' | 'moja_banka' | 'Splitska' | 'OTP' | 'other'
): ParsedTransaction[] {
  // Bank-specific parsing logic
  // Returns: Array of parsed transactions
}

// NEW: src/lib/banking/reconciliation.ts
interface ReconciliationResult {
  transactionId: string
  matchedInvoiceId: string | null
  matchStatus: 'matched' | 'partial' | 'unmatched'
  confidenceScore: number  // 0-100
  reason: string          // "Exact reference match" | "Amount within 3 days" etc.
}

export function matchTransactionsToInvoices(
  transactions: ParsedTransaction[],
  invoices: EInvoice[]
): ReconciliationResult[] {
  // Matching algorithm
  // Returns: Array of match results with confidence scores
}

// NEW: src/app/(dashboard)/banking/import/actions.ts
export async function importBankStatement(
  file: File,
  bankName: string
): Promise<{
  importId: string
  transactions: ReconciliationResult[]
  matchedCount: number
  unmatchedCount: number
}>

export async function reconcileTransaction(
  transactionId: string,
  invoiceId: string
): Promise<void> {
  // Update BankTransaction.matchedInvoiceId
  // Update EInvoice.paidAt & status
  // Log to AuditLog
}
```

---

## Integration Points

### How Features Work Together

```
COMPLETE INVOICE LIFECYCLE:
───────────────────────────

1. CREATE INVOICE
   │
   ├─ User creates invoice with buyer, items, [NEW] IBAN
   │
   ├─ [Feature 1] System generates QR barcode (ISO 20022)
   │              └─ Embeds in PDF
   │
   └─ Invoice created with status "DRAFT"

2. SEND INVOICE
   │
   ├─ User clicks "Fiscalize"
   │
   ├─ [Feature 2] System submits to FINA
   │              ├─ Converts invoice → UBL 2.1 XML
   │              ├─ Submits to government API
   │              └─ Stores fiscal reference
   │
   └─ Invoice status → "FISCALIZED"

3. CUSTOMER RECEIVES & PAYS
   │
   ├─ Customer scans QR from PDF
   │
   ├─ Banking app auto-populates:
   │  ├─ Creditor IBAN
   │  ├─ Amount
   │  └─ Payment reference (invoice #)
   │
   └─ Customer submits payment

4. ACCOUNTANT RECONCILES PAYMENT
   │
   ├─ [Feature 3] Accountant downloads bank statement CSV
   │
   ├─ System parses CSV
   │  ├─ Extracts date, reference, amount
   │  └─ Matches to unpaid invoices
   │
   ├─ Accountant reviews matches
   │  ├─ Approves high-confidence matches (green)
   │  ├─ Reviews partial matches (yellow)
   │  └─ Manually matches unmatched (red)
   │
   └─ System updates:
      ├─ EInvoice.paidAt = transaction date
      ├─ EInvoice.status = "PAID_VERIFIED"
      └─ Invoice appears in "Paid" section

5. REPORTING
   │
   └─ Dashboard shows:
      ├─ Total revenue (all paid invoices)
      ├─ Outstanding balance (unpaid)
      ├─ Cash flow timeline
      └─ Reconciliation summary
```

### API Route Dependencies

```
POST /api/barcode/generate
├─ Input: { invoiceId, iban }
└─ Output: { qrCode: "data:image/png;base64,..." }

POST /api/invoices/[id]/fiscalize
├─ Input: { invoiceId }
├─ Calls: FINAFiscalProvider.fiscalize()
└─ Output: { success, fiscalRef, error }

POST /api/banking/import
├─ Input: { file: File, bankName: string }
├─ Calls: parseCSV() + matchTransactionsToInvoices()
└─ Output: { importId, matchedCount, unmatchedCount }

POST /api/banking/reconcile
├─ Input: { transactionId, invoiceId }
├─ Updates: EInvoice.paidAt, BankTransaction.matchedInvoiceId
└─ Output: { success, invoiceStatus }

GET /api/banking/reconciliation?status=unmatched&limit=50
├─ Query: Filter by status, pagination
└─ Output: ReconciliationResult[]
```

---

## Testing Pyramid

```
                  ┌─────────────────┐
                  │   E2E Tests     │  Workflow: Create → Fiscalize → Pay → Reconcile
                  │   (5-10 tests)  │
                  └────────┬────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
    ┌───────────────────────────────────┐   ┌───────────────────────────────────┐
    │ Integration Tests (10-15 per feat)│   │ Integration Tests (10-15 per feat)│
    │ - Barcode generation + PDF        │   │ - CSV parsing + matching          │
    │ - FINA submission + retry logic   │   │ - Database updates               │
    └─────────────┬───────────────────┘   └────────────────┬───────────────────┘
                  │                                       │
        ┌─────────┴──────────────────────────────────────┴─────────┐
        │                                                           │
    ┌───────────────────────────────────────────┐                 │
    │   Unit Tests (20-30 per feature)          │                 │
    │                                           │                 │
    │ BARCODE:                                  │                 │
    │ - IBAN validation                         │                 │
    │ - ISO 20022 XML generation                │                 │
    │ - QR code SVG output                      │                 │
    │                                           │                 │
    │ FISCALIZATION:                            │                 │
    │ - Invoice → UBL XML conversion            │                 │
    │ - Retry logic with exponential backoff    │                 │
    │ - Response parsing                        │                 │
    │                                           │                 │
    │ RECONCILIATION:                           │                 │
    │ - CSV parsing (5+ bank formats)           │                 │
    │ - Transaction matching (5+ scenarios)     │                 │
    │ - Confidence scoring                      │                 │
    │                                           │                 │
    └───────────────────────────────────────────┘                 │
                                                                    │
    ┌──────────────────────────────────────────────────────────────┘
    │
    │  All tests use existing test framework: @testing-library/react
    │  Mocking: Mock FINA API, mock CSV files, mock Prisma calls
```

---

## Deployment Checklist (Summary)

```
PRE-DEPLOYMENT:
───────────────
□ All code reviewed
□ All tests pass (unit + integration + E2E)
□ Build succeeds (npm run build)
□ No console errors or warnings
□ Database migration tested locally
□ Environment variables configured

DEPLOYMENT:
───────────
□ Commit all changes to main branch
□ Push to GitHub
□ Trigger Coolify deployment from git.metrica.hr dashboard
□ Monitor logs for errors
□ Verify health endpoint (/api/health)
□ Test features on production URL

POST-DEPLOYMENT:
────────────────
□ Create test invoice with IBAN, verify barcode in PDF
□ Submit test invoice to FINA (if credentials available)
□ Upload test CSV, verify matching accuracy
□ Monitor error logs for 24 hours
□ Gather feedback from early users
```

---

## Summary

These three features interconnect to create a complete invoice-to-payment workflow for Croatian micro-businesses:

1. **Barcode** makes payment easy for customers (scan & pay in banking app)
2. **Fiscalization** ensures government compliance (e-invoicing requirement)
3. **Reconciliation** enables accountants to verify cash receipts for tax purposes

Together, they move FiskAI from 60% to 90% completion for Phase 1 MVP launch. 🚀