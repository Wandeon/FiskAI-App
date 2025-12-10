import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getEInvoices } from "@/app/actions/e-invoice"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default async function EInvoicesPage() {
  const user = await requireAuth()
  await requireCompany(user.id!)

  const eInvoices = await getEInvoices()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">E-Računi</h1>
        <Link href="/e-invoices/new">
          <Button>Novi E-Račun</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {eInvoices.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nemate još nijedan e-račun.{" "}
              <Link href="/e-invoices/new" className="text-blue-600 hover:underline">
                Kreirajte prvi
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Broj
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Kupac
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                    Iznos
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {eInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/e-invoices/${invoice.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{invoice.buyer?.name || "-"}</td>
                    <td className="px-4 py-3">
                      {new Date(invoice.issueDate).toLocaleDateString("hr-HR")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(invoice.totalAmount).toFixed(2)} {invoice.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          invoice.status === "SENT"
                            ? "bg-green-100 text-green-700"
                            : invoice.status === "DRAFT"
                              ? "bg-gray-100 text-gray-700"
                              : invoice.status === "ERROR"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
