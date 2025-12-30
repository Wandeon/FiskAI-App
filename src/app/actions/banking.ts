"use server"

import { db, runWithTenant } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { MatchKind, MatchSource, MatchStatus, Prisma, ImportFormat } from "@prisma/client"
import { createHash } from "crypto"
import { logAudit } from "@/lib/audit"

const Decimal = Prisma.Decimal

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

interface CreateBankAccountInput {
  name: string
  iban: string
  bankName: string
  currency?: string
  currentBalance?: number
}

interface UpdateBankAccountInput {
  name?: string
  bankName?: string
  isDefault?: boolean
}

interface ImportTransactionInput {
  date: Date
  description: string
  amount: number
  balance: number
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
}

/**
 * Validate Croatian IBAN format
 * Croatian IBANs start with HR and have 21 characters total
 */
function validateIBAN(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, "").toUpperCase()
  return /^HR\d{19}$/.test(cleanIban)
}

/**
 * Create a new bank account
 */
export async function createBankAccount(
  data: CreateBankAccountInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Validate IBAN format
      const cleanIban = data.iban.replace(/\s/g, "").toUpperCase()
      if (!validateIBAN(cleanIban)) {
        return {
          success: false,
          error: "Neispravan IBAN format. Hrvatski IBAN mora počinjati s HR i imati 21 znak.",
        }
      }

      // Check if IBAN already exists for this company
      const existing = await db.bankAccount.findFirst({
        where: {
          companyId: company.id,
          iban: cleanIban,
        },
      })

      if (existing) {
        return { success: false, error: "Račun s ovim IBAN-om već postoji" }
      }

      const bankAccount = await db.bankAccount.create({
        data: {
          companyId: company.id,
          name: data.name,
          iban: cleanIban,
          bankName: data.bankName,
          currency: data.currency || "EUR",
          currentBalance: new Decimal(data.currentBalance || 0),
          isDefault: false,
        },
      })

      revalidatePath("/banking")
      return { success: true, data: { id: bankAccount.id } }
    })
  } catch (error) {
    console.error("Failed to create bank account:", error)
    return { success: false, error: "Greška pri kreiranju bankovnog računa" }
  }
}

/**
 * Update bank account details
 */
