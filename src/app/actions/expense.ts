"use server"

import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { Prisma, ExpenseStatus, PaymentMethod, Frequency } from "@prisma/client"
import { z } from "zod"
import { calculateVatInputAmounts, evaluateVatInputRules } from "@/lib/vat/input-vat"
import { emitAssetCandidates } from "@/lib/fixed-assets/asset-candidates"

const Decimal = Prisma.Decimal

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

interface CreateExpenseInput {
  categoryId: string
  vendorId?: string
  description: string
  date: Date
  dueDate?: Date
  netAmount: number
  vatAmount: number
  vatRate: number
  totalAmount: number
  vatDeductible?: boolean
  currency?: string
  paymentMethod?: string
  notes?: string
  receiptUrl?: string
  lines?: ExpenseLineInput[]
}

interface ExpenseLineInput {
  description: string
  quantity: number
  unitPrice: number
  netAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
}

function resolveReceiptFileName(url: string): string {
  try {
    const parsed = new URL(url)
    const name = parsed.pathname.split("/").pop()
    return name || "receipt"
  } catch {
    const parts = url.split("/")
    return parts[parts.length - 1] || "receipt"
  }
}

function buildDefaultExpenseLine(input: CreateExpenseInput): ExpenseLineInput {
  return {
    description: input.description,
    quantity: 1,
    unitPrice: input.netAmount,
    netAmount: input.netAmount,
    vatRate: input.vatRate,
    vatAmount: input.vatAmount,
    totalAmount: input.totalAmount,
  }
}

export async function createExpense(input: CreateExpenseInput): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:create", async (company) => {
      // Verify category exists
      // Note: ExpenseCategory requires explicit companyId because:
      // 1. Global categories (companyId: null) must be accessible to all tenants
      // 2. Company-specific categories must be tenant-isolated
      // 3. The OR condition cannot be handled by tenant middleware
      const category = await db.expenseCategory.findFirst({
        where: {
          id: input.categoryId,
          OR: [{ companyId: company.id }, { companyId: null }],
        },
      })

      if (!category) {
        return { success: false, error: "Kategorija nije pronađena" }
      }

      // Check if receipt is required for this category
      if (category.receiptRequired && !input.receiptUrl) {
        return {
          success: false,
          error: "Račun je obavezan za ovu kategoriju troška",
        }
      }

      // Verify vendor if provided (automatically filtered by tenant context)
      let vendor = null as null | { name: string; vatNumber: string | null; oib: string | null }
      if (input.vendorId) {
        vendor = await db.contact.findFirst({
          where: { id: input.vendorId },
          select: { name: true, vatNumber: true, oib: true },
        })
        if (!vendor) {
          return { success: false, error: "Dobavljač nije pronađen" }
        }
      }

      const status: ExpenseStatus = input.paymentMethod ? "PAID" : "DRAFT"
      const lineItems = (input.lines?.length ? input.lines : [buildDefaultExpenseLine(input)]).map(
        (line) => ({
          description: line.description,
          quantity: new Decimal(line.quantity),
          unitPrice: new Decimal(line.unitPrice),
          netAmount: new Decimal(line.netAmount),
          vatRate: new Decimal(line.vatRate),
          vatAmount: new Decimal(line.vatAmount),
          totalAmount: new Decimal(line.totalAmount),
        })
      )

      const expense = await db.$transaction(async (tx) => {
        const createdExpense = await tx.expense.create({
          data: {
            companyId: company.id,
            categoryId: input.categoryId,
            vendorId: input.vendorId || null,
            description: input.description,
            date: input.date,
            dueDate: input.dueDate || null,
            netAmount: new Decimal(input.netAmount),
            vatAmount: new Decimal(input.vatAmount),
            vatRate: new Decimal(input.vatRate),
            totalAmount: new Decimal(input.totalAmount),
            vatDeductible: input.vatDeductible ?? true,
            currency: input.currency || "EUR",
            status,
            paymentMethod: input.paymentMethod as PaymentMethod | null,
            paymentDate: input.paymentMethod ? new Date() : null,
            notes: input.notes || null,
            receiptUrl: input.receiptUrl || null,
            lines: {
              create: lineItems,
            },
          },
          include: { lines: true },
        })

        if (input.receiptUrl) {
          await tx.attachment.create({
            data: {
              expenseId: createdExpense.id,
              fileName: resolveReceiptFileName(input.receiptUrl),
              contentType: "application/octet-stream",
              url: input.receiptUrl,
              sourceType: "UPLOAD",
              isSourceImmutable: false,
            },
          })
        }

        for (const line of createdExpense.lines) {
          const { references } = await evaluateVatInputRules(
            tx,
            company,
            createdExpense,
            line,
            category
          )
          const { deductibleVatAmount, nonDeductibleVatAmount } = calculateVatInputAmounts(
            createdExpense,
            line,
            references
          )

          await tx.uraInput.create({
            data: {
              expenseId: createdExpense.id,
              expenseLineId: line.id,
              date: createdExpense.date,
              vendorName: vendor?.name ?? null,
              vendorVatNumber: vendor?.vatNumber ?? vendor?.oib ?? null,
              netAmount: line.netAmount,
              vatRate: line.vatRate,
              vatAmount: line.vatAmount,
              totalAmount: line.totalAmount,
              deductibleVatAmount: new Decimal(deductibleVatAmount),
              nonDeductibleVatAmount: new Decimal(nonDeductibleVatAmount),
              ruleReferences: references,
            },
          })
        }

        await emitAssetCandidates(tx, {
          expense: createdExpense,
          lines: createdExpense.lines,
        })

        return createdExpense
      })

      revalidatePath("/expenses")
      return { success: true, data: expense }
    })
  } catch (error) {
    console.error("Failed to create expense:", error)
    return { success: false, error: "Greška pri kreiranju troška" }
  }
}

