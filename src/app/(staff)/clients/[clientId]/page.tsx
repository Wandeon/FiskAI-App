import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, FolderOpen, TrendingUp, Users, AlertCircle } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ clientId: string }>
}

async function getClientOverview(companyId: string) {
  const [company, invoiceStats, documentStats, contactCount, openTickets] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        oib: true,
        entitlements: true,
        legalForm: true,
        isVatPayer: true,
        eInvoiceProvider: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
      },
    }),
    db.eInvoice.aggregate({
      where: { companyId },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    db.document.count({ where: { companyId } }),
    db.contact.count({ where: { companyId } }),
    db.supportTicket.count({
      where: { companyId, status: { not: "CLOSED" } },
    }),
  ])

  return { company, invoiceStats, documentStats, contactCount, openTickets }
}

export default async function ClientOverviewPage({ params }: PageProps) {
  const { clientId } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const { company, invoiceStats, documentStats, contactCount, openTickets } =
    await getClientOverview(clientId)

  if (!company) {
    notFound()
  }

  const totalRevenue = Number(invoiceStats._sum.totalAmount || 0)

  return (
    <div className="space-y-6">
      {/* Open Tickets Alert */}
      {openTickets > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">
                {openTickets} open support {openTickets === 1 ? "ticket" : "tickets"}
              </p>
              <p className="text-sm text-orange-700">
                This client has pending support requests that need attention.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenue.toLocaleString("hr-HR", {
                style: "currency",
                currency: "EUR",
              })}
            </div>
            <p className="text-xs text-muted-foreground">From all invoices</p>
          </CardContent>
        </Card>

        <Link href={`/clients/${clientId}/e-invoices`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">E-Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoiceStats._count.id}</div>
              <p className="text-xs text-muted-foreground">Total invoices</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/clients/${clientId}/documents`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documentStats}</div>
              <p className="text-xs text-muted-foreground">Uploaded documents</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactCount}</div>
            <p className="text-xs text-muted-foreground">Business contacts</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Client business information and configuration</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Subscription</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={company.subscriptionStatus === "ACTIVE" ? "default" : "secondary"}>
                  {company.subscriptionStatus || "N/A"}
                </Badge>
                {company.subscriptionPlan && (
                  <span className="text-sm">{company.subscriptionPlan}</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">VAT Status</p>
              <p className="text-sm mt-1">{company.isVatPayer ? "VAT Payer" : "Not VAT Payer"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">E-Invoice Provider</p>
              <p className="text-sm mt-1">{company.eInvoiceProvider || "Not configured"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Active Modules</p>
            <div className="flex flex-wrap gap-1">
              {(company.entitlements as string[] || []).map((entitlement) => (
                <Badge key={entitlement} variant="outline" className="text-xs">
                  {entitlement}
                </Badge>
              ))}
              {(!company.entitlements || (company.entitlements as string[]).length === 0) && (
                <span className="text-sm text-muted-foreground">No modules enabled</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
