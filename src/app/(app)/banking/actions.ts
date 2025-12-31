"use server"

import { db, runWithTenant } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { runAutoMatchTransactions } from "@/lib/banking/reconciliation-service"
import { createHash } from "crypto"

const createBankAccountSchema = z.object({
  name: z.string().min(1, "Naziv je obavezan"),
  iban: z
    .string()
    .transform((val) => val.replace(/\s/g, "").toUpperCase())
    .refine((val) => /^HR\d{19}$/.test(val), {
      message: "IBAN mora biti u formatu HR + 19 znamenki",
    }),
  bankName: z.string().min(1, "Naziv banke je obavezan"),
  currency: z.string().default("EUR"),
  isDefault: z.boolean().optional().default(false),
})

export async function createBankAccount(formData: FormData) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const data = {
    name: formData.get("name"),
    iban: formData.get("iban"),
    bankName: formData.get("bankName"),
    currency: formData.get("currency") || "EUR",
    isDefault: formData.get("isDefault") === "on",
  }

  const validation = createBankAccountSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0].message,
    }
  }

  return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    try {
      // If this is the first account, make it default
      const existingCount = await db.bankAccount.count({
        where: { companyId: company.id },
      })

      const isDefault = validation.data.isDefault || existingCount === 0

      // If setting as default, unset other defaults
      if (isDefault) {
        await db.bankAccount.updateMany({
          where: { companyId: company.id, isDefault: true },
          data: { isDefault: false },
        })
      }

      const account = await db.bankAccount.create({
        data: {
          ...validation.data,
          companyId: company.id,
          currentBalance: 0,
          isDefault,
        },
      })

      revalidatePath("/banking")
      revalidatePath("/banking/accounts")

      return {
        success: true,
        data: account,
      }
    } catch (error) {
      console.error("[createBankAccount] Error:", error)
      if ((error as { code?: string }).code === "P2002") {
        return {
          success: false,
          error: "Račun s ovim IBAN-om već postoji",
        }
      }
      return {
        success: false,
        error: "Greška pri kreiranju računa",
      }
    }
  })
}

export async function deleteBankAccount(accountId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    try {
      // Check if account has transactions
      const transactionCount = await db.bankTransaction.count({
        where: { bankAccountId: accountId },
      })

      if (transactionCount > 0) {
        return {
          success: false,
          error: "Ne možete obrisati račun koji ima transakcije",
        }
      }

      await db.bankAccount.delete({
        where: { id: accountId },
      })

      revalidatePath("/banking")
      revalidatePath("/banking/accounts")

      return { success: true }
    } catch (error) {
      console.error("[deleteBankAccount] Error:", error)
      return {
        success: false,
        error: "Greška pri brisanju računa",
      }
    }
  })
}

export async function setDefaultBankAccount(accountId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    try {
      // Unset all defaults
      await db.bankAccount.updateMany({
        where: { companyId: company.id, isDefault: true },
        data: { isDefault: false },
      })

      // Set new default
      await db.bankAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      })

      revalidatePath("/banking")
      revalidatePath("/banking/accounts")

      return { success: true }
    } catch (error) {
      console.error("[setDefaultBankAccount] Error:", error)
      return {
        success: false,
        error: "Greška pri postavljanju zadanog računa",
      }
    }
  })
}

const importTransactionSchema = z.object({
  accountId: z.string(),
  date: z.string().or(z.date()),
  description: z.string(),
  amount: z.number().or(z.string()),
  balance: z.number().or(z.string()).optional(),
  reference: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyIban: z.string().optional(),
  currency: z.string().optional(),
})

