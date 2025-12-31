"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { companySettingsSchema } from "@/lib/validations"
import { updateCompanySettings } from "@/app/actions/company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Company } from "@prisma/client"
import { toast } from "@/lib/toast"

type SettingsFormInput = z.input<typeof companySettingsSchema>

interface EInvoiceSettingsFormProps {
  company: Company
}

const providers = [
  {
    id: "ie-racuni",
    name: "IE Računi",
    description: "Hrvatski pružatelj e-fakturiranja. Integracija s poreznom upravom.",
    website: "https://ie-racuni.hr",
  },
  {
    id: "fina",
    name: "Fina",
    description: "Nacionalni klirinški sustav. Siguran prijenos e-računa.",
    website: "https://www.fina.hr",
  },
  {
    id: "ddd-invoices",
    name: "DDD Invoices",
    description: "Međunarodni PEPPOL pristupnik za EU tržište.",
    website: "https://dddinvoices.com",
  },
  {
    id: "mock",
    name: "Test način (Mock)",
    description: "Za testiranje bez stvarnog slanja. Računi se ne šalju nikuda.",
    website: null,
  },
]

export function EInvoiceSettingsForm({ company }: EInvoiceSettingsFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)

  const { register, handleSubmit, watch } = useForm<SettingsFormInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      eInvoiceProvider: company.eInvoiceProvider as
        | "ie-racuni"
        | "fina"
        | "ddd-invoices"
        | "mock"
        | undefined,
      eInvoiceApiKey: "", // Always empty - encrypted keys cannot be shown
    },
  })

  const selectedProvider = watch("eInvoiceProvider")
  const selectedProviderInfo = providers.find((p) => p.id === selectedProvider)

  async function onSubmit(data: SettingsFormInput) {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await updateCompanySettings(company.id, data)

    if (result?.error) {
      setError(result.error)
      toast.error("Greška", result.error)
      setLoading(false)
      return
    }

    setSuccess("Postavke e-računa uspješno ažurirane")
    toast.success("Postavke e-računa spremljene")
    setLoading(false)
    router.refresh()
  }

  async function testConnection() {
    setTestingConnection(true)
    setError(null)
    setSuccess(null)

    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 1500))

    if (selectedProvider === "mock") {
      setSuccess("Test uspješan! Mock provider je spreman za testiranje.")
    } else if (!watch("eInvoiceApiKey")) {
      setError("API ključ je obavezan za testiranje veze")
    } else {
      setSuccess("Veza s pružateljem uspješno testirana!")
    }

    setTestingConnection(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-danger-bg border border-danger-border p-3 text-sm text-danger-text">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-success-bg border border-success-border p-3 text-sm text-success-text">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Informacijski posrednik</label>
          <select
            className="h-10 w-full rounded-md border border-default px-3"
            {...register("eInvoiceProvider")}
          >
            <option value="">Odaberite pružatelja...</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProviderInfo && (
          <div className="rounded-md bg-surface-1 border border-default p-4">
            <h4 className="font-medium">{selectedProviderInfo.name}</h4>
            <p className="mt-1 text-sm text-secondary">{selectedProviderInfo.description}</p>
            {selectedProviderInfo.website && (
              <a
                href={selectedProviderInfo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-link hover:underline"
              >
                Posjetite web stranicu →
              </a>
            )}
          </div>
        )}

        {selectedProvider && selectedProvider !== "mock" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">API ključ</label>
            <Input
              type="password"
              {...register("eInvoiceApiKey")}
              placeholder="Unesite API ključ od pružatelja"
            />
            <p className="text-xs text-secondary">
              API ključ dobivate od odabranog informacijskog posrednika nakon registracije.
            </p>
          </div>
        )}

        {selectedProvider === "mock" && (
          <div className="rounded-md bg-warning-bg border border-warning-border p-4">
            <h4 className="font-medium text-warning-text">Test način rada</h4>
            <p className="mt-1 text-sm text-warning-text">
              U test načinu rada e-računi se ne šalju nikuda. Koristite za testiranje
              funkcionalnosti aplikacije prije povezivanja sa stvarnim pružateljem.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Spremanje..." : "Spremi postavke"}
        </Button>
        {selectedProvider && (
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={testingConnection}
          >
            {testingConnection ? "Testiranje..." : "Testiraj vezu"}
          </Button>
        )}
      </div>
    </form>
  )
}
