// src/lib/bank-sync/provider.ts

import type {
  ProviderAccount,
  ProviderTransaction,
  ProviderBalance,
  ConnectionResult,
  CreateConnectionResult,
} from './types'

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
  fetchTransactions(
    providerAccountId: string,
    since: Date
  ): Promise<ProviderTransaction[]>

  /**
   * Fetch current balance
   */
  fetchBalance(providerAccountId: string): Promise<ProviderBalance | null>

  /**
   * Check if connection is still valid
   */
  isConnectionValid(connectionId: string): Promise<boolean>
}
