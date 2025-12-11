import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { CompanySettingsForm } from "./company-settings-form"
import { EInvoiceSettingsForm } from "./einvoice-settings-form"
import Link from "next/link"

export default async function SettingsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Postavke</h1>

      <div className="grid gap-6">
        {/* Company Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Podaci o tvrtki</CardTitle>
            <CardDescription>
              Osnovni podaci o vašoj tvrtki koji se koriste na računima
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanySettingsForm company={company} />
          </CardContent>
        </Card>

        {/* E-Invoice Provider Section */}
        <Card>
          <CardHeader>
            <CardTitle>E-Računi - Informacijski posrednik</CardTitle>
            <CardDescription>
              Konfigurirajte povezivanje s informacijskim posrednikom za slanje e-računa.
              Od 1. siječnja 2026. obvezno za sve B2B transakcije.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EInvoiceSettingsForm company={company} />
          </CardContent>
        </Card>

        {/* Fiskalizacija Status */}
        <Card>
          <CardHeader>
            <CardTitle>Fiskalizacija 2.0 Status</CardTitle>
            <CardDescription>
              Pregled statusa usklađenosti s Fiskalizacijom 2.0
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">PDV obveznik</p>
                  <p className="text-sm text-gray-500">Status u sustavu PDV-a</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                  company.isVatPayer
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {company.isVatPayer ? "Da" : "Ne"}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Informacijski posrednik</p>
                  <p className="text-sm text-gray-500">Povezan s pružateljem e-računa</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                  company.eInvoiceProvider
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {company.eInvoiceProvider ? "Povezano" : "Nije povezano"}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">IBAN</p>
                  <p className="text-sm text-gray-500">Bankovni račun za primanje uplata</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                  company.iban
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {company.iban ? "Uneseno" : "Nije uneseno"}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-md bg-blue-50 p-4">
              <h4 className="font-medium text-blue-800">Rokovi za usklađivanje</h4>
              <ul className="mt-2 text-sm text-blue-700 space-y-1">
                <li>• <strong>1. siječnja 2026.</strong> - Obveza primanja e-računa (B2B)</li>
                <li>• <strong>1. siječnja 2026.</strong> - Obveza slanja e-računa (B2B)</li>
                <li>• <strong>1. srpnja 2026.</strong> - Obveza slanja e-računa (B2G)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Business Premises Section */}
        <Link href="/settings/premises">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50">
            <CardHeader>
              <CardTitle>Poslovni prostori</CardTitle>
              <CardDescription>
                Upravljanje poslovnim prostorima i naplatnim uređajima za fiskalizaciju
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {/* Audit Log Section */}
        <Link href="/settings/audit-log">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50">
            <CardHeader>
              <CardTitle>Revizijski dnevnik</CardTitle>
              <CardDescription>
                Pregled svih akcija u sustavu
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
