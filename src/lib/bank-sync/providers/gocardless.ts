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

// Promise deduplication to prevent concurrent token refreshes
let tokenPromise: Promise<string> | null = null

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.access
  }

  // Use promise deduplication to prevent race conditions:
  // If a refresh is already in progress, return that promise instead of starting a new one
  if (!tokenPromise) {
    tokenPromise = refreshToken().finally(() => {
      tokenPromise = null
    })
  }

  return tokenPromise
}

async function refreshToken(): Promise<string> {
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
