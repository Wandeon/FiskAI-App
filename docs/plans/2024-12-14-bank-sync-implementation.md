# Bank Sync AIS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement automatic bank transaction syncing via GoCardless AIS with provider abstraction for future swaps.

**Architecture:** Provider-agnostic design with `BankSyncProvider` interface. GoCardless as default. Parallel operation with manual imports. Hybrid deduplication (strict auto + fuzzy review). Daily 6AM cron sync.

**Tech Stack:** Next.js 14 App Router, Prisma, PostgreSQL, TypeScript, GoCardless Bank Account Data API v2

---

## Task 1: Database Schema - Enums and BankAccount Extensions

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add new enums after existing enums (~line 50)**

Find the enum section in schema.prisma and add:

```prisma
enum SyncProvider {
  GOCARDLESS
  PLAID
  SALTEDGE
}

enum ConnectionStatus {
  MANUAL
  CONNECTED
  EXPIRED
}

enum TransactionSource {
  MANUAL
  AIS_SYNC
}

enum DuplicateStatus {
  PENDING
  RESOLVED
}

enum DuplicateResolution {
  KEEP_BOTH
  MERGE
  DELETE_NEW
}
```

**Step 2: Extend BankAccount model (~line 394)**

Add these fields to the existing BankAccount model before the relations:

```prisma
model BankAccount {
  id             String            @id @default(cuid())
  companyId      String
  name           String
  iban           String
  bankName       String
  currency       String            @default("EUR")
  currentBalance Decimal           @db.Decimal(12, 2)
  lastSyncAt     DateTime?
  isDefault      Boolean           @default(false)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  // Bank Sync fields (NEW)
  syncProvider          SyncProvider?
  syncProviderAccountId String?
  connectionStatus      ConnectionStatus @default(MANUAL)
  connectionExpiresAt   DateTime?

  company        Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  imports        BankImport[]
  transactions   BankTransaction[]
  importJobs     ImportJob[]
  statements     Statement[]
  connection     BankConnection?

  @@unique([companyId, iban])
  @@index([companyId])
  @@index([connectionStatus])
}
```

**Step 3: Extend BankTransaction model (~line 416)**

Add these fields to existing BankTransaction model:

```prisma
model BankTransaction {
  id               String      @id @default(cuid())
  companyId        String
  bankAccountId    String
  date             DateTime
  description      String
  amount           Decimal     @db.Decimal(12, 2)
  balance          Decimal     @db.Decimal(12, 2)
  reference        String?
  counterpartyName String?
  counterpartyIban String?
  matchedInvoiceId String?
  matchedExpenseId String?
  matchStatus      MatchStatus @default(UNMATCHED)
  matchedAt        DateTime?
  matchedBy        String?
  createdAt        DateTime    @default(now())
  confidenceScore  Int?

  // Bank Sync fields (NEW)
  externalId       String?
  source           TransactionSource @default(MANUAL)

  bankAccount      BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  matchedExpense   Expense?    @relation(fields: [matchedExpenseId], references: [id])
  matchedInvoice   EInvoice?   @relation(fields: [matchedInvoiceId], references: [id])

  @@index([companyId])
  @@index([bankAccountId])
  @@index([matchStatus])
  @@index([date])
  @@index([externalId])
}
```

**Step 4: Verify schema is valid**

Run: `cd /home/admin/FiskAI && npx prisma validate`
Expected: "The Prisma schema is valid."

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add bank sync enums and extend BankAccount/BankTransaction"
```

---

## Task 2: Database Schema - New Models

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add BankConnection model (after BankTransaction)**

```prisma
model BankConnection {
  id                    String           @id @default(cuid())
  companyId             String
  bankAccountId         String           @unique

  provider              SyncProvider
  providerConnectionId  String
  institutionId         String
  institutionName       String

  status                ConnectionStatus @default(MANUAL)
  authorizedAt          DateTime?
  expiresAt             DateTime?
  lastError             String?

  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  company               Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  bankAccount           BankAccount      @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([status])
  @@index([providerConnectionId])
}
```

**Step 2: Add PotentialDuplicate model**

```prisma
model PotentialDuplicate {
  id                String              @id @default(cuid())
  companyId         String

  transactionAId    String
  transactionBId    String

  similarityScore   Float
  reason            String

  status            DuplicateStatus     @default(PENDING)
  resolvedAt        DateTime?
  resolvedBy        String?
  resolution        DuplicateResolution?

  createdAt         DateTime            @default(now())

  company           Company             @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([status])
}
```

**Step 3: Add relations to Company model**

Find the Company model and add these relations:

```prisma
  bankConnections      BankConnection[]
  potentialDuplicates  PotentialDuplicate[]