export async function updateExpense(
  id: string,
  input: Partial<CreateExpenseInput>
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:update", async (company) => {
      const existing = await db.expense.findFirst({
        where: { id },
        include: { lines: true },
      })

      if (!existing) {
        return { success: false, error: "Trošak nije pronađen" }
      }

      const updateData: Prisma.ExpenseUpdateInput = {}

      // Check if category is being changed and validate receipt requirement
      if (input.categoryId) {
        const category = await db.expenseCategory.findFirst({
          where: {
            id: input.categoryId,
            OR: [{ companyId: existing.companyId }, { companyId: null }],
          },
        })

        if (!category) {
          return { success: false, error: "Kategorija nije pronađena" }
        }

        // If changing category, check if new category requires receipt
        const finalReceiptUrl =
          (input as CreateExpenseInput & { receiptUrl?: string }).receiptUrl !== undefined
            ? (input as CreateExpenseInput & { receiptUrl?: string }).receiptUrl
            : existing.receiptUrl

        if (category.receiptRequired && !finalReceiptUrl) {
          return {
            success: false,
            error: "Račun je obavezan za ovu kategoriju troška",
          }
        }

        updateData.category = { connect: { id: input.categoryId } }
      }
      if (input.vendorId !== undefined) {
        updateData.vendor = input.vendorId
          ? { connect: { id: input.vendorId } }
          : { disconnect: true }
      }
      if (input.description) updateData.description = input.description
      if (input.date) updateData.date = input.date
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate
      if (input.netAmount !== undefined) updateData.netAmount = new Decimal(input.netAmount)
      if (input.vatAmount !== undefined) updateData.vatAmount = new Decimal(input.vatAmount)
      if (input.totalAmount !== undefined) updateData.totalAmount = new Decimal(input.totalAmount)
      if (input.vatRate !== undefined) updateData.vatRate = new Decimal(input.vatRate)
      if (input.vatDeductible !== undefined) updateData.vatDeductible = input.vatDeductible
      if (input.notes !== undefined) updateData.notes = input.notes
      if (input.paymentMethod !== undefined) {
        updateData.paymentMethod = input.paymentMethod as PaymentMethod | null
        if (input.paymentMethod) {
          updateData.status = "PAID"
          updateData.paymentDate = new Date()
        }
      }
      if ((input as CreateExpenseInput & { receiptUrl?: string }).receiptUrl !== undefined) {
        updateData.receiptUrl =
          (input as CreateExpenseInput & { receiptUrl?: string }).receiptUrl || null
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {}
      const trackChange = (field: keyof CreateExpenseInput, before: unknown, after: unknown) => {
        if (after !== undefined && before !== after) {
          changes[field] = { before, after }
        }
      }

      trackChange("description", existing.description, input.description)
      trackChange("date", existing.date, input.date)
      trackChange("dueDate", existing.dueDate, input.dueDate)
      trackChange("netAmount", Number(existing.netAmount), input.netAmount)
      trackChange("vatAmount", Number(existing.vatAmount), input.vatAmount)
      trackChange("vatRate", Number(existing.vatRate), input.vatRate)
      trackChange("totalAmount", Number(existing.totalAmount), input.totalAmount)
      trackChange("vatDeductible", existing.vatDeductible, input.vatDeductible)
      trackChange("notes", existing.notes, input.notes)
      trackChange("paymentMethod", existing.paymentMethod, input.paymentMethod)
      trackChange("receiptUrl", existing.receiptUrl, input.receiptUrl)
      if (input.vendorId !== undefined) {
        trackChange("vendorId", existing.vendorId, input.vendorId)
      }
      if (input.categoryId !== undefined) {
        trackChange("categoryId", existing.categoryId, input.categoryId)
      }

      const expense = await db.$transaction(async (tx) => {
        const updatedExpense = await tx.expense.update({
          where: { id },
          data: updateData,
          include: { lines: true, category: true, vendor: true },
        })

        if (Object.keys(changes).length > 0) {
          await tx.expenseCorrection.create({
            data: {
              expenseId: updatedExpense.id,
              userId: user.id,
              changes,
            },
          })
        }

        if (
          updatedExpense.lines.length === 1 &&
          (input.description ||
            input.netAmount !== undefined ||
            input.vatAmount !== undefined ||
            input.vatRate !== undefined ||
            input.totalAmount !== undefined)
        ) {
          const line = updatedExpense.lines[0]
          await tx.expenseLine.update({
            where: { id: line.id },
            data: {
              description: updatedExpense.description,
              quantity: new Decimal(1),
              unitPrice: new Decimal(updatedExpense.netAmount),
              netAmount: updatedExpense.netAmount,
              vatRate: updatedExpense.vatRate,
              vatAmount: updatedExpense.vatAmount,
              totalAmount: updatedExpense.totalAmount,
            },
          })
        }

        if (input.receiptUrl) {
          await tx.attachment.create({
            data: {
              expenseId: updatedExpense.id,
              fileName: resolveReceiptFileName(input.receiptUrl),
              contentType: "application/octet-stream",
              url: input.receiptUrl,
              sourceType: "UPLOAD",
              isSourceImmutable: false,
            },
          })
        }

        await tx.uraInput.deleteMany({
          where: { expenseId: updatedExpense.id },
        })

        const refreshedLines = await tx.expenseLine.findMany({
          where: { expenseId: updatedExpense.id },
        })

        for (const line of refreshedLines) {
          const { references } = await evaluateVatInputRules(
            tx,
            company,
            updatedExpense,
            line,
            updatedExpense.category
          )
          const { deductibleVatAmount, nonDeductibleVatAmount } = calculateVatInputAmounts(
            updatedExpense,
            line,
            references
          )

          await tx.uraInput.create({
            data: {
              expenseId: updatedExpense.id,
              expenseLineId: line.id,
              date: updatedExpense.date,
              vendorName: updatedExpense.vendor?.name ?? null,
              vendorVatNumber:
                updatedExpense.vendor?.vatNumber ?? updatedExpense.vendor?.oib ?? null,
              netAmount: line.netAmount,
              vatRate: line.vatRate,
              vatAmount: line.vatAmount,
              totalAmount: line.totalAmount,
              deductibleVatAmount: new Decimal(deductibleVatAmount),
              nonDeductibleVatAmount: new Decimal(nonDeductibleVatAmount),
              ruleReferences: references,
            },
          })
        }

        await tx.fixedAssetCandidate.deleteMany({
          where: { expenseId: updatedExpense.id },
        })

        await emitAssetCandidates(tx, {
          expense: updatedExpense,
          lines: refreshedLines,
        })

        return updatedExpense
      })

      revalidatePath("/expenses")
      revalidatePath(`/expenses/${id}`)
      return { success: true, data: expense }
    })
  } catch (error) {
    console.error("Failed to update expense:", error)
    return { success: false, error: "Greška pri ažuriranju troška" }
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:delete", async () => {
      const expense = await db.expense.findFirst({
        where: { id },
      })

      if (!expense) {
        return { success: false, error: "Trošak nije pronađen" }
      }

      await db.expense.delete({ where: { id } })

      revalidatePath("/expenses")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete expense:", error)

    // Check if this is a permission error
    if (error instanceof Error && error.message.includes("Permission denied")) {
      return { success: false, error: "Nemate dopuštenje za brisanje troškova" }
    }

    return { success: false, error: "Greška pri brisanju troška" }
  }
}