export async function importBankStatement(formData: FormData) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const accountId = formData.get("accountId") as string
  const fileName = formData.get("fileName") as string
  const transactionsJson = formData.get("transactions") as string

  if (!accountId || !transactionsJson) {
    return {
      success: false,
      error: "Nedostaju podaci",
    }
  }

  return runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    try {
      const transactions = JSON.parse(transactionsJson)

      // Validate all transactions
      console.log("[importBankStatement] Parsing transactions:", transactions.length, "items")

      const validatedTransactions = transactions.map(
        (t: Record<string, unknown>, index: number) => {
          // Ensure amount and balance are numbers
          const processed = {
            ...t,
            accountId,
            amount: typeof t.amount === "string" ? parseFloat(t.amount) : t.amount,
            balance:
              t.balance !== undefined
                ? typeof t.balance === "string"
                  ? parseFloat(t.balance)
                  : t.balance
                : 0,
          }

          const validation = importTransactionSchema.safeParse(processed)
          if (!validation.success) {
            console.error(
              `[importBankStatement] Transaction ${index} validation failed:`,
              validation.error.issues
            )
            throw new Error(
              `Invalid transaction at row ${index + 1}: ${validation.error.issues[0].message}`
            )
          }
          return validation.data
        }
      )

      const checksumPayload = JSON.stringify({
        bankAccountId: accountId,
        format: "CSV",
        transactions: validatedTransactions.map((txn: z.infer<typeof importTransactionSchema>) => ({
          date: txn.date,
          description: txn.description,
          amount: txn.amount,
          balance: txn.balance,
          reference: txn.reference ?? null,
          counterpartyName: txn.counterpartyName ?? null,
          counterpartyIban: txn.counterpartyIban ?? null,
        })),
      })
      const checksum = createHash("sha256").update(checksumPayload).digest("hex")

      const existingImport = await db.statementImport.findFirst({
        where: { bankAccountId: accountId, fileChecksum: checksum },
      })
      if (existingImport) {
        return {
          success: true,
          data: { deduplicated: true, importId: existingImport.id },
        }
      }

      const importRecord = await db.statementImport.create({
        data: {
          companyId: company.id,
          bankAccountId: accountId,
          fileName: fileName || "imported.csv",
          fileChecksum: checksum,
          format: "CSV",
          transactionCount: validatedTransactions.length,
          importedBy: user.id!,
          metadata: { source: "manual_csv" },
        },
      })

      // Insert transactions
      for (const txn of validatedTransactions) {
        await db.bankTransaction.create({
          data: {
            companyId: company.id,
            bankAccountId: accountId,
            statementImportId: importRecord.id,
            date: new Date(txn.date),
            description: txn.description,
            amount: typeof txn.amount === "string" ? parseFloat(txn.amount) : txn.amount,
            balance:
              txn.balance !== undefined
                ? typeof txn.balance === "string"
                  ? parseFloat(txn.balance)
                  : txn.balance
                : 0,
            reference: txn.reference || null,
            counterpartyName: txn.counterpartyName || null,
            counterpartyIban: txn.counterpartyIban || null,
            matchStatus: "UNMATCHED",
            confidenceScore: 0,
          },
        })
      }

      // Update account balance if provided
      const lastBalance = validatedTransactions[validatedTransactions.length - 1]?.balance
      if (lastBalance !== undefined) {
        await db.bankAccount.update({
          where: { id: accountId },
          data: {
            currentBalance: typeof lastBalance === "string" ? parseFloat(lastBalance) : lastBalance,
            lastSyncAt: new Date(),
          },
        })
      }

      const autoMatchResult = await runAutoMatchTransactions({
        companyId: company.id,
        bankAccountId: accountId,
        userId: user.id!,
      })

      revalidatePath("/banking")
      revalidatePath("/banking/transactions")

      return {
        success: true,
        data: {
          importId: importRecord.id,
          count: validatedTransactions.length,
          autoMatchedCount: autoMatchResult.matchedCount,
          autoMatchedEvaluated: autoMatchResult.evaluated,
        },
      }
    } catch (error) {
      console.error("[importBankStatement] Error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Greška pri uvozu izvoda",
      }
    }
  })
}
