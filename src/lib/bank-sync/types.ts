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
  currency?: string
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
