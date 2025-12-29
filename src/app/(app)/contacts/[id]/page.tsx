import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Pencil,
  Plus,
  ArrowRight,
  Euro,
  Receipt,
} from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ContactOverviewPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return notFound()
  }

  // Get company for this user
  const companyUser = await db.companyUser.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  })

  if (!companyUser) {
    return notFound()
  }

  // Get contact with all related invoices
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      eInvoicesAsBuyer: {
        where: { companyId: companyUser.companyId },
        orderBy: { issueDate: "desc" },
      },
      eInvoicesAsSeller: {
        where: { companyId: companyUser.companyId },
        orderBy: { issueDate: "desc" },
      },
      expensesAsVendor: {
        where: { companyId: companyUser.companyId },
        orderBy: { date: "desc" },
      },
    },
  })

  if (!contact || contact.companyId !== companyUser.companyId) {
    return notFound()
  }

  // Determine if this is primarily a customer or supplier based on relations
  const isCustomer = contact.type === "CUSTOMER"
  const invoices = isCustomer ? contact.eInvoicesAsBuyer : contact.eInvoicesAsSeller
  const expenses = contact.expensesAsVendor

  // Calculate metrics
  const totalInvoices = invoices.length
  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

  // Paid invoices (have paidAt date)
  const paidInvoices = invoices.filter((inv) => inv.paidAt)
  const unpaidInvoices = invoices.filter((inv) => !inv.paidAt && inv.status !== "DRAFT")
  const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

  // Calculate average payment time
  let avgPaymentDays = 0
  let onTimePayments = 0
  let latePayments = 0

  paidInvoices.forEach((inv) => {
    if (inv.paidAt && inv.issueDate) {
      const paymentDays = Math.floor(
        (new Date(inv.paidAt).getTime() - new Date(inv.issueDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      avgPaymentDays += paymentDays

      // Consider on-time if paid within due date or within 30 days if no due date
      const dueDate = inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(inv.issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      if (new Date(inv.paidAt) <= dueDate) {
        onTimePayments++
      } else {
        latePayments++
      }
    }
  })

  if (paidInvoices.length > 0) {
    avgPaymentDays = Math.round(avgPaymentDays / paidInvoices.length)
  }

  const onTimePercentage =
    paidInvoices.length > 0 ? Math.round((onTimePayments / paidInvoices.length) * 100) : 100

  // Overdue invoices (unpaid and past due date)
  const now = new Date()
  const overdueInvoices = unpaidInvoices.filter((inv) => {
    const dueDate = inv.dueDate
      ? new Date(inv.dueDate)
      : new Date(inv.issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    return now > dueDate
  })

  // Recent invoices for the list (last 10)
  const recentInvoices = invoices.slice(0, 10)

  // Total expenses (if supplier)
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.totalAmount), 0)

  // Payment behavior indicator
  const paymentBehavior =
    onTimePercentage >= 80
      ? "excellent"
      : onTimePercentage >= 60
        ? "good"
        : onTimePercentage >= 40
          ? "fair"
          : "poor"

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              <div className="flex items-center gap-2 text-sm text-secondary">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    isCustomer ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                  )}
                >
                  {isCustomer ? "Kupac" : "Dobavljac"}
                </span>
                {contact.oib && <span>OIB: {contact.oib}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/contacts/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-1" />
              Uredi
            </Button>
          </Link>
          <Link href={`/e-invoices/new?buyerId=${id}`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novi racun
            </Button>
          </Link>
        </div>
      </div>

      {/* Contact Info Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-secondary hover:text-brand-600"
              >
                <Mail className="h-4 w-4" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-secondary hover:text-brand-600"
              >
                <Phone className="h-4 w-4" />
                {contact.phone}
              </a>
            )}
            {(contact.address || contact.city) && (
              <div className="flex items-center gap-2 text-secondary">
                <MapPin className="h-4 w-4" />
                {[contact.address, contact.postalCode, contact.city].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Euro className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-secondary">
                  {isCustomer ? "Ukupni prihod" : "Ukupni troskovi"}
                </p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(isCustomer ? totalRevenue : totalExpenses)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  outstandingBalance > 0 ? "bg-amber-100" : "bg-surface-1"
                )}
              >
                <Receipt
                  className={cn(
                    "h-5 w-5",
                    outstandingBalance > 0 ? "text-amber-600" : "text-muted"
                  )}
                />
              </div>
              <div>
                <p className="text-sm text-secondary">Neplaceno</p>
                <p
                  className={cn(
                    "text-2xl font-semibold",
                    outstandingBalance > 0 && "text-amber-600"
                  )}
                >
                  {formatCurrency(outstandingBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  paymentBehavior === "excellent"
                    ? "bg-emerald-100"
                    : paymentBehavior === "good"
                      ? "bg-info-bg"
                      : paymentBehavior === "fair"
                        ? "bg-amber-100"
                        : "bg-danger-bg"
                )}
              >
                <Clock
                  className={cn(
                    "h-5 w-5",
                    paymentBehavior === "excellent"
                      ? "text-emerald-600"
                      : paymentBehavior === "good"
                        ? "text-link"
                        : paymentBehavior === "fair"
                          ? "text-amber-600"
                          : "text-danger-text"
                  )}
                />
              </div>
              <div>
                <p className="text-sm text-secondary">Prosj. placanje</p>
                <p className="text-2xl font-semibold">
                  {paidInvoices.length > 0 ? `${avgPaymentDays} dana` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                <FileText className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-sm text-secondary">Ukupno racuna</p>
                <p className="text-2xl font-semibold">{totalInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Behavior & Recent Invoices */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Behavior */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Ponasanje placanja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* On-time percentage */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-secondary">Na vrijeme</span>
                <span className="font-medium">{onTimePercentage}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-1">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    onTimePercentage >= 80
                      ? "bg-emerald-500"
                      : onTimePercentage >= 60
                        ? "bg-blue-500"
                        : onTimePercentage >= 40
                          ? "bg-amber-500"
                          : "bg-red-500"
                  )}
                  style={{ width: `${onTimePercentage}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 rounded-lg bg-emerald-50">
                <p className="text-2xl font-semibold text-emerald-600">{onTimePayments}</p>
                <p className="text-xs text-secondary">Na vrijeme</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-danger-bg">
                <p className="text-2xl font-semibold text-danger-text">{latePayments}</p>
                <p className="text-xs text-secondary">Zakasnjelo</p>
              </div>
            </div>

            {/* Overdue warning */}
            {overdueInvoices.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-bg text-danger-text text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {overdueInvoices.length} {overdueInvoices.length === 1 ? "racun" : "racuna"}{" "}
                  dospjelo
                </span>
              </div>
            )}

            {/* Behavior indicator */}
            <div
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                paymentBehavior === "excellent"
                  ? "bg-emerald-50 text-emerald-700"
                  : paymentBehavior === "good"
                    ? "bg-info-bg text-link"
                    : paymentBehavior === "fair"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-danger-bg text-danger-text"
              )}
            >
              {paymentBehavior === "excellent" || paymentBehavior === "good" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {paymentBehavior === "excellent"
                  ? "Odlican platiša"
                  : paymentBehavior === "good"
                    ? "Dobar platiša"
                    : paymentBehavior === "fair"
                      ? "Prosjecan platiša"
                      : "Cesto kasni s placanjem"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Nedavni racuni</CardTitle>
            <Link
              href={`/e-invoices?contact=${id}`}
              className="text-sm text-brand-600 hover:underline flex items-center gap-1"
            >
              Svi racuni <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="text-center py-8 text-secondary">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nema racuna za ovaj kontakt</p>
                <Link href={`/e-invoices/new?buyerId=${id}`}>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-1" />
                    Kreiraj prvi racun
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentInvoices.map((invoice) => {
                  const isPaid = !!invoice.paidAt
                  const isOverdue = !isPaid && invoice.dueDate && new Date(invoice.dueDate) < now

                  return (
                    <Link
                      key={invoice.id}
                      href={`/e-invoices/${invoice.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-1 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            isPaid ? "bg-emerald-100" : isOverdue ? "bg-danger-bg" : "bg-surface-1"
                          )}
                        >
                          {isPaid ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          ) : isOverdue ? (
                            <AlertCircle className="h-4 w-4 text-danger-text" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-secondary">
                            {new Date(invoice.issueDate).toLocaleDateString("hr-HR")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(Number(invoice.totalAmount))}</p>
                        <p
                          className={cn(
                            "text-xs",
                            isPaid
                              ? "text-emerald-600"
                              : isOverdue
                                ? "text-danger-text"
                                : "text-secondary"
                          )}
                        >
                          {isPaid ? "Placeno" : isOverdue ? "Dospjelo" : "Ceka placanje"}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pregled po statusu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Nacrti",
                count: invoices.filter((i) => i.status === "DRAFT").length,
                color: "bg-surface-1 text-secondary",
              },
              {
                label: "Poslano",
                count: invoices.filter((i) => ["SENT", "DELIVERED", "ACCEPTED"].includes(i.status))
                  .length,
                color: "bg-info-bg text-link",
              },
              {
                label: "Placeno",
                count: paidInvoices.length,
                color: "bg-emerald-100 text-emerald-600",
              },
              {
                label: "Dospjelo",
                count: overdueInvoices.length,
                color: "bg-danger-bg text-danger-text",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn("p-4 rounded-lg text-center", item.color.split(" ")[0])}
              >
                <p className={cn("text-3xl font-bold", item.color.split(" ")[1])}>{item.count}</p>
                <p className="text-sm text-secondary">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
