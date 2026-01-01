// src/domain/banking/BankTransactionRepository.ts
import { BankTransaction } from "./BankTransaction"

export interface BankTransactionRepository {
  save(transaction: BankTransaction): Promise<void>
  findById(id: string): Promise<BankTransaction | null>
  findByExternalId(externalId: string): Promise<BankTransaction | null>
  findByBankAccount(bankAccountId: string): Promise<BankTransaction[]>
  findUnmatched(bankAccountId: string): Promise<BankTransaction[]>
  findByDateRange(bankAccountId: string, from: Date, to: Date): Promise<BankTransaction[]>
}
