import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { PremisesForm } from "./premises-form"
import { PremisesList } from "./premises-list"
import { Building } from "lucide-react"

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
        orderBy: { code: "asc" },
      },
    },
    orderBy: { code: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Poslovni prostori</h1>
          <p className="text-[var(--muted)]">
            Upravljanje poslovnim prostorima i naplatnim uredajima za fiskalizaciju
          </p>
        </div>
        <Link href="/settings" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Natrag na postavke
        </Link>
      </div>

      {/* Info card about Croatian requirements */}
      <Card className="bg-[var(--info-bg)] border-[var(--info-border)]">
        <CardContent className="pt-4">
          <p className="text-sm text-[var(--info-text)]">
            <strong>Broj racuna:</strong> Prema hrvatskim propisima o fiskalizaciji, broj racuna
            mora biti u formatu{" "}
            <code className="bg-[var(--surface-secondary)] px-1 rounded">broj-poslovni_prostor-naplatni_uredaj</code>{" "}
            (npr. 43-1-1).
          </p>
        </CardContent>
      </Card>

      {/* Add new premises form */}
      <Card>
        <CardHeader>
          <CardTitle>Dodaj novi poslovni prostor</CardTitle>
          <CardDescription>
            Svaki poslovni prostor ima jedinstveni numericki kod koji se koristi u broju racuna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PremisesForm companyId={company.id} />
        </CardContent>
      </Card>

      {/* List of premises with bulk actions */}
      <div className="space-y-4">
        {premises.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={<Building className="h-8 w-8" />}
                title="Nema poslovnih prostora"
                description="Poslovni prostor je obavezan za fiskalizaciju racuna. Svaki prostor ima jedinstveni kod koji se koristi u broju racuna. Koristite obrazac iznad za dodavanje ili uvezite iz CSV datoteke."
              />
            </CardContent>
          </Card>
        ) : (
          <PremisesList premises={premises} companyId={company.id} />
        )}
      </div>
    </div>
  )
}
