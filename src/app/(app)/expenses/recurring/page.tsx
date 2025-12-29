import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table"
import { Plus, RefreshCw, Calendar } from "lucide-react"
import { RecurringExpenseActions } from "./recurring-expense-actions"
import type { RecurringExpense, ExpenseCategory, Contact } from "@prisma/client"

type RecurringExpenseWithRelations = RecurringExpense & {
  category: ExpenseCategory
  vendor: Contact | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getFrequencyLabel(frequency: string) {
  const labels: Record<string, string> = {
    WEEKLY: "Tjedno",
    MONTHLY: "Mjesečno",
    QUARTERLY: "Kvartalno",
    YEARLY: "Godišnje",
  }
  return labels[frequency] || frequency
}

export default async function RecurringExpensesPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const recurringExpenses = await db.recurringExpense.findMany({
    where: { companyId: company.id },
    include: {
      category: true,
      vendor: true,
    },
    orderBy: { nextDate: "asc" },
  })

  const columns: Column<RecurringExpenseWithRelations>[] = [
    {
      key: "description",
      label: "Opis",
      render: (expense) => (
        <div>
          <p className="font-medium text-[var(--foreground)]">{expense.description}</p>
          <p className="text-sm text-[var(--muted)]">{expense.category.name}</p>
        </div>
      ),
    },
    {
      key: "vendor",
      label: "Dobavljač",
      render: (expense) => (
        <span className="text-sm text-[var(--foreground)]">{expense.vendor?.name || "—"}</span>
      ),
    },
    {
      key: "amount",
      label: "Iznos",
      render: (expense) => (
        <span className="text-sm font-medium text-[var(--foreground)]">
          {formatCurrency(Number(expense.totalAmount))}
        </span>
      ),
    },
    {
      key: "frequency",
      label: "Učestalost",
      render: (expense) => (
        <span className="text-sm text-[var(--foreground)]">
          {getFrequencyLabel(expense.frequency)}
        </span>
      ),
    },
    {
      key: "nextDate",
      label: "Sljedeći datum",
      render: (expense) => (
        <span className="text-sm text-[var(--foreground)]">{formatDate(expense.nextDate)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (expense) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            expense.isActive
              ? "bg-success-bg text-success-text"
              : "bg-surface-1 text-foreground"
          }`}
        >
          {expense.isActive ? "Aktivan" : "Neaktivan"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (expense) => <RecurringExpenseActions expense={expense} />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ponavljajući troškovi</h1>
          <p className="text-[var(--muted)]">
            Automatski kreirajte troškove koji se ponavljaju u određenim intervalima
          </p>
        </div>
        <Link href="/expenses/recurring/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novi ponavljajući trošak
          </Button>
        </Link>
      </div>

      {/* Info card */}
      <Card className="bg-info-bg border-info-border">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-link mt-0.5" />
            <div className="text-sm text-info-text">
              <p className="font-medium">Kako funkcioniraju ponavljajući troškovi?</p>
              <p className="mt-1 text-info-text">
                Svaki dan u ponoć sustav provjerava ima li ponavljajućih troškova čiji je datum
                dospio. Za svaki takav trošak automatski se kreira novi trošak u statusu "Nacrt" i
                postavlja se sljedeći datum prema učestalosti.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {recurringExpenses.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={<RefreshCw className="h-8 w-8" />}
              title="Nema ponavljajućih troškova"
              description="Definirajte troškove koji se automatski ponavljaju poput najamnine, pretplate na servise ili mjesečnih usluga."
              action={
                <Link href="/expenses/recurring/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj prvi ponavljajući trošak
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={recurringExpenses}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]"
          getRowKey={(expense) => expense.id}
          renderCard={(expense) => (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{expense.description}</p>
                  <p className="text-sm text-[var(--muted)]">{expense.category.name}</p>
                  {expense.vendor && (
                    <p className="text-sm text-[var(--muted)]">{expense.vendor.name}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {formatCurrency(Number(expense.totalAmount))}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      expense.isActive
                        ? "bg-success-bg text-success-text"
                        : "bg-surface-1 text-foreground"
                    }`}
                  >
                    {expense.isActive ? "Aktivan" : "Neaktivan"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-3">
                <div>
                  <p className="text-[var(--muted)]">
                    {getFrequencyLabel(expense.frequency)} • {formatDate(expense.nextDate)}
                  </p>
                </div>
                <RecurringExpenseActions expense={expense} />
              </div>
            </div>
          )}
        />
      )}
    </div>
  )
}
