import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { recordCronError } from "@/lib/cron-dlq"
import { Prisma } from "@prisma/client"

interface ProcessResult {
  companyId: string
  companyName: string
  created: number
  errors: string[]
}

/**
 * Process recurring expenses for all companies
 * Runs daily to create expenses from recurring templates
 */
async function handleRecurringExpenses(request: Request) {
  const startTime = Date.now()

  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron:recurring-expenses] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: ProcessResult[] = []
  const now = new Date()

  try {
    // Find all companies with active recurring expenses that are due
    const companies = await db.company.findMany({
      where: {
        recurringExpenses: {
          some: {
            isActive: true,
            nextDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        },
      },
      select: { id: true, name: true },
    })

    console.log(`[cron:recurring-expenses] Processing ${companies.length} companies`)

    for (const company of companies) {
      const result: ProcessResult = {
        companyId: company.id,
        companyName: company.name,
        created: 0,
        errors: [],
      }

      try {
        // Find due recurring expenses for this company
        const dueExpenses = await db.recurringExpense.findMany({
          where: {
            companyId: company.id,
            isActive: true,
            nextDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        })

        for (const recurring of dueExpenses) {
          try {
            // Create the expense in a transaction
            await db.$transaction(async (tx) => {
              // Create expense
              await tx.expense.create({
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
                  notes: `Automatski kreiran iz ponavljajućeg troška (ID: ${recurring.id})`,
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
              await tx.recurringExpense.update({
                where: { id: recurring.id },
                data: { nextDate },
              })
            })

            result.created++
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            result.errors.push(
              `Failed to process recurring expense ${recurring.id}: ${errorMessage}`
            )
            console.error(`[cron:recurring-expenses] Error processing ${recurring.id}:`, error)

            // Record in DLQ for retry/investigation
            await recordCronError({
              jobName: "recurring-expenses",
              errorType: "EXPENSE_CREATION_FAILED",
              errorMessage,
              payload: {
                recurringExpenseId: recurring.id,
                companyId: company.id,
              },
            }).catch((e) => console.error("[cron:recurring-expenses] Failed to record DLQ:", e))
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        result.errors.push(`Company processing failed: ${errorMessage}`)
        console.error(`[cron:recurring-expenses] Error processing company ${company.id}:`, error)
      }

      results.push(result)
    }

    const totalCreated = results.reduce((sum, r) => sum + r.created, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
    const durationMs = Date.now() - startTime

    console.log(
      `[cron:recurring-expenses] Completed: ${totalCreated} expenses created, ${totalErrors} errors, ${durationMs}ms`
    )

    return NextResponse.json({
      success: true,
      summary: {
        companiesProcessed: results.length,
        expensesCreated: totalCreated,
        errors: totalErrors,
        durationMs,
      },
      results,
    })
  } catch (error) {
    console.error("[cron:recurring-expenses] Fatal error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// Support both GET (Vercel cron) and POST (manual trigger)
export const GET = handleRecurringExpenses
export const POST = handleRecurringExpenses