```

**Step 4: Validate and generate**

Run: `cd /home/admin/FiskAI && npx prisma validate && npx prisma generate`
Expected: Schema valid, client generated

**Step 5: Create migration**

Run: `cd /home/admin/FiskAI && npx prisma migrate dev --name add_bank_sync_models`
Expected: Migration created and applied

**Step 6: Commit**

```bash
git add prisma/
git commit -m "schema: add BankConnection and PotentialDuplicate models"
```

---

## Task 3: Provider Interface and Types

**Files:**

- Create: `src/lib/bank-sync/types.ts`
- Create: `src/lib/bank-sync/provider.ts`

**Step 1: Create types file**

```typescript
// src/lib/bank-sync/types.ts

export interface ProviderAccount {
  id: string
  iban: string
  name?: string
  currency: string
}

export interface ProviderTransaction {
  externalId: string
  date: Date
  amount: number // positive = credit, negative = debit
  description: string
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
}

export interface ProviderBalance {
  amount: number
  currency: string
  type: "available" | "current"
}

export interface ConnectionResult {
  accounts: ProviderAccount[]
  expiresAt: Date
}

export interface CreateConnectionResult {
  connectionId: string
  redirectUrl: string
}
```

**Step 2: Create provider interface**

```typescript
// src/lib/bank-sync/provider.ts

import type {
  ProviderAccount,
  ProviderTransaction,
  ProviderBalance,
  ConnectionResult,
  CreateConnectionResult,
} from "./types"

export interface BankSyncProvider {
  name: string

  /**
   * Get provider's institution ID for a Croatian bank name
   */
  getInstitutionId(bankName: string): Promise<string | null>

  /**
   * Create a connection - returns redirect URL for user to authorize
   */
  createConnection(
    institutionId: string,
    redirectUrl: string,
    reference: string
  ): Promise<CreateConnectionResult>

  /**
   * Handle callback after user authorizes - returns linked accounts
   */
  handleCallback(connectionId: string): Promise<ConnectionResult>

  /**
   * Fetch transactions since a given date
   */
  fetchTransactions(providerAccountId: string, since: Date): Promise<ProviderTransaction[]>

  /**
   * Fetch current balance
   */
  fetchBalance(providerAccountId: string): Promise<ProviderBalance | null>

  /**
   * Check if connection is still valid
   */
  isConnectionValid(connectionId: string): Promise<boolean>
}
```

**Step 3: Verify files exist**

Run: `ls -la /home/admin/FiskAI/src/lib/bank-sync/`
Expected: types.ts and provider.ts listed

**Step 4: Commit**

```bash
git add src/lib/bank-sync/
git commit -m "feat(bank-sync): add provider interface and types"
```

---

## Task 4: GoCardless Provider Implementation

**Files:**

- Create: `src/lib/bank-sync/providers/gocardless.ts`
- Create: `src/lib/bank-sync/providers/index.ts`

**Step 1: Create GoCardless provider**

```typescript
// src/lib/bank-sync/providers/gocardless.ts

import type { BankSyncProvider } from "../provider"
import type {
  ProviderTransaction,
  ProviderBalance,
  ConnectionResult,
  CreateConnectionResult,
} from "../types"

const GOCARDLESS_BASE =
  process.env.GOCARDLESS_BASE_URL || "https://bankaccountdata.gocardless.com/api/v2"

// Token cache (simple in-memory, refresh when expired)
let tokenCache: { access: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.access
  }

  const secretId = process.env.GOCARDLESS_SECRET_ID
  const secretKey = process.env.GOCARDLESS_SECRET_KEY

  if (!secretId || !secretKey) {
    throw new Error("GoCardless credentials not configured")
  }

  const res = await fetch(`${GOCARDLESS_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret_id: secretId,
      secret_key: secretKey,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GoCardless token error (${res.status}): ${text}`)
  }

  const data = await res.json()
  tokenCache = {
    access: data.access,
    expiresAt: Date.now() + data.access_expires * 1000,
  }

  return data.access
}

async function gcFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(`${GOCARDLESS_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GoCardless API error (${res.status}): ${text}`)
  }

  return res.json()
}

// Croatian bank name to GoCardless institution ID mapping
const INSTITUTION_MAP: Record<string, string> = {
  "zagrebačka banka": "ZAGREBACKA_BANKA_ZABAHR2X",
  zaba: "ZAGREBACKA_BANKA_ZABAHR2X",
  "privredna banka zagreb": "PBZ_PBZGHR2X",
  pbz: "PBZ_PBZGHR2X",
  "erste bank": "ERSTE_BANK_GIBAHR2X",
  "erste&steiermärkische bank": "ERSTE_BANK_GIBAHR2X",
  "raiffeisenbank austria": "RBA_RZBHHR2X",
  "raiffeisen bank": "RBA_RZBHHR2X",
  rba: "RBA_RZBHHR2X",
  "otp banka": "OTP_BANKA_OTPVHR2X",
  otp: "OTP_BANKA_OTPVHR2X",
  "addiko bank": "ADDIKO_BANK_HAABHR22",
  "hrvatska poštanska banka": "HPB_HABORHR2X",
  hpb: "HPB_HABORHR2X",
}

