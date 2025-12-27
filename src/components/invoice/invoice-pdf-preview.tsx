import { Contact } from "@prisma/client"
import { cn } from "@/lib/utils"

interface InvoicePdfPreviewProps {
  company: {
    name: string
    address: string
    postalCode: string
    city: string
    iban?: string | null
  }
  buyer: Contact | null
  invoiceNumber: string
  issueDate?: Date
  dueDate?: Date
  lines: Array<{
    description: string
    quantity: number
    unit?: string
    unitPrice: number
    vatRate?: number
  }>
  currency: string
  className?: string
}

export function InvoicePdfPreview({
  company,
  buyer,
  invoiceNumber,
  issueDate,
  dueDate,
  lines,
  currency,
  className,
}: InvoicePdfPreviewProps) {
  const totals = lines.reduce(
    (acc, line) => {
      const net = (line.quantity || 0) * (line.unitPrice || 0)
      const vat = net * ((line.vatRate || 0) / 100)
      return {
        net: acc.net + net,
        vat: acc.vat + vat,
        total: acc.total + net + vat,
      }
    },
    { net: 0, vat: 0, total: 0 }
  )

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl border border-[var(--border)] bg-white shadow-card overflow-hidden",
        "aspect-[210/297] max-h-[600px]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50" />
      <div className="relative z-10 flex h-full flex-col px-6 py-6">
        <header className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">FiskAI</p>
            <h1 className="text-2xl font-semibold text-slate-900">E-RAČUN</h1>
            <p className="text-sm text-slate-500">Br. {invoiceNumber}</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{company.name}</p>
            <p>{company.address}</p>
            <p>
              {company.postalCode} {company.city}
            </p>
            {company.iban && <p>IBAN: {company.iban}</p>}
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-6 text-sm text-slate-600">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Kupac</p>
            <p className="text-lg font-semibold text-slate-900">{buyer?.name || "—"}</p>
            <p>{buyer?.address}</p>
            <p>
              {buyer?.postalCode} {buyer?.city}
            </p>
            {buyer?.oib && <p>OIB: {buyer.oib}</p>}
          </div>
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Datum izdavanja</span>
              <span className="font-medium text-slate-900">
                {issueDate ? new Date(issueDate).toLocaleDateString("hr-HR") : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Datum dospijeća</span>
              <span className="font-medium text-slate-900">
                {dueDate ? new Date(dueDate).toLocaleDateString("hr-HR") : "—"}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 flex-1 rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Opis</th>
                <th className="px-3 py-2 text-right">Količina</th>
                <th className="px-3 py-2 text-right">Jedinična cijena</th>
                <th className="px-3 py-2 text-right">PDV</th>
                <th className="px-3 py-2 text-right">Ukupno</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-400" colSpan={5}>
                    Nema dodanih stavki
                  </td>
                </tr>
              )}
              {lines.map((line, index) => {
                const net = (line.quantity || 0) * (line.unitPrice || 0)
                const vatAmount = net * ((line.vatRate || 0) / 100)
                return (
                  <tr key={index} className="border-t border-slate-100 text-slate-700">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {line.description || `Stavka ${index + 1}`}
                    </td>
                    <td className="px-3 py-2 text-right">{line.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      {net.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} {currency}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {vatAmount.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} {currency}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {(net + vatAmount).toLocaleString("hr-HR", { minimumFractionDigits: 2 })}{" "}
                      {currency}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <footer className="mt-4 rounded-xl bg-slate-900 text-white p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Neto</span>
            <span>
              {totals.net.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} {currency}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">PDV</span>
            <span>
              {totals.vat.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} {currency}
            </span>
          </div>
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Ukupno</span>
            <span>
              {totals.total.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} {currency}
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
