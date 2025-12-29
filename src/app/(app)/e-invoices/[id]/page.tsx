import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { NextSteps } from "@/components/ui/next-steps"
import { GlossaryTerm } from "@/components/ui/glossary-term"
import { InvoiceDetailActions } from "./detail-actions"

interface EInvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

const statusLabels: Record<string, string> = {
  DRAFT: "Nacrt",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
  FISCALIZED: "Fiskalizirano",
  SENT: "Poslano",
  DELIVERED: "Dostavljeno",
  ACCEPTED: "Prihvaćeno",
  REJECTED: "Odbijeno",
  ARCHIVED: "Arhivirano",
  ERROR: "Greška",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-surface-1 text-foreground",
  PENDING_FISCALIZATION: "bg-warning-bg text-warning-text",
  FISCALIZED: "bg-info-bg text-info-text",
  SENT: "bg-info-bg text-info-text",
  DELIVERED: "bg-success-bg text-success-text",
  ACCEPTED: "bg-success-bg text-success-text",
  REJECTED: "bg-danger-bg text-danger-text",
  ARCHIVED: "bg-surface-1 text-secondary",
  ERROR: "bg-danger-bg text-danger-text",
}

export default async function EInvoiceDetailPage({ params }: EInvoiceDetailPageProps) {
  const { id } = await params
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const invoice = await db.eInvoice.findFirst({
    where: {
      id,
      companyId: company.id,
    },
    include: {
      buyer: true,
      seller: true,
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
  })

  if (!invoice) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/e-invoices"
            className="text-sm text-secondary hover:text-foreground mb-2 inline-block"
          >
            ← Natrag na listu
          </Link>
          <h1 className="text-2xl font-bold">Račun {invoice.invoiceNumber}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium ${
              statusColors[invoice.status] || "bg-surface-1 text-foreground"
            }`}
          >
            {statusLabels[invoice.status] || invoice.status}
          </span>
          <InvoiceDetailActions
            invoiceId={invoice.id}
            status={invoice.status}
            hasProvider={!!company.eInvoiceProvider}
            paidAt={invoice.paidAt}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Parties */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prodavatelj</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-semibold">{company.name}</p>
                <p>OIB: {company.oib}</p>
                {company.vatNumber && <p>VAT: {company.vatNumber}</p>}
                <p>{company.address}</p>
                <p>
                  {company.postalCode} {company.city}
                </p>
                {company.email && <p>{company.email}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kupac</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {invoice.buyer ? (
                  <>
                    <p className="font-semibold">{invoice.buyer.name}</p>
                    {invoice.buyer.oib && <p>OIB: {invoice.buyer.oib}</p>}
                    {invoice.buyer.vatNumber && <p>VAT: {invoice.buyer.vatNumber}</p>}
                    {invoice.buyer.address && <p>{invoice.buyer.address}</p>}
                    {(invoice.buyer.postalCode || invoice.buyer.city) && (
                      <p>
                        {invoice.buyer.postalCode} {invoice.buyer.city}
                      </p>
                    )}
                    {invoice.buyer.email && <p>{invoice.buyer.email}</p>}
                  </>
                ) : (
                  <p className="text-secondary">Kupac nije naveden</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Stavke računa</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-surface-1">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-secondary">#</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-secondary">
                        Opis
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-secondary">
                        Kol.
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-secondary">
                        Cijena
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-secondary">
                        PDV
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-secondary">
                        Iznos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-sm text-secondary">{line.lineNumber}</td>
                        <td className="px-4 py-3">{line.description}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {Number(line.quantity)} {line.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {Number(line.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{Number(line.vatRate)}%</td>
                        <td className="px-4 py-3 text-right font-mono font-medium">
                          {(Number(line.netAmount) + Number(line.vatAmount)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Sažetak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Neto iznos</span>
                <span className="font-mono">
                  {Number(invoice.netAmount).toFixed(2)} {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">PDV</span>
                <span className="font-mono">
                  {Number(invoice.vatAmount).toFixed(2)} {invoice.currency}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Ukupno</span>
                <span className="font-mono">
                  {Number(invoice.totalAmount).toFixed(2)} {invoice.currency}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalji</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Datum izdavanja</span>
                <span>{new Date(invoice.issueDate).toLocaleDateString("hr-HR")}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-secondary">Datum dospijeća</span>
                  <span>{new Date(invoice.dueDate).toLocaleDateString("hr-HR")}</span>
                </div>
              )}
              {invoice.buyerReference && (
                <div className="flex justify-between">
                  <span className="text-secondary">Referenca kupca</span>
                  <span>{invoice.buyerReference}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Smjer</span>
                <span>{invoice.direction === "OUTBOUND" ? "Izlazni" : "Ulazni"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Fiscalization */}
          {(invoice.jir || invoice.zki) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <GlossaryTerm term="fiskalizacija">Fiskalizacija</GlossaryTerm>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {invoice.jir && (
                  <div>
                    <p className="text-secondary text-xs">
                      <GlossaryTerm term="jir" showIcon={false}>
                        JIR
                      </GlossaryTerm>
                    </p>
                    <p className="font-mono text-xs break-all">{invoice.jir}</p>
                  </div>
                )}
                {invoice.zki && (
                  <div>
                    <p className="text-secondary text-xs">
                      <GlossaryTerm term="zki" showIcon={false}>
                        ZKI
                      </GlossaryTerm>
                    </p>
                    <p className="font-mono text-xs break-all">{invoice.zki}</p>
                  </div>
                )}
                {invoice.fiscalizedAt && (
                  <div className="flex justify-between">
                    <span className="text-secondary">Fiskalizirano</span>
                    <span>{new Date(invoice.fiscalizedAt).toLocaleString("hr-HR")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Info */}
          {invoice.providerError && (
            <Card className="border-danger-border">
              <CardHeader>
                <CardTitle className="text-danger-text">Greška</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-danger-text">{invoice.providerError}</p>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Povijest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Kreirano</span>
                <span>{new Date(invoice.createdAt).toLocaleString("hr-HR")}</span>
              </div>
              {invoice.sentAt && (
                <div className="flex justify-between">
                  <span className="text-secondary">Poslano</span>
                  <span>{new Date(invoice.sentAt).toLocaleString("hr-HR")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Ažurirano</span>
                <span>{new Date(invoice.updatedAt).toLocaleString("hr-HR")}</span>
              </div>
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-secondary">Plaćeno</span>
                  <span>{new Date(invoice.paidAt).toLocaleString("hr-HR")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps - contextual guidance */}
          {invoice.status === "DRAFT" && (
            <NextSteps
              title="Što dalje?"
              steps={[
                {
                  label: "Pošalji račun kupcu",
                  description: "E-mailom ili kao e-račun",
                  href: `/e-invoices/${invoice.id}`,
                  completed: false,
                },
                {
                  label: "Preuzmi PDF",
                  description: "Za ispis ili arhivu",
                  href: `/api/invoices/${invoice.id}/pdf`,
                  completed: false,
                },
              ]}
            />
          )}
          {invoice.status === "SENT" && !invoice.paidAt && (
            <NextSteps
              title="Što dalje?"
              steps={[
                {
                  label: "Označi kao plaćeno",
                  description: "Kad primiš uplatu",
                  href: `/e-invoices/${invoice.id}`,
                  completed: false,
                },
                {
                  label: "Pošalji podsjetnik",
                  description: "Ako je prošao rok plaćanja",
                  href: `/e-invoices/${invoice.id}`,
                  completed: false,
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  )
}