export const gocardlessProvider: BankSyncProvider = {
  name: "gocardless",

  async getInstitutionId(bankName: string): Promise<string | null> {
    const normalized = bankName.toLowerCase().trim()

    // Check local map first
    if (INSTITUTION_MAP[normalized]) {
      return INSTITUTION_MAP[normalized]
    }

    // Try partial match
    for (const [key, value] of Object.entries(INSTITUTION_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value
      }
    }

    // Fallback: fetch from API and search
    try {
      const data = await gcFetch<{ results: Array<{ id: string; name: string }> }>(
        "/institutions/?country=HR"
      )

      const match = data.results.find(
        (inst) =>
          inst.name.toLowerCase().includes(normalized) ||
          normalized.includes(inst.name.toLowerCase())
      )

      return match?.id || null
    } catch {
      return null
    }
  },

  async createConnection(
    institutionId: string,
    redirectUrl: string,
    reference: string
  ): Promise<CreateConnectionResult> {
    const data = await gcFetch<{ id: string; link: string }>("/requisitions/", {
      method: "POST",
      body: JSON.stringify({
        institution_id: institutionId,
        redirect: redirectUrl,
        reference,
        user_language: "HR",
      }),
    })

    return {
      connectionId: data.id,
      redirectUrl: data.link,
    }
  },

  async handleCallback(connectionId: string): Promise<ConnectionResult> {
    const data = await gcFetch<{
      id: string
      status: string
      accounts: string[]
    }>(`/requisitions/${connectionId}/`)

    if (data.status !== "LN") {
      throw new Error(`Requisition not linked: status=${data.status}`)
    }

    // Fetch account details for each account ID
    const accounts = await Promise.all(
      data.accounts.map(async (accountId) => {
        const details = await gcFetch<{
          id: string
          iban: string
          status: string
          owner_name?: string
        }>(`/accounts/${accountId}/`)

        return {
          id: accountId,
          iban: details.iban,
          name: details.owner_name,
          currency: "EUR",
        }
      })
    )

    // 90 days consent
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 90)

    return { accounts, expiresAt }
  },

  async fetchTransactions(providerAccountId: string, since: Date): Promise<ProviderTransaction[]> {
    const dateFrom = since.toISOString().split("T")[0]

    const data = await gcFetch<{
      transactions: {
        booked: Array<{
          transactionId?: string
          internalTransactionId?: string
          bookingDate: string
          valueDate?: string
          transactionAmount: { amount: string; currency: string }
          creditorName?: string
          creditorAccount?: { iban?: string }
          debtorName?: string
          debtorAccount?: { iban?: string }
          remittanceInformationUnstructured?: string
          remittanceInformationUnstructuredArray?: string[]
        }>
      }
    }>(`/accounts/${providerAccountId}/transactions/?date_from=${dateFrom}`)

    return data.transactions.booked.map((txn) => {
      const amount = parseFloat(txn.transactionAmount.amount)
      const isCredit = amount > 0

      return {
        externalId:
          txn.transactionId || txn.internalTransactionId || `${txn.bookingDate}-${amount}`,
        date: new Date(txn.bookingDate),
        amount,
        description:
          txn.remittanceInformationUnstructured ||
          txn.remittanceInformationUnstructuredArray?.join(" ") ||
          "",
        reference: txn.transactionId,
        counterpartyName: isCredit ? txn.debtorName : txn.creditorName,
        counterpartyIban: isCredit ? txn.debtorAccount?.iban : txn.creditorAccount?.iban,
      }
    })
  },

  async fetchBalance(providerAccountId: string): Promise<ProviderBalance | null> {
    try {
      const data = await gcFetch<{
        balances: Array<{
          balanceAmount: { amount: string; currency: string }
          balanceType: string
        }>
      }>(`/accounts/${providerAccountId}/balances/`)

      const balance =
        data.balances.find(
          (b) => b.balanceType === "interimAvailable" || b.balanceType === "expected"
        ) || data.balances[0]

      if (!balance) return null

      return {
        amount: parseFloat(balance.balanceAmount.amount),
        currency: balance.balanceAmount.currency,
        type: balance.balanceType === "interimAvailable" ? "available" : "current",
      }
    } catch {
      return null
    }
  },

  async isConnectionValid(connectionId: string): Promise<boolean> {
    try {
      const data = await gcFetch<{ status: string }>(`/requisitions/${connectionId}/`)
      return data.status === "LN"
    } catch {
      return false
    }
  },
}
```

**Step 2: Create provider factory**

```typescript
// src/lib/bank-sync/providers/index.ts