export async function markExpenseAsPaid(
  id: string,
  paymentMethod: PaymentMethod
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:update", async () => {
      const expense = await db.expense.findFirst({
        where: { id },
      })

      if (!expense) {
        return { success: false, error: "Trošak nije pronađen" }
      }

      if (expense.status === "PAID") {
        return { success: false, error: "Trošak je već plaćen" }
      }

      await db.expense.update({
        where: { id },
        data: {
          status: "PAID",
          paymentMethod,
          paymentDate: new Date(),
        },
      })

      revalidatePath("/expenses")
      revalidatePath(`/expenses/${id}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to mark expense as paid:", error)
    return { success: false, error: "Greška pri označavanju plaćanja" }
  }
}

const expenseInlineSchema = z.object({
  status: z.nativeEnum(ExpenseStatus).optional(),
  totalAmount: z.number().optional(),
})

export async function updateExpenseInline(
  id: string,
  input: Partial<z.infer<typeof expenseInlineSchema>>
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:update", async () => {
      const existing = await db.expense.findFirst({
        where: { id },
      })

      if (!existing) {
        return { success: false, error: "Trošak nije pronađen" }
      }

      const validated = expenseInlineSchema.safeParse(input)
      if (!validated.success) {
        return { success: false, error: "Neispravni podaci" }
      }

      const data: Prisma.ExpenseUpdateInput = {}
      if (validated.data.status) {
        data.status = validated.data.status
        if (validated.data.status === "PAID") {
          data.paymentDate = new Date()
          // Default to OTHER when payment method is not specified via inline update
          // This ensures paymentMethod is always set when marking as PAID
          data.paymentMethod = "OTHER"
        }
      }
      if (validated.data.totalAmount !== undefined) {
        data.totalAmount = new Decimal(validated.data.totalAmount)
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {}
      if (validated.data.status && existing.status !== validated.data.status) {
        changes.status = { before: existing.status, after: validated.data.status }
      }
      if (validated.data.totalAmount !== undefined) {
        changes.totalAmount = {
          before: Number(existing.totalAmount),
          after: validated.data.totalAmount,
        }
      }

      const expense = await db.$transaction(async (tx) => {
        const updatedExpense = await tx.expense.update({
          where: { id },
          data,
          include: { lines: true },
        })

        if (Object.keys(changes).length > 0) {
          await tx.expenseCorrection.create({
            data: {
              expenseId: updatedExpense.id,
              userId: user.id,
              changes,
            },
          })
        }

        if (validated.data.totalAmount !== undefined && updatedExpense.lines.length === 1) {
          await tx.expenseLine.update({
            where: { id: updatedExpense.lines[0].id },
            data: {
              totalAmount: new Decimal(validated.data.totalAmount),
            },
          })
        }

        return updatedExpense
      })

      revalidatePath("/expenses")
      return { success: true, data: expense }
    })
  } catch (error) {
    console.error("Failed to update expense inline:", error)
    return { success: false, error: "Greška pri ažuriranju" }
  }
}

// Category actions
export async function createExpenseCategory(input: {
  name: string
  code: string
  vatDeductibleDefault?: boolean
}): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense_category:create", async (company) => {
      // Check for duplicate code
      const existing = await db.expenseCategory.findUnique({
        where: { companyId_code: { companyId: company.id, code: input.code } },
      })

      if (existing) {
        return { success: false, error: `Kategorija s kodom ${input.code} već postoji` }
      }

      const category = await db.expenseCategory.create({
        data: {
          companyId: company.id,
          name: input.name,
          code: input.code.toUpperCase(),
          vatDeductibleDefault: input.vatDeductibleDefault ?? true,
        },
      })

      revalidatePath("/expenses/categories")
      return { success: true, data: category }
    })
  } catch (error) {
    console.error("Failed to create category:", error)
    return { success: false, error: "Greška pri kreiranju kategorije" }
  }
}

export async function updateExpenseCategory(
  id: string,
  input: {
    name?: string
    code?: string
    vatDeductibleDefault?: boolean
  }
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense_category:update", async (company) => {
      const category = await db.expenseCategory.findFirst({
        where: { id },
      })

      if (!category) {
        return { success: false, error: "Kategorija nije pronađena" }
      }

      // System categories (companyId: null) cannot be edited
      if (category.companyId === null) {
        return { success: false, error: "Nije moguće uređivati sistemske kategorije" }
      }

      // Check if code is being changed and if it conflicts
      if (input.code && input.code !== category.code) {
        const existing = await db.expenseCategory.findUnique({
          where: { companyId_code: { companyId: company.id, code: input.code } },
        })

        if (existing) {
          return { success: false, error: `Kategorija s kodom ${input.code} već postoji` }
        }
      }

      const updated = await db.expenseCategory.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code?.toUpperCase(),
          vatDeductibleDefault: input.vatDeductibleDefault,
        },
      })

      revalidatePath("/expenses/categories")
      return { success: true, data: updated }
    })
  } catch (error) {
    console.error("Failed to update category:", error)
    return { success: false, error: "Greška pri ažuriranju kategorije" }
  }
}

export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense_category:delete", async () => {
      const category = await db.expenseCategory.findFirst({
        where: { id },
      })

      if (!category) {
        return { success: false, error: "Kategorija nije pronađena" }
      }

      // System categories (companyId: null) cannot be deleted
      if (category.companyId === null) {
        return { success: false, error: "Nije moguće obrisati sistemske kategorije" }
      }

      // Check if category has expenses
      const expenseCount = await db.expense.count({ where: { categoryId: id } })
      if (expenseCount > 0) {
        return { success: false, error: "Nije moguće obrisati kategoriju koja ima troškove" }
      }

      await db.expenseCategory.delete({ where: { id } })

      revalidatePath("/expenses/categories")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete category:", error)

    // Check if this is a permission error
    if (error instanceof Error && error.message.includes("Permission denied")) {
      return { success: false, error: "Nemate dopuštenje za brisanje kategorija" }
    }

    return { success: false, error: "Greška pri brisanju kategorije" }
  }
}

// Seed default categories for a company
export async function seedDefaultCategories(): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense_category:create", async (company) => {
      const defaults = [
        { code: "OFFICE", name: "Uredski materijal", vatDeductibleDefault: true },
        { code: "TRAVEL", name: "Putni troškovi", vatDeductibleDefault: true },
        { code: "FUEL", name: "Gorivo", vatDeductibleDefault: false }, // 50% deductible
        { code: "TELECOM", name: "Telekomunikacije", vatDeductibleDefault: true },
        { code: "RENT", name: "Najam", vatDeductibleDefault: true },
        { code: "UTILITIES", name: "Režije", vatDeductibleDefault: true },
        { code: "SERVICES", name: "Usluge", vatDeductibleDefault: true },
        { code: "OTHER", name: "Ostalo", vatDeductibleDefault: false },
      ]

      for (const cat of defaults) {
        await db.expenseCategory.upsert({
          where: { companyId_code: { companyId: company.id, code: cat.code } },
          update: {},
          create: { ...cat, companyId: company.id },
        })
      }

      revalidatePath("/expenses/categories")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to seed categories:", error)
    return { success: false, error: "Greška pri kreiranju zadanih kategorija" }
  }
}

// Recurring expense actions
interface CreateRecurringExpenseInput {
  categoryId: string
  vendorId?: string
  description: string
  netAmount: number
  vatAmount: number
  totalAmount: number
  frequency: Frequency
  nextDate: Date
  endDate?: Date
}

export async function createRecurringExpense(
  input: CreateRecurringExpenseInput
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:create", async (company) => {
      // Verify category exists
      const category = await db.expenseCategory.findFirst({
        where: {
          id: input.categoryId,
          OR: [{ companyId: company.id }, { companyId: null }],
        },
      })

      if (!category) {
        return { success: false, error: "Kategorija nije pronađena" }
      }

      // Verify vendor if provided
      if (input.vendorId) {
        const vendor = await db.contact.findFirst({
          where: { id: input.vendorId },
        })
        if (!vendor) {
          return { success: false, error: "Dobavljač nije pronađen" }
        }
      }

      const recurringExpense = await db.recurringExpense.create({
        data: {
          companyId: company.id,
          categoryId: input.categoryId,
          vendorId: input.vendorId || null,
          description: input.description,
          netAmount: new Decimal(input.netAmount),
          vatAmount: new Decimal(input.vatAmount),
          vatRate: new Decimal(input.vatRate),
          totalAmount: new Decimal(input.totalAmount),
          frequency: input.frequency,
          nextDate: input.nextDate,
          endDate: input.endDate || null,
          isActive: true,
        },
      })

      revalidatePath("/expenses/recurring")
      return { success: true, data: recurringExpense }
    })
  } catch (error) {
    console.error("Failed to create recurring expense:", error)
    return { success: false, error: "Greška pri kreiranju ponavljajućeg troška" }
  }
}

export async function updateRecurringExpense(
  id: string,
  input: Partial<CreateRecurringExpenseInput>
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:update", async (company) => {
      const existing = await db.recurringExpense.findFirst({
        where: { id },
      })

      if (!existing) {
        return { success: false, error: "Ponavljajući trošak nije pronađen" }
      }

      const updateData: Prisma.RecurringExpenseUpdateInput = {}

      if (input.categoryId) {
        const category = await db.expenseCategory.findFirst({
          where: {
            id: input.categoryId,
            OR: [{ companyId: company.id }, { companyId: null }],
          },
        })
        if (!category) {
          return { success: false, error: "Kategorija nije pronađena" }
        }
        updateData.categoryId = input.categoryId
      }
      if (input.vendorId !== undefined) updateData.vendorId = input.vendorId
      if (input.description) updateData.description = input.description
      if (input.netAmount !== undefined) updateData.netAmount = new Decimal(input.netAmount)
      if (input.vatAmount !== undefined) updateData.vatAmount = new Decimal(input.vatAmount)
      if (input.totalAmount !== undefined) updateData.totalAmount = new Decimal(input.totalAmount)
      if (input.frequency) updateData.frequency = input.frequency
      if (input.nextDate) updateData.nextDate = input.nextDate
      if (input.endDate !== undefined) updateData.endDate = input.endDate

      const recurringExpense = await db.recurringExpense.update({
        where: { id },
        data: updateData,
      })

      revalidatePath("/expenses/recurring")
      revalidatePath(`/expenses/recurring/${id}`)
      return { success: true, data: recurringExpense }
    })
  } catch (error) {
    console.error("Failed to update recurring expense:", error)
    return { success: false, error: "Greška pri ažuriranju ponavljajućeg troška" }
  }
}

export async function deleteRecurringExpense(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:delete", async () => {
      const recurringExpense = await db.recurringExpense.findFirst({
        where: { id },
      })

      if (!recurringExpense) {
        return { success: false, error: "Ponavljajući trošak nije pronađen" }
      }

      await db.recurringExpense.delete({ where: { id } })

      revalidatePath("/expenses/recurring")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete recurring expense:", error)

    if (error instanceof Error && error.message.includes("Permission denied")) {
      return { success: false, error: "Nemate dopuštenje za brisanje ponavljajućih troškova" }
    }

    return { success: false, error: "Greška pri brisanju ponavljajućeg troška" }
  }
}

export async function toggleRecurringExpense(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "expense:update", async () => {
      const recurringExpense = await db.recurringExpense.findFirst({
        where: { id },
      })

      if (!recurringExpense) {
        return { success: false, error: "Ponavljajući trošak nije pronađen" }
      }

      await db.recurringExpense.update({
        where: { id },
        data: { isActive },
      })

      revalidatePath("/expenses/recurring")
      revalidatePath(`/expenses/recurring/${id}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to toggle recurring expense:", error)
    return { success: false, error: "Greška pri promjeni statusa ponavljajućeg troška" }
  }
}

