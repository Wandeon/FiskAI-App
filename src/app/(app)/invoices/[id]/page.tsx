import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InvoiceActions } from "./invoice-actions"
import { FiscalStatusBadge } from "./fiscal-status-badge"

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Račun",
  E_INVOICE: "E-Račun",
  QUOTE: "Ponuda",
  PROFORMA: "Predračun",
  CREDIT_NOTE: "Odobrenje",
  DEBIT_NOTE: "Terećenje",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nacrt",
  SENT: "Poslano",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
  FISCALIZED: "Fiskalizirano",
  DELIVERED: "Dostavljeno",
  ACCEPTED: "Prihvaćeno",
  REJECTED: "Odbijeno",
  ARCHIVED: "Arhivirano",
  ERROR: "Greška",
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const invoice = await db.eInvoice.findFirst({
    where: { id, companyId: company.id },
    include: {
      buyer: true,
      seller: true,
      lines: { orderBy: { lineNumber: "asc" } },
      convertedFrom: { select: { id: true, invoiceNumber: true, type: true } },
      convertedTo: { select: { id: true, invoiceNumber: true, type: true } },
      fiscalRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice) {
    notFound()
  }

  // Check if company has an active fiscal certificate
  const activeCertificate = await db.fiscalCertificate.findFirst({
    where: {
      companyId: company.id,
      environment: company.fiscalEnvironment || "PROD",
      status: "ACTIVE",
    },
  })

  const formatCurrency = (amount: number | string) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: invoice.currency,
    }).format(Number(amount))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{invoice.invoiceNumber}</h1>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-info-bg text-info-text">
              {TYPE_LABELS[invoice.type] || invoice.type}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-surface-1 text-foreground">
              {STATUS_LABELS[invoice.status] || invoice.status}
            </span>
          </div>
          {invoice.internalReference && (
            <p className="text-sm text-secondary">Interna oznaka: {invoice.internalReference}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/invoices">
            <Button variant="outline">← Natrag</Button>
          </Link>
          <InvoiceActions invoice={invoice} />
        </div>
      </div>

      {/* Conversion info */}
      {invoice.convertedFrom && (
        <Card className="bg-info-bg border-info-border">
          <CardContent className="py-3">
            <p className="text-sm text-info-text">
              Konvertirano iz:{" "}
              <Link
                href={`/invoices/${invoice.convertedFrom.id}`}
                className="font-medium hover:underline"
              >
                {invoice.convertedFrom.invoiceNumber} ({TYPE_LABELS[invoice.convertedFrom.type]})
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {invoice.convertedTo && invoice.convertedTo.length > 0 && (
        <Card className="bg-success-bg border-success-border">
          <CardContent className="py-3">
            <p className="text-sm text-success-text">
              Konvertirano u:{" "}
              {invoice.convertedTo.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link href={`/invoices/${c.id}`} className="font-medium hover:underline">
                    {c.invoiceNumber} ({TYPE_LABELS[c.type]})
                  </Link>
                </span>
              ))}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Buyer info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kupac</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.buyer ? (
              <div className="space-y-1">
                <p className="font-medium">{invoice.buyer.name}</p>
                {invoice.buyer.oib && (
                  <p className="text-sm text-secondary">OIB: {invoice.buyer.oib}</p>
                )}
                {invoice.buyer.address && (
                  <p className="text-sm text-secondary">{invoice.buyer.address}</p>
                )}
                {(invoice.buyer.postalCode || invoice.buyer.city) && (
                  <p className="text-sm text-secondary">
                    {invoice.buyer.postalCode} {invoice.buyer.city}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-secondary">-</p>
            )}
          </CardContent>
        </Card>

        {/* Invoice info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalji</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-secondary">Datum izdavanja:</dt>
              <dd>{new Date(invoice.issueDate).toLocaleDateString("hr-HR")}</dd>
              {invoice.dueDate && (
                <>
                  <dt className="text-secondary">Rok plaćanja:</dt>
                  <dd>{new Date(invoice.dueDate).toLocaleDateString("hr-HR")}</dd>
                </>
              )}
            </dl>

            {/* Fiscal Status */}
            <div className="pt-2 border-t">
              <div className="text-sm font-medium text-foreground mb-2">Status fiskalizacije</div>
              <FiscalStatusBadge invoice={invoice} hasCertificate={!!activeCertificate} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stavke</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Opis</th>
                <th className="text-right py-2">Kol.</th>
                <th className="text-right py-2">Cijena</th>
                <th className="text-right py-2">PDV</th>
                <th className="text-right py-2">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2">{line.lineNumber}</td>
                  <td className="py-2">{line.description}</td>
                  <td className="text-right py-2">
                    {Number(line.quantity)} {line.unit}
                  </td>
                  <td className="text-right py-2">{formatCurrency(Number(line.unitPrice))}</td>
                  <td className="text-right py-2">{Number(line.vatRate)}%</td>
                  <td className="text-right py-2">{formatCurrency(Number(line.netAmount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-8">
                <dt className="text-secondary">Osnovica:</dt>
                <dd className="font-medium">{formatCurrency(Number(invoice.netAmount))}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-secondary">PDV:</dt>
                <dd className="font-medium">{formatCurrency(Number(invoice.vatAmount))}</dd>
              </div>
              <div className="flex justify-between gap-8 text-lg border-t pt-2">
                <dt className="font-medium">Ukupno:</dt>
                <dd className="font-bold">{formatCurrency(Number(invoice.totalAmount))}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Napomene</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
