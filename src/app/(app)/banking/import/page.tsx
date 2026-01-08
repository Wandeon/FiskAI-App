import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImportForm } from "./import-form"
import { StatementDropzone } from "./statement-dropzone"
import { deriveCapabilities } from "@/lib/capabilities"
import { redirect } from "next/navigation"

export default async function ImportPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)

  if (!capabilities.modules.banking?.enabled) {
    redirect("/settings?tab=plan&blocked=banking")
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Get bank accounts
  const accounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      iban: true,
      currency: true,
    },
  })

  // Get recent imports
  const recentImports = await db.statementImport.findMany({
    where: { companyId: company.id },
    include: {
      bankAccount: {
        select: { name: true },
      },
    },
    orderBy: { importedAt: "desc" },
    take: 10,
  })

  const lastStatements = await db.statement.groupBy({
    by: ["bankAccountId"],
    where: { companyId: company.id },
    _max: { statementDate: true, sequenceNumber: true },
  })
  const lastByAccount = lastStatements.reduce<
    Record<string, { date: string | null; sequenceNumber: number | null }>
  >((acc, s) => {
    acc[s.bankAccountId] = {
      date: s._max.statementDate ? s._max.statementDate.toISOString() : null,
      sequenceNumber: s._max.sequenceNumber ?? null,
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Uvoz izvoda</h1>
          <p className="text-secondary">Uvezite bankovne transakcije iz CSV datoteke</p>
        </div>
        <div className="flex gap-2">
          <Link href="/banking/documents">
            <Button variant="ghost">Dokumenti</Button>
          </Link>
          <Link href="/banking">
            <Button variant="outline">Natrag na bankarstvo</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {accounts.length === 0 ? (
            <div className="py-4 text-sm text-secondary">
              Najprije morate dodati bankovni račun prije uvoza izvoda.
            </div>
          ) : (
            <StatementDropzone accounts={accounts} lastByAccount={lastByAccount} />
          )}
        </CardContent>
      </Card>

      {/* Import Form */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Uvezi novi izvod</h2>
          {accounts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-secondary mb-4">Najprije morate dodati bankovni račun</p>
              <Link href="/banking/accounts">
                <Button>Dodaj račun</Button>
              </Link>
            </div>
          ) : (
            <ImportForm accounts={accounts} />
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Upute za uvoz</h3>
          <div className="space-y-2 text-sm text-secondary">
            <p>
              <strong>1. Format CSV datoteke:</strong> Datoteka mora sadržavati sljedeće stupce:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">datum</code> - Datum transakcije
                (YYYY-MM-DD)
              </li>
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">opis</code> - Opis transakcije
              </li>
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">iznos</code> - Iznos (pozitivan
                za prihode, negativan za rashode)
              </li>
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">stanje</code> - Stanje računa
                nakon transakcije
              </li>
            </ul>
            <p className="mt-3">
              <strong>2. Opcionalni stupci:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">referenca</code> - Bankovna
                referenca
              </li>
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">protivna_strana</code> - Naziv
                proturačuna
              </li>
              <li>
                <code className="bg-surface-1 px-1 py-0.5 rounded">protivni_iban</code> - IBAN
                proturačuna
              </li>
            </ul>
            <p className="mt-3">
              <strong>3. Primjer CSV strukture:</strong>
            </p>
            <pre className="bg-surface-1 p-3 rounded text-xs overflow-x-auto">
              {`datum,opis,iznos,stanje,referenca,protivna_strana,protivni_iban
2025-01-15,Uplata od kupca,1500.00,15500.00,REF123,ACME d.o.o.,HR1234567890123456789
2025-01-16,Plaćanje računa,-350.50,15149.50,REF124,XYZ d.o.o.,HR9876543210987654321`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Recent Imports */}
      {recentImports.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Nedavni uvozi</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-1 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
                        Datum uvoza
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
                        Račun
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
                        Datoteka
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase">
                        Transakcija
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-secondary uppercase">
                        Format
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentImports.map((imp) => (
                      <tr key={imp.id} className="hover:bg-surface-1">
                        <td className="px-4 py-3 text-sm">
                          {new Date(imp.importedAt).toLocaleString("hr-HR")}
                        </td>
                        <td className="px-4 py-3 text-sm">{imp.bankAccount.name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-secondary">
                          {imp.fileName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {imp.transactionCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs bg-info-bg text-info-text px-2 py-1 rounded">
                            {imp.format}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