export async function updateBankAccount(
  id: string,
  data: UpdateBankAccountInput
): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify account exists and belongs to company
      const existing = await db.bankAccount.findFirst({
        where: { id, companyId: company.id },
      })

      if (!existing) {
        return { success: false, error: "Bankovni račun nije pronađen" }
      }

      // If setting as default, unset other defaults
      if (data.isDefault === true) {
        await db.bankAccount.updateMany({
          where: {
            companyId: company.id,
            id: { not: id },
          },
          data: { isDefault: false },
        })
      }

      const updateData: Prisma.BankAccountUpdateInput = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.bankName !== undefined) updateData.bankName = data.bankName
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault

      await db.bankAccount.update({
        where: { id },
        data: updateData,
      })

      revalidatePath("/banking")
      revalidatePath(`/banking/${id}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to update bank account:", error)
    return { success: false, error: "Greška pri ažuriranju bankovnog računa" }
  }
}

/**
 * Delete a bank account (only if no transactions linked)
 */
export async function deleteBankAccount(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify account exists and belongs to company
      const account = await db.bankAccount.findFirst({
        where: { id, companyId: company.id },
      })

      if (!account) {
        return { success: false, error: "Bankovni račun nije pronađen" }
      }

      // Check for linked transactions
      const transactionCount = await db.bankTransaction.count({
        where: { bankAccountId: id },
      })

      if (transactionCount > 0) {
        return {
          success: false,
          error: `Nije moguće obrisati račun koji ima ${transactionCount} transakcija`,
        }
      }

      await db.bankAccount.delete({ where: { id } })

      revalidatePath("/banking")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete bank account:", error)
    return { success: false, error: "Greška pri brisanju bankovnog računa" }
  }
}

/**
 * Import bank statement transactions
 */
export async function importBankStatement(
  bankAccountId: string,
  format: ImportFormat,
  transactions: ImportTransactionInput[]
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify bank account exists and belongs to company
      const bankAccount = await db.bankAccount.findFirst({
        where: { id: bankAccountId, companyId: company.id },
      })

      if (!bankAccount) {
        return { success: false, error: "Bankovni račun nije pronađen" }
      }

      if (!transactions || transactions.length === 0) {
        return { success: false, error: "Nema transakcija za uvoz" }
      }

      // Create import record and transactions in a transaction
      const result = await db.$transaction(async (tx) => {
        const checksumPayload = JSON.stringify({
          bankAccountId,
          format,
          transactions: transactions.map((txn) => ({
            date: txn.date.toISOString(),
            description: txn.description,
            amount: txn.amount,
            balance: txn.balance,
            reference: txn.reference ?? null,
            counterpartyName: txn.counterpartyName ?? null,
            counterpartyIban: txn.counterpartyIban ?? null,
          })),
        })
        const checksum = createHash("sha256").update(checksumPayload).digest("hex")

        const existingImport = await tx.statementImport.findFirst({
          where: { bankAccountId, fileChecksum: checksum },
        })
        if (existingImport) {
          return { importId: existingImport.id, count: 0, deduplicated: true }
        }

        const statementImport = await tx.statementImport.create({
          data: {
            companyId: company.id,
            bankAccountId,
            fileName: `import-${new Date().toISOString()}.${format.toLowerCase()}`,
            fileChecksum: checksum,
            format,
            transactionCount: transactions.length,
            importedBy: user.id!,
            metadata: {
              source: "manual_csv",
            },
          },
        })

        // Create transactions
        let importedCount = 0
        for (const txn of transactions) {
          // Check if transaction already exists (by date, amount, and reference)
          const existing = await tx.bankTransaction.findFirst({
            where: {
              bankAccountId,
              date: txn.date,
              amount: new Decimal(txn.amount),
              reference: txn.reference || null,
            },
          })

          // Skip duplicates
          if (existing) continue

          await tx.bankTransaction.create({
            data: {
              companyId: company.id,
              bankAccountId,
              statementImportId: statementImport.id,
              date: txn.date,
              description: txn.description,
              amount: new Decimal(txn.amount),
              balance: new Decimal(txn.balance),
              reference: txn.reference || null,
              counterpartyName: txn.counterpartyName || null,
              counterpartyIban: txn.counterpartyIban || null,
              matchStatus: "UNMATCHED",
            },
          })
          importedCount++
        }

        // Update bank account balance with the latest transaction balance
        if (transactions.length > 0) {
          const latestTransaction = transactions.reduce((latest, txn) =>
            txn.date > latest.date ? txn : latest
          )
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: {
              currentBalance: new Decimal(latestTransaction.balance),
              lastSyncAt: new Date(),
            },
          })
        }

        return { importId: statementImport.id, count: importedCount, deduplicated: false }
      })

      revalidatePath("/banking")
      revalidatePath(`/banking/${bankAccountId}`)
      return { success: true, data: { count: result.count } }
    })
  } catch (error) {
    console.error("Failed to import bank statement:", error)
    return { success: false, error: "Greška pri uvozu bankovnog izvoda" }
  }
}

/**
 * Manually match a transaction to an invoice or expense
 */
export async function matchTransaction(
  transactionId: string,
  type: "invoice" | "expense",
  matchId: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify transaction exists and belongs to company
      const transaction = await db.bankTransaction.findFirst({
        where: { id: transactionId, companyId: company.id },
        include: {
          matchRecords: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      if (!transaction) {
        return { success: false, error: "Transakcija nije pronađena" }
      }

      const latestMatch = transaction.matchRecords[0]
      if (
        latestMatch &&
        latestMatch.matchStatus !== MatchStatus.UNMATCHED &&
        latestMatch.matchStatus !== MatchStatus.IGNORED
      ) {
        return { success: false, error: "Transakcija je već povezana" }
      }

      // Verify the match entity exists
      if (type === "invoice") {
        const invoice = await db.eInvoice.findFirst({
          where: { id: matchId, companyId: company.id },
        })
        if (!invoice) {
          return { success: false, error: "Račun nije pronađen" }
        }
      } else if (type === "expense") {
        const expense = await db.expense.findFirst({
          where: { id: matchId, companyId: company.id },
        })
        if (!expense) {
          return { success: false, error: "Trošak nije pronađen" }
        }
      }

      // Update transaction with match
      await db.matchRecord.create({
        data: {
          companyId: company.id,
          bankTransactionId: transactionId,
          matchStatus: MatchStatus.MANUAL_MATCHED,
          matchKind: type === "invoice" ? MatchKind.INVOICE : MatchKind.EXPENSE,
          matchedInvoiceId: type === "invoice" ? matchId : undefined,
          matchedExpenseId: type === "expense" ? matchId : undefined,
          confidenceScore: 100,
          reason: "Manual match",
          source: MatchSource.MANUAL,
          createdBy: user.id!,
        },
      })

      const beforeMatch = latestMatch
        ? {
            matchStatus: latestMatch.matchStatus,
            matchKind: latestMatch.matchKind,
            matchedInvoiceId: latestMatch.matchedInvoiceId,
            matchedExpenseId: latestMatch.matchedExpenseId,
          }
        : { matchStatus: MatchStatus.UNMATCHED }

      await logAudit({
        companyId: company.id,
        userId: user.id!,
        action: "UPDATE",
        entity: "BankTransaction",
        entityId: transactionId,
        reason: type === "invoice" ? "bank_match_invoice" : "bank_match_expense",
        changes: {
          before: beforeMatch,
          after: {
            matchStatus: MatchStatus.MANUAL_MATCHED,
            matchKind: type === "invoice" ? MatchKind.INVOICE : MatchKind.EXPENSE,
            matchedInvoiceId: type === "invoice" ? matchId : null,
            matchedExpenseId: type === "expense" ? matchId : null,
          },
        },
      })

      revalidatePath("/banking")
      revalidatePath(`/banking/transactions/${transactionId}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to match transaction:", error)
    return { success: false, error: "Greška pri povezivanju transakcije" }
  }
}