export async function processRecurringExpenses(): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const now = new Date()

      // Find all active recurring expenses that are due
      const dueExpenses = await db.recurringExpense.findMany({
        where: {
          companyId: company.id,
          isActive: true,
          nextDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      })

      let created = 0
      for (const recurring of dueExpenses) {
        // Create the expense
        await db.expense.create({
          data: {
            companyId: company.id,
            categoryId: recurring.categoryId,
            vendorId: recurring.vendorId,
            description: recurring.description,
            date: recurring.nextDate,
            netAmount: recurring.netAmount,
            vatAmount: recurring.vatAmount,
            totalAmount: recurring.totalAmount,
            vatDeductible: true,
            vatRate: recurring.vatRate,
            currency: "EUR",
            status: "DRAFT",
            notes: "Automatski kreiran iz ponavljajućeg troška",
          },
        })

        // Calculate next date based on frequency
        const nextDate = new Date(recurring.nextDate)
        switch (recurring.frequency) {
          case "WEEKLY":
            nextDate.setDate(nextDate.getDate() + 7)
            break
          case "MONTHLY":
            nextDate.setMonth(nextDate.getMonth() + 1)
            break
          case "QUARTERLY":
            nextDate.setMonth(nextDate.getMonth() + 3)
            break
          case "YEARLY":
            nextDate.setFullYear(nextDate.getFullYear() + 1)
            break
        }

        // Update recurring expense with next date
        await db.recurringExpense.update({
          where: { id: recurring.id },
          data: { nextDate },
        })

        created++
      }

      revalidatePath("/expenses")
      revalidatePath("/expenses/recurring")
      return { success: true, data: { created } }
    })
  } catch (error) {
    console.error("Failed to process recurring expenses:", error)
    return { success: false, error: "Greška pri obradi ponavljajućih troškova" }
  }
}