import type { BankSyncProvider } from "../provider"
import { gocardlessProvider } from "./gocardless"

const providers: Record<string, BankSyncProvider> = {
  gocardless: gocardlessProvider,
}

export function getProvider(name?: string | null): BankSyncProvider {
  const providerName = name || process.env.BANK_SYNC_PROVIDER || "gocardless"

  const provider = providers[providerName.toLowerCase()]

  if (!provider) {
    throw new Error(`Unknown bank sync provider: ${providerName}`)
  }

  return provider
}

export function isProviderConfigured(): boolean {
  const providerName = process.env.BANK_SYNC_PROVIDER || "gocardless"

  if (providerName === "gocardless") {
    return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY)
  }

  return false
}
```

**Step 3: Create directory and verify**

Run: `mkdir -p /home/admin/FiskAI/src/lib/bank-sync/providers && ls -la /home/admin/FiskAI/src/lib/bank-sync/`
Expected: providers directory created

**Step 4: Commit**

```bash
git add src/lib/bank-sync/
git commit -m "feat(bank-sync): implement GoCardless provider"
```

---

## Task 5: Deduplication Engine

**Files:**

- Create: `src/lib/bank-sync/dedup.ts`

**Step 1: Create deduplication engine**

```typescript
// src/lib/bank-sync/dedup.ts

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type { ProviderTransaction } from "./types"

const Decimal = Prisma.Decimal

interface DedupResult {
  inserted: number
  skippedDuplicates: number
  flaggedForReview: number
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().replace(/[^a-z0-9]/g, "")
  const bNorm = b.toLowerCase().replace(/[^a-z0-9]/g, "")

  if (aNorm === bNorm) return 1
  if (!aNorm || !bNorm) return 0

  // Simple Jaccard similarity on character bigrams
  const getBigrams = (s: string) => {
    const bigrams = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.slice(i, i + 2))
    }
    return bigrams
  }

  const aBigrams = getBigrams(aNorm)
  const bBigrams = getBigrams(bNorm)

  let intersection = 0
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++
  }

  const union = aBigrams.size + bBigrams.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Check for strict duplicate (exact match)
 */
async function isStrictDuplicate(
  bankAccountId: string,
  txn: ProviderTransaction
): Promise<boolean> {
  const existing = await db.bankTransaction.findFirst({
    where: {
      bankAccountId,
      OR: [
        // Match by external ID
        { externalId: txn.externalId },
        // Match by date + amount + reference
        {
          date: txn.date,
          amount: new Decimal(Math.abs(txn.amount)),
          reference: txn.reference || undefined,
        },
      ],
    },
  })

  return !!existing
}

/**
 * Find fuzzy duplicates (potential matches needing review)
 */
async function findFuzzyDuplicates(
  bankAccountId: string,
  companyId: string,
  txn: ProviderTransaction,
  newTransactionId: string
): Promise<void> {
  const dateFrom = new Date(txn.date)
  dateFrom.setDate(dateFrom.getDate() - 2)
  const dateTo = new Date(txn.date)
  dateTo.setDate(dateTo.getDate() + 2)

  const candidates = await db.bankTransaction.findMany({
    where: {
      bankAccountId,
      id: { not: newTransactionId },
      date: { gte: dateFrom, lte: dateTo },
      amount: {
        gte: new Decimal(Math.abs(txn.amount) - 0.01),
        lte: new Decimal(Math.abs(txn.amount) + 0.01),
      },
    },
  })

  for (const candidate of candidates) {
    const similarity = stringSimilarity(txn.description, candidate.description)

    if (similarity > 0.7) {
      // Check if already flagged
      const existing = await db.potentialDuplicate.findFirst({
        where: {
          OR: [
            { transactionAId: newTransactionId, transactionBId: candidate.id },
            { transactionAId: candidate.id, transactionBId: newTransactionId },
          ],
        },
      })

      if (!existing) {
        await db.potentialDuplicate.create({
          data: {
            companyId,
            transactionAId: newTransactionId,
            transactionBId: candidate.id,
            similarityScore: similarity,
            reason: `Sličan datum (±2 dana), isti iznos, opis ${Math.round(similarity * 100)}% sličan`,
            status: "PENDING",
          },
        })
      }
    }
  }
}

/**
 * Process transactions with deduplication
 */
