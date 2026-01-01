// src/application/banking/ImportBankStatement.ts
import {
  BankTransaction,
  ImportDeduplicator,
  BankTransactionRepository,
  TransactionDirection,
} from "@/domain/banking"
import { Money } from "@/domain/shared"

/**
 * Supported bank CSV formats
 */
export type BankFormat = "erste" | "pbz" | "zaba" | "generic"

/**
 * Parsed row from a bank CSV statement
 */
export interface ParsedRow {
  date: Date
  amount: Money
  direction: TransactionDirection
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
  description?: string
  balance?: Money
  externalId?: string
}

/**
 * CSV row parsing service interface.
 * Infrastructure layer provides implementation.
 */
export interface CsvRowParser {
  parse(row: Record<string, string>, format: BankFormat): ParsedRow
}

/**
 * Error thrown when CSV parsing fails
 */
export class CsvParseError extends Error {
  readonly code = "CSV_PARSE_ERROR"

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: string
  ) {
    super(message)
    this.name = "CsvParseError"
  }
}

export interface ImportBankStatementInput {
  bankAccountId: string
  rows: Record<string, string>[]
  format: BankFormat
}

export interface ImportBankStatementOutput {
  imported: number
  duplicates: number
  errors: string[]
}

/**
 * Imports bank statement rows and saves them as BankTransactions.
 * Handles deduplication and tracks errors for invalid rows.
 */
export class ImportBankStatement {
  constructor(
    private readonly repository: BankTransactionRepository,
    private readonly csvParser: CsvRowParser
  ) {}

  async execute(input: ImportBankStatementInput): Promise<ImportBankStatementOutput> {
    const { bankAccountId, rows, format } = input

    // Load existing transactions for deduplication
    const existingTransactions = await this.repository.findByBankAccount(bankAccountId)
    const deduplicator = new ImportDeduplicator(existingTransactions)

    let imported = 0
    let duplicates = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1

      // Parse the CSV row (throws CsvParseError on failure)
      let parsedData: ParsedRow
      try {
        parsedData = this.csvParser.parse(row, format)
      } catch (error) {
        if (error instanceof CsvParseError) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        } else {
          const message = error instanceof Error ? error.message : "Unknown parse error"
          errors.push(`Row ${rowNumber}: ${message}`)
        }
        continue
      }

      // Generate external ID if not provided
      const externalId = parsedData.externalId || this.generateExternalId(parsedData)

      // Create BankTransaction entity
      let transaction: BankTransaction
      try {
        transaction = BankTransaction.create({
          externalId,
          bankAccountId,
          date: parsedData.date,
          amount: parsedData.amount,
          direction: parsedData.direction,
          balance: parsedData.balance || Money.zero(),
          counterpartyName: parsedData.counterpartyName,
          counterpartyIban: parsedData.counterpartyIban,
          reference: parsedData.reference,
          description: parsedData.description,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        errors.push(`Row ${rowNumber}: Failed to create transaction - ${message}`)
        continue
      }

      // Check for duplicates
      const duplicateCheck = deduplicator.check(transaction)
      if (duplicateCheck.isDuplicate) {
        duplicates++
        continue
      }

      // Save the transaction
      try {
        await this.repository.save(transaction)
        imported++
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        errors.push(`Row ${rowNumber}: Failed to save transaction - ${message}`)
      }
    }

    return {
      imported,
      duplicates,
      errors,
    }
  }

  /**
   * Generate a deterministic external ID from transaction data.
   * Used when the bank doesn't provide a unique transaction ID.
   */
  private generateExternalId(parsed: ParsedRow): string {
    const dateStr = parsed.date.toISOString().slice(0, 10)
    const amountStr = parsed.amount.toDecimal().toString()
    const refStr = parsed.reference || "no-ref"
    return `${dateStr}-${amountStr}-${refStr}`.replace(/[^a-zA-Z0-9-]/g, "_")
  }
}