/**
 * Remove match from a transaction
 */
export async function unmatchTransaction(transactionId: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify transaction exists and belongs to company
      const transaction = await db.bankTransaction.findFirst({
        where: { id: transactionId, companyId: company.id },
        include: {
          matchRecords: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      if (!transaction) {
        return { success: false, error: "Transakcija nije pronađena" }
      }

      const latestMatch = transaction.matchRecords[0]
      if (!latestMatch || latestMatch.matchStatus === MatchStatus.UNMATCHED) {
        return { success: false, error: "Transakcija nije povezana" }
      }

      await db.matchRecord.create({
        data: {
          companyId: company.id,
          bankTransactionId: transactionId,
          matchStatus: MatchStatus.UNMATCHED,
          matchKind: MatchKind.UNMATCH,
          source: MatchSource.MANUAL,
          reason: "Manual unlink",
          createdBy: user.id!,
        },
      })

      await logAudit({
        companyId: company.id,
        userId: user.id!,
        action: "UPDATE",
        entity: "BankTransaction",
        entityId: transactionId,
        reason: "bank_unmatch",
        changes: {
          before: {
            matchStatus: latestMatch.matchStatus,
            matchKind: latestMatch.matchKind,
            matchedInvoiceId: latestMatch.matchedInvoiceId,
            matchedExpenseId: latestMatch.matchedExpenseId,
          },
          after: {
            matchStatus: MatchStatus.UNMATCHED,
            matchKind: MatchKind.UNMATCH,
            matchedInvoiceId: null,
            matchedExpenseId: null,
          },
        },
      })

      revalidatePath("/banking")
      revalidatePath(`/banking/transactions/${transactionId}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to unmatch transaction:", error)
    return { success: false, error: "Greška pri uklanjanju poveznice" }
  }
}

/**
 * Mark a transaction as ignored
 */
export async function ignoreTransaction(transactionId: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify transaction exists and belongs to company
      const transaction = await db.bankTransaction.findFirst({
        where: { id: transactionId, companyId: company.id },
      })

      if (!transaction) {
        return { success: false, error: "Transakcija nije pronađena" }
      }

      await db.matchRecord.create({
        data: {
          companyId: company.id,
          bankTransactionId: transactionId,
          matchStatus: MatchStatus.IGNORED,
          matchKind: MatchKind.IGNORE,
          source: MatchSource.MANUAL,
          reason: "Ignored",
          createdBy: user.id!,
        },
      })

      revalidatePath("/banking")
      revalidatePath(`/banking/transactions/${transactionId}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to ignore transaction:", error)
    return { success: false, error: "Greška pri ignoriranju transakcije" }
  }
}

/**
 * Automatically match unmatched transactions
 */
export async function autoMatchTransactions(
  bankAccountId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      // Verify bank account exists
      const bankAccount = await db.bankAccount.findFirst({
        where: { id: bankAccountId, companyId: company.id },
      })

      if (!bankAccount) {
        return { success: false, error: "Bankovni račun nije pronađen" }
      }

      const result = await runAutoMatchTransactions({
        companyId: company.id,
        bankAccountId,
        userId: user.id!,
      })

      revalidatePath("/banking")
      revalidatePath(`/banking/${bankAccountId}`)
      return { success: true, data: { count: result.matchedCount } }
    })
  } catch (error) {
    console.error("Failed to auto-match transactions:", error)
    return { success: false, error: "Greška pri automatskom povezivanju transakcija" }
  }
}