export async function processTransactionsWithDedup(
  bankAccountId: string,
  companyId: string,
  transactions: ProviderTransaction[]
): Promise<DedupResult> {
  const result: DedupResult = {
    inserted: 0,
    skippedDuplicates: 0,
    flaggedForReview: 0,
  }

  for (const txn of transactions) {
    // Tier 1: Strict duplicate check
    if (await isStrictDuplicate(bankAccountId, txn)) {
      result.skippedDuplicates++
      continue
    }

    // Insert new transaction
    const newTxn = await db.bankTransaction.create({
      data: {
        companyId,
        bankAccountId,
        date: txn.date,
        description: txn.description,
        amount: new Decimal(Math.abs(txn.amount)),
        balance: new Decimal(0), // GoCardless doesn't provide running balance
        reference: txn.reference,
        counterpartyName: txn.counterpartyName,
        counterpartyIban: txn.counterpartyIban,
        externalId: txn.externalId,
        source: "AIS_SYNC",
        matchStatus: "UNMATCHED",
      },
    })

    result.inserted++

    // Tier 2: Fuzzy duplicate detection
    const beforeCount = await db.potentialDuplicate.count({
      where: { companyId, status: "PENDING" },
    })

    await findFuzzyDuplicates(bankAccountId, companyId, txn, newTxn.id)

    const afterCount = await db.potentialDuplicate.count({
      where: { companyId, status: "PENDING" },
    })

    result.flaggedForReview += afterCount - beforeCount
  }

  return result
}

/**
 * Resolve a potential duplicate
 */
