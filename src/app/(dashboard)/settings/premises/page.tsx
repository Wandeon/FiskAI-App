import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PremisesForm } from './premises-form'
import { DevicesList } from './devices-list'

export default async function PremisesPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const premises = await db.businessPremises.findMany({
    where: { companyId: company.id },
    include: {
      devices: {
        orderBy: { code: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Poslovni prostori</h1>
          <p className="text-gray-500">Upravljanje poslovnim prostorima i naplatnim uređajima za fiskalizaciju</p>
        </div>
        <Link
          href="/settings"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Natrag na postavke
        </Link>
      </div>

      {/* Info card about Croatian requirements */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            <strong>Broj računa:</strong> Prema hrvatskim propisima o fiskalizaciji, broj računa mora biti u formatu{' '}
            <code className="bg-blue-100 px-1 rounded">broj-poslovni_prostor-naplatni_uređaj</code> (npr. 43-1-1).
          </p>
        </CardContent>
      </Card>

      {/* Add new premises form */}
      <Card>
        <CardHeader>
          <CardTitle>Dodaj novi poslovni prostor</CardTitle>
          <CardDescription>
            Svaki poslovni prostor ima jedinstveni numerički kod koji se koristi u broju računa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PremisesForm companyId={company.id} />
        </CardContent>
      </Card>

      {/* List of premises */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Postojeći poslovni prostori</h2>

        {premises.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Nema poslovnih prostora. Dodajte prvi poslovni prostor iznad.
            </CardContent>
          </Card>
        ) : (
          premises.map((p) => (
            <Card key={p.id} className={p.isDefault ? 'border-green-500' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-mono font-bold">
                      {p.code}
                    </span>
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {p.address && (
                        <CardDescription>{p.address}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isDefault && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Zadani
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        Neaktivan
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DevicesList
                  premisesId={p.id}
                  companyId={company.id}
                  devices={p.devices}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
