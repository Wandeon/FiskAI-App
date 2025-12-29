import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExpenseActions } from "./expense-actions"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nacrt",
  PENDING: "Čeka plaćanje",
  PAID: "Plaćeno",
  CANCELLED: "Otkazano",
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Gotovina",
  CARD: "Kartica",
  TRANSFER: "Virman",
  OTHER: "Ostalo",
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({ companyId: company.id, userId: user.id! })

  const expense = await db.expense.findFirst({
    where: { id, companyId: company.id },
    include: {
      vendor: true,
      category: true,
    },
  })

  if (!expense) notFound()

  const formatCurrency = (amount: number | { toNumber?: () => number }) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: expense.currency }).format(
      typeof amount === "number" ? amount : Number(amount)
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{expense.description}</h1>
          <p className="text-secondary">{expense.category.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses">
            <Button variant="outline">← Natrag</Button>
          </Link>
          <ExpenseActions expense={expense} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalji</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-secondary">Status:</dt>
              <dd>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-surface-1">
                  {STATUS_LABELS[expense.status]}
                </span>
              </dd>
              <dt className="text-secondary">Datum:</dt>
              <dd>{new Date(expense.date).toLocaleDateString("hr-HR")}</dd>
              {expense.dueDate && (
                <>
                  <dt className="text-secondary">Rok plaćanja:</dt>
                  <dd>{new Date(expense.dueDate).toLocaleDateString("hr-HR")}</dd>
                </>
              )}
              {expense.paymentMethod && (
                <>
                  <dt className="text-secondary">Način plaćanja:</dt>
                  <dd>{PAYMENT_LABELS[expense.paymentMethod]}</dd>
                </>
              )}
              {expense.paymentDate && (
                <>
                  <dt className="text-secondary">Datum plaćanja:</dt>
                  <dd>{new Date(expense.paymentDate).toLocaleDateString("hr-HR")}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dobavljač</CardTitle>
          </CardHeader>
          <CardContent>
            {expense.vendor ? (
              <div className="space-y-1">
                <p className="font-medium">{expense.vendor.name}</p>
                {expense.vendor.oib && (
                  <p className="text-sm text-secondary">OIB: {expense.vendor.oib}</p>
                )}
                {expense.vendor.address && (
                  <p className="text-sm text-secondary">{expense.vendor.address}</p>
                )}
              </div>
            ) : (
              <p className="text-secondary">Nepoznat dobavljač</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Iznosi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-8">
                <dt className="text-secondary">Neto:</dt>
                <dd className="font-mono">{formatCurrency(expense.netAmount)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-secondary">PDV:</dt>
                <dd className="font-mono">
                  {formatCurrency(expense.vatAmount)}{" "}
                  {expense.vatDeductible ? "(priznati)" : "(nepriznati)"}
                </dd>
              </div>
              <div className="flex justify-between gap-8 text-lg border-t pt-2">
                <dt className="font-medium">Ukupno:</dt>
                <dd className="font-bold font-mono">{formatCurrency(expense.totalAmount)}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {expense.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Napomene</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{expense.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