export async function resolveDuplicate(
  duplicateId: string,
  resolution: "KEEP_BOTH" | "MERGE" | "DELETE_NEW",
  userId: string
): Promise<void> {
  const duplicate = await db.potentialDuplicate.findUnique({
    where: { id: duplicateId },
  })

  if (!duplicate) {
    throw new Error("Duplicate not found")
  }

  if (resolution === "DELETE_NEW") {
    // Delete the newer transaction (transactionA is always the new one)
    await db.bankTransaction.delete({
      where: { id: duplicate.transactionAId },
    })
  } else if (resolution === "MERGE") {
    // Keep transactionB (the original), delete transactionA
    await db.bankTransaction.delete({
      where: { id: duplicate.transactionAId },
    })
  }
  // KEEP_BOTH: just mark resolved, don't delete anything

  await db.potentialDuplicate.update({
    where: { id: duplicateId },
    data: {
      status: "RESOLVED",
      resolution,
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
  })
}
```

**Step 2: Verify file**

Run: `ls -la /home/admin/FiskAI/src/lib/bank-sync/dedup.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add src/lib/bank-sync/dedup.ts
git commit -m "feat(bank-sync): implement deduplication engine"
```

---

## Task 6: API Route - Connect Bank Account

**Files:**

- Create: `src/app/api/bank/connect/route.ts`

**Step 1: Create connect endpoint**

```typescript
// src/app/api/bank/connect/route.ts

import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { getProvider, isProviderConfigured } from "@/lib/bank-sync/providers"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    if (!isProviderConfigured()) {
      return NextResponse.json({ error: "Bank sync provider not configured" }, { status: 503 })
    }

    const { bankAccountId } = await request.json()

    if (!bankAccountId) {
      return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 })
    }

    // Find the bank account
    const bankAccount = await db.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: company.id },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 })
    }

    if (bankAccount.connectionStatus === "CONNECTED") {
      return NextResponse.json({ error: "Bank account already connected" }, { status: 400 })
    }

    // Get provider and institution ID
    const provider = getProvider()
    const institutionId = await provider.getInstitutionId(bankAccount.bankName)

    if (!institutionId) {
      return NextResponse.json(
        { error: `Bank "${bankAccount.bankName}" is not supported for automatic sync` },
        { status: 400 }
      )
    }

    // Create connection
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fiskai.hr"
    const redirectUrl = `${baseUrl}/api/bank/callback`

    const result = await provider.createConnection(
      institutionId,
      redirectUrl,
      bankAccountId // Use bankAccountId as reference
    )

    // Store connection record
    await db.bankConnection.upsert({
      where: { bankAccountId },
      create: {
        companyId: company.id,
        bankAccountId,
        provider: "GOCARDLESS",
        providerConnectionId: result.connectionId,
        institutionId,
        institutionName: bankAccount.bankName,
        status: "MANUAL", // Will be updated on callback
      },
      update: {
        providerConnectionId: result.connectionId,
        institutionId,
        status: "MANUAL",
        lastError: null,
      },
    })

    return NextResponse.json({ redirectUrl: result.redirectUrl })
  } catch (error) {
    console.error("[bank/connect] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    )
  }
}
```

**Step 2: Create directory and verify**

Run: `mkdir -p /home/admin/FiskAI/src/app/api/bank/connect`
Expected: Directory created

**Step 3: Commit**

```bash
git add src/app/api/bank/connect/
git commit -m "feat(bank-sync): add connect API endpoint"
```

---

## Task 7: API Route - Callback Handler

**Files:**

- Create: `src/app/api/bank/callback/route.ts`

**Step 1: Create callback endpoint**

```typescript
// src/app/api/bank/callback/route.ts

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getProvider } from "@/lib/bank-sync/providers"
import { processTransactionsWithDedup } from "@/lib/bank-sync/dedup"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get("ref")

  if (!ref) {
    redirect("/banking?error=missing_ref")
  }

  try {
    // Find connection by bankAccountId (we used it as reference)
    const connection = await db.bankConnection.findFirst({
      where: { bankAccountId: ref },
      include: { bankAccount: true },
    })

    if (!connection) {
      redirect("/banking?error=unknown_connection")
    }

    const provider = getProvider(connection.provider)

    // Handle callback - get accounts
    const result = await provider.handleCallback(connection.providerConnectionId)

    // Find matching account by IBAN
    const matchedAccount = result.accounts.find((acc) => acc.iban === connection.bankAccount.iban)

    if (!matchedAccount) {
      await db.bankConnection.update({
        where: { id: connection.id },
        data: {
          lastError: `No account found with IBAN ${connection.bankAccount.iban}`,
        },
      })
      redirect("/banking?error=iban_not_found")
    }

    // Update connection and bank account
    await db.$transaction([
      db.bankConnection.update({
        where: { id: connection.id },
        data: {
          status: "CONNECTED",
          authorizedAt: new Date(),
          expiresAt: result.expiresAt,
          lastError: null,
        },
      }),
      db.bankAccount.update({
        where: { id: connection.bankAccountId },
        data: {
          syncProvider: "GOCARDLESS",
          syncProviderAccountId: matchedAccount.id,
          connectionStatus: "CONNECTED",
          connectionExpiresAt: result.expiresAt,
        },
      }),
    ])

    // Trigger initial sync (last 90 days)
    const since = new Date()
    since.setDate(since.getDate() - 90)

    try {
      const transactions = await provider.fetchTransactions(matchedAccount.id, since)

      await processTransactionsWithDedup(
        connection.bankAccountId,
        connection.companyId,
        transactions
      )

      // Update balance
      const balance = await provider.fetchBalance(matchedAccount.id)
      if (balance) {
        await db.bankAccount.update({
          where: { id: connection.bankAccountId },
          data: {
            currentBalance: balance.amount,
            lastSyncAt: new Date(),
          },
        })
      }
    } catch (syncError) {
      console.error("[bank/callback] initial sync error:", syncError)
      // Don't fail the connection, just log
    }

    redirect("/banking?success=connected")
  } catch (error) {
    console.error("[bank/callback] error:", error)
    redirect("/banking?error=callback_failed")
  }
}
```

**Step 2: Create directory**

Run: `mkdir -p /home/admin/FiskAI/src/app/api/bank/callback`
Expected: Directory created

**Step 3: Commit**

```bash
git add src/app/api/bank/callback/
git commit -m "feat(bank-sync): add callback API endpoint"
```

---

## Task 8: API Route - Daily Sync Cron

**Files:**

- Create: `src/app/api/cron/bank-sync/route.ts`

**Step 1: Create cron endpoint**

```typescript
// src/app/api/cron/bank-sync/route.ts

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getProvider } from "@/lib/bank-sync/providers"
import { processTransactionsWithDedup } from "@/lib/bank-sync/dedup"

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Array<{
    accountId: string
    status: string
    inserted?: number
    error?: string
  }> = []

  try {
    // Find all connected accounts
    const accounts = await db.bankAccount.findMany({
      where: { connectionStatus: "CONNECTED" },
      include: { connection: true },
    })

    const now = new Date()
    const warningThreshold = new Date()
    warningThreshold.setDate(warningThreshold.getDate() + 7)

    for (const account of accounts) {
      try {
        // Check expiration
        if (account.connectionExpiresAt) {
          if (account.connectionExpiresAt < now) {
            // Expired - mark and skip
            await db.bankAccount.update({
              where: { id: account.id },
              data: { connectionStatus: "EXPIRED" },
            })
            results.push({ accountId: account.id, status: "expired" })
            continue
          }

          if (account.connectionExpiresAt < warningThreshold) {
            // Expiring soon - TODO: send notification
            console.log(`[bank-sync] Account ${account.id} expires in <7 days`)
          }
        }

        if (!account.syncProviderAccountId || !account.connection) {
          results.push({ accountId: account.id, status: "skipped", error: "No provider account" })
          continue
        }

        // Fetch transactions
        const provider = getProvider(account.syncProvider)
        const since = account.lastSyncAt || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

        const transactions = await provider.fetchTransactions(account.syncProviderAccountId, since)

        // Process with dedup
        const dedupResult = await processTransactionsWithDedup(
          account.id,
          account.companyId,
          transactions
        )

        // Update balance
        const balance = await provider.fetchBalance(account.syncProviderAccountId)

        await db.bankAccount.update({
          where: { id: account.id },
          data: {
            lastSyncAt: new Date(),
            currentBalance: balance?.amount ?? account.currentBalance,
          },
        })

        results.push({
          accountId: account.id,
          status: "synced",
          inserted: dedupResult.inserted,
        })
      } catch (error) {
        console.error(`[bank-sync] Error syncing account ${account.id}:`, error)
        results.push({
          accountId: account.id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      processed: accounts.length,
      results,
    })
  } catch (error) {
    console.error("[bank-sync] Cron error:", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}

// Also support GET for easy testing
export async function GET(request: Request) {
  return POST(request)
}
```

**Step 2: Create directory**

Run: `mkdir -p /home/admin/FiskAI/src/app/api/cron/bank-sync`
Expected: Directory created

**Step 3: Commit**

```bash
git add src/app/api/cron/
git commit -m "feat(bank-sync): add daily cron sync endpoint"
```

---

## Task 9: API Route - Disconnect

**Files:**

- Create: `src/app/api/bank/disconnect/route.ts`

**Step 1: Create disconnect endpoint**

```typescript
// src/app/api/bank/disconnect/route.ts

import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { bankAccountId } = await request.json()

    if (!bankAccountId) {
      return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 })
    }

    // Find and verify ownership
    const bankAccount = await db.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: company.id },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 })
    }

    // Delete connection and reset account
    await db.$transaction([
      db.bankConnection.deleteMany({
        where: { bankAccountId },
      }),
      db.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          syncProvider: null,
          syncProviderAccountId: null,
          connectionStatus: "MANUAL",
          connectionExpiresAt: null,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[bank/disconnect] error:", error)
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 })
  }
}
```

**Step 2: Create directory**

Run: `mkdir -p /home/admin/FiskAI/src/app/api/bank/disconnect`
Expected: Directory created

**Step 3: Commit**

```bash
git add src/app/api/bank/disconnect/
git commit -m "feat(bank-sync): add disconnect API endpoint"
```

---

## Task 10: UI Component - Connect Button

**Files:**

- Create: `src/app/(dashboard)/banking/components/connect-button.tsx`

**Step 1: Create connect button component**

```typescript
// src/app/(dashboard)/banking/components/connect-button.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'

