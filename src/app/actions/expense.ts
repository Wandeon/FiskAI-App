"use server"

import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { Prisma, ExpenseStatus, PaymentMethod } from "@prisma/client"
import { z } from "zod"

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
  totalAmount: number
  vatDeductible?: boolean
  currency?: string
  paymentMethod?: string
  notes?: string
  receiptUrl?: string
}

export async function createExpense(input: CreateExpenseInput): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
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

      // Verify vendor if provided (automatically filtered by tenant context)
      if (input.vendorId) {
        const vendor = await db.contact.findFirst({
          where: { id: input.vendorId },
        })
        if (!vendor) {
          return { success: false, error: "Dobavljač nije pronađen" }
        }
      }

      const status: ExpenseStatus = input.paymentMethod ? "PAID" : "DRAFT"

      const expense = await db.expense.create({
        data: {
          companyId: company.id,
          categoryId: input.categoryId,
          vendorId: input.vendorId || null,
          description: input.description,
          date: input.date,
          dueDate: input.dueDate || null,
          netAmount: new Decimal(input.netAmount),
          vatAmount: new Decimal(input.vatAmount),
          totalAmount: new Decimal(input.totalAmount),
          vatDeductible: input.vatDeductible ?? true,
          currency: input.currency || "EUR",
          status,
          paymentMethod: input.paymentMethod as PaymentMethod | null,
          paymentDate: input.paymentMethod ? new Date() : null,
          notes: input.notes || null,
          receiptUrl: input.receiptUrl || null,
        },
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

    return requireCompanyWithContext(user.id!, async () => {
      const existing = await db.expense.findFirst({
        where: { id },
      })

      if (!existing) {
        return { success: false, error: "Trošak nije pronađen" }
      }

      const updateData: Prisma.ExpenseUpdateInput = {}

      if (input.categoryId) updateData.category = { connect: { id: input.categoryId } }
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

      const expense = await db.expense.update({
        where: { id },
        data: updateData,
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

    return requireCompanyWithContext(user.id!, async () => {
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

    return requireCompanyWithContext(user.id!, async () => {
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
        }
      }
      if (validated.data.totalAmount !== undefined) {
        data.totalAmount = new Decimal(validated.data.totalAmount)
      }

      const expense = await db.expense.update({
        where: { id },
        data,
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

    return requireCompanyWithContext(user.id!, async (company) => {
      // Check for duplicate code
      const existing = await db.expenseCategory.findUnique({
        where: { companyId_code: { companyId: company.id, code: input.code } },
      })

      if (existing) {
        return { success: false, error: `Kategorija s kodom ${input.code} već postoji` }
      }

      const category = await db.expenseCategory.create({
        data: {
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

    return requireCompanyWithContext(user.id!, async (company) => {
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
