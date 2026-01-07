"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { switchCompany } from "@/lib/actions/company-switch"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"

type Company = {
  id: string
  name: string
  oib: string | null
}

export function ChooseCompanyClient({ companies }: { companies: Company[] }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSelect = (company: Company) => {
    startTransition(async () => {
      const result = await switchCompany(company.id)
      if (result?.success) {
        toast.success(
          "Aktivna tvrtka postavljena",
          company.oib ? `${company.name} (OIB: ${company.oib})` : company.name
        )
        router.push("/dashboard")
        router.refresh()
      } else {
        toast.error("Promjena tvrtke nije uspjela", result?.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {companies.map((company) => (
        <div
          key={company.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-default bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
            {company.oib && <p className="text-xs text-tertiary">OIB: {company.oib}</p>}
          </div>
          <Button size="sm" onClick={() => handleSelect(company)} disabled={isPending}>
            Odaberi
          </Button>
        </div>
      ))}
    </div>
  )
}