interface ConnectButtonProps {
  bankAccountId: string
  connectionStatus: 'MANUAL' | 'CONNECTED' | 'EXPIRED'
  bankName: string
}

export function ConnectButton({
  bankAccountId,
  connectionStatus,
  bankName,
}: ConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch('/api/bank/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Povezivanje nije uspjelo')
        return
      }

      // Redirect to bank auth
      window.location.href = data.redirectUrl
    } catch (error) {
      toast.error('Povezivanje nije uspjelo')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Jeste li sigurni da želite prekinuti automatsku sinkronizaciju?')) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/bank/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Prekid veze nije uspio')
        return
      }

      toast.success('Veza prekinuta')
      window.location.reload()
    } catch (error) {
      toast.error('Prekid veze nije uspio')
    } finally {
      setLoading(false)
    }
  }

  if (connectionStatus === 'CONNECTED') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDisconnect}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Unlink className="h-4 w-4 mr-2" />
            Prekini vezu
          </>
        )}
      </Button>
    )
  }

  return (
    <Button
      variant={connectionStatus === 'EXPIRED' ? 'default' : 'outline'}
      size="sm"
      onClick={handleConnect}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-2" />
          {connectionStatus === 'EXPIRED' ? 'Obnovi vezu' : 'Poveži banku'}
        </>
      )}
    </Button>
  )
}
```

**Step 2: Create directory**

Run: `mkdir -p /home/admin/FiskAI/src/app/\(dashboard\)/banking/components`
Expected: Directory created

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/banking/components/
git commit -m "feat(bank-sync): add connect button UI component"
```

---

## Task 11: UI Component - Connection Badge

**Files:**

- Create: `src/app/(dashboard)/banking/components/connection-badge.tsx`

**Step 1: Create connection badge component**

```typescript
// src/app/(dashboard)/banking/components/connection-badge.tsx

interface ConnectionBadgeProps {
  status: 'MANUAL' | 'CONNECTED' | 'EXPIRED'
  expiresAt?: Date | null
}

export function ConnectionBadge({ status, expiresAt }: ConnectionBadgeProps) {
  if (status === 'CONNECTED') {
    const daysLeft = expiresAt
      ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
          Povezano
        </span>
        {daysLeft !== null && daysLeft <= 14 && (
          <span className="text-xs text-amber-600">
            Ističe za {daysLeft} {daysLeft === 1 ? 'dan' : 'dana'}
          </span>
        )}
      </div>
    )
  }

  if (status === 'EXPIRED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5" />
        Isteklo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      Ručni uvoz
    </span>
  )
}
```

**Step 2: Verify file created**

Run: `ls -la /home/admin/FiskAI/src/app/\(dashboard\)/banking/components/`
Expected: connection-badge.tsx exists

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/banking/components/connection-badge.tsx
git commit -m "feat(bank-sync): add connection badge UI component"
```

---

## Task 12: Integrate Components into Banking Page

**Files:**

- Modify: `src/app/(dashboard)/banking/page.tsx`

**Step 1: Read current page to understand structure**

First read the file to see current implementation.

**Step 2: Add imports at top of file**

```typescript
import { ConnectButton } from "./components/connect-button"
import { ConnectionBadge } from "./components/connection-badge"
```

**Step 3: Update bank account cards to show connection status and button**

Find where bank accounts are rendered and add:

```tsx
{
  /* In each bank account card, add: */
}
;<div className="flex items-center justify-between">
  <ConnectionBadge status={account.connectionStatus} expiresAt={account.connectionExpiresAt} />
  <ConnectButton
    bankAccountId={account.id}
    connectionStatus={account.connectionStatus}
    bankName={account.bankName}
  />
</div>
```

**Step 4: Verify build**

Run: `cd /home/admin/FiskAI && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/banking/
git commit -m "feat(bank-sync): integrate connection UI into banking page"
```

---

## Task 13: Add Vercel Cron Configuration

**Files:**

- Create or modify: `vercel.json`

**Step 1: Add cron configuration**

```json
{
  "crons": [
    {
      "path": "/api/cron/bank-sync",
      "schedule": "0 5 * * *"
    }
  ]
}
```

Note: 5 AM UTC = 6 AM CET

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "config: add daily bank sync cron job"
```

---

## Task 14: Environment Variables Documentation

**Files:**

- Modify: `.env.example` or create if not exists

**Step 1: Add bank sync environment variables**

```env
# Bank Sync (GoCardless)
BANK_SYNC_PROVIDER=gocardless
GOCARDLESS_SECRET_ID=your_secret_id
GOCARDLESS_SECRET_KEY=your_secret_key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2

# Cron Protection
CRON_SECRET=your_random_secret_for_cron
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add bank sync environment variables"
```

---

## Task 15: Final Integration Test

**Step 1: Verify all files exist**

Run:

```bash
ls -la /home/admin/FiskAI/src/lib/bank-sync/
ls -la /home/admin/FiskAI/src/lib/bank-sync/providers/
ls -la /home/admin/FiskAI/src/app/api/bank/
ls -la /home/admin/FiskAI/src/app/api/cron/
ls -la /home/admin/FiskAI/src/app/\(dashboard\)/banking/components/
```

**Step 2: Run full build**

Run: `cd /home/admin/FiskAI && npm run build`
Expected: Build succeeds with no errors

**Step 3: Run type check**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit`
Expected: No type errors

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(bank-sync): complete GoCardless AIS integration

- Provider-agnostic architecture with BankSyncProvider interface
- GoCardless provider implementation
- Hybrid deduplication (strict auto + fuzzy review)
- API endpoints: connect, callback, disconnect, cron sync
- UI components: ConnectButton, ConnectionBadge
- Daily 6AM sync cron job
- 90-day consent expiration handling"
```

**Step 5: Push to deploy**

Run: `git push`
Expected: Push succeeds, Coolify deployment triggered

---

## Summary

| Task | Description                                     | Files                        |
| ---- | ----------------------------------------------- | ---------------------------- |
| 1    | Schema enums + BankAccount extensions           | prisma/schema.prisma         |
| 2    | New models (BankConnection, PotentialDuplicate) | prisma/schema.prisma         |
| 3    | Provider interface + types                      | src/lib/bank-sync/           |
| 4    | GoCardless provider implementation              | src/lib/bank-sync/providers/ |
| 5    | Deduplication engine                            | src/lib/bank-sync/dedup.ts   |
| 6    | Connect API endpoint                            | src/app/api/bank/connect/    |
| 7    | Callback API endpoint                           | src/app/api/bank/callback/   |
| 8    | Cron sync endpoint                              | src/app/api/cron/bank-sync/  |
| 9    | Disconnect API endpoint                         | src/app/api/bank/disconnect/ |
| 10   | Connect button component                        | banking/components/          |
| 11   | Connection badge component                      | banking/components/          |
| 12   | Banking page integration                        | banking/page.tsx             |
| 13   | Vercel cron config                              | vercel.json                  |
| 14   | Environment variables                           | .env.example                 |
| 15   | Final integration test                          | -                            |

**Total: 15 tasks**
