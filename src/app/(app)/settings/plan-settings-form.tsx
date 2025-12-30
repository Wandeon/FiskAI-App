"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/lib/toast"
import { updateCompanyPlan, checkCompanyHasHistoricalData } from "@/app/actions/company"
import type { Company } from "@prisma/client"
import type { ModuleKey, LegalForm } from "@/lib/capabilities"

import { MODULES, MODULE_KEYS } from "@/lib/modules/definitions"

const legalForms = [
  { value: "OBRT_PAUSAL", label: "Obrt (paušal)" },
  { value: "OBRT_REAL", label: "Obrt (realno)" },
  { value: "OBRT_VAT", label: "Obrt (PDV)" },
  { value: "JDOO", label: "j.d.o.o." },
  { value: "DOO", label: "d.o.o." },
] as const

export function PlanSettingsForm({ company }: { company: Company }) {
  const [legalForm, setLegalForm] = useState<LegalForm>((company.legalForm as LegalForm) || "DOO")
  const [isVatPayer, setIsVatPayer] = useState<boolean>(company.isVatPayer)

  // Initialize entitlements from DB, handling Json type and ensuring valid keys
  const [entitlements, setEntitlements] = useState<ModuleKey[]>(() => {
    if (Array.isArray(company.entitlements)) {
      return company.entitlements as ModuleKey[]
    }
    // Default set if null or invalid
    return ["platform-core", "invoicing", "e-invoicing", "expenses", "reports-basic", "documents"]
  })

  const [isPending, startTransition] = useTransition()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingLegalForm, setPendingLegalForm] = useState<LegalForm | null>(null)
  const [hasHistoricalData, setHasHistoricalData] = useState(false)
  const [historicalDataDetails, setHistoricalDataDetails] = useState<{
    invoiceCount: number
    premisesCount: number
    contactCount: number
  } | null>(null)

  // Check for historical data on mount
  useEffect(() => {
    const checkData = async () => {
      const result = await checkCompanyHasHistoricalData(company.id)
      if (result.hasHistoricalData !== undefined) {
        setHasHistoricalData(result.hasHistoricalData)
        setHistoricalDataDetails(result.details || null)
      }
    }
    checkData()
  }, [company.id])

  const toggleEntitlement = (key: ModuleKey) => {
    setEntitlements((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleLegalFormChange = (newLegalForm: LegalForm) => {
    const currentLegalForm = (company.legalForm as LegalForm) || "DOO"

    // If legal form is changing and company has historical data, show confirmation
    if (newLegalForm !== currentLegalForm && hasHistoricalData) {
      setPendingLegalForm(newLegalForm)
      setShowConfirmDialog(true)
    } else {
      setLegalForm(newLegalForm)
    }
  }

  const handleConfirmLegalFormChange = () => {
    if (pendingLegalForm) {
      setLegalForm(pendingLegalForm)
      setPendingLegalForm(null)
    }
    setShowConfirmDialog(false)
  }

  const handleCancelLegalFormChange = () => {
    setPendingLegalForm(null)
    setShowConfirmDialog(false)
  }

  const onSubmit = () => {
    startTransition(async () => {
      const res = await updateCompanyPlan(company.id, {
        legalForm,
        isVatPayer,
        entitlements,
      })
      if (res?.error) {
        toast.error("Greška", res.error)
      } else {
        toast.success("Plan ažuriran")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Pravna forma
          </label>
          <select
            value={legalForm}
            onChange={(e) => handleLegalFormChange(e.target.value as LegalForm)}
            className="w-full rounded-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {legalForms.map((form) => (
              <option key={form.value} value={form.value}>
                {form.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Određuje koja polja/obveze se prikazuju.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="vatPayer"
            type="checkbox"
            checked={isVatPayer}
            onChange={(e) => setIsVatPayer(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="vatPayer" className="text-sm font-medium text-[var(--foreground)]">
            PDV obveznik
          </label>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Moduli</p>
        <p className="text-xs text-[var(--muted)] mb-2">
          Aktivirajte module dostupne ovom klijentu.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {MODULE_KEYS.map((key) => {
            const mod = MODULES[key]
            const checked = entitlements.includes(key)
            return (
              <label
                key={key}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEntitlement(key)}
                  className="h-4 w-4 rounded border-[var(--border)] text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-[var(--foreground)]">{mod.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isPending || entitlements.length === 0}>
          {isPending ? "Spremanje..." : "Spremi plan"}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={handleCancelLegalFormChange}
        onConfirm={handleConfirmLegalFormChange}
        title="Promjena pravne forme"
        variant="warning"
        confirmLabel="Da, promijeni"
        cancelLabel="Odustani"
      >
        <div className="mt-3 space-y-3 text-sm text-[var(--foreground)]">
          <p className="font-medium">
            Mijenjate pravnu formu tvrtke koja već ima unešene podatke. Ova promjena može imati
            ozbiljne posljedice:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[var(--muted)]">
            <li>
              <strong className="text-[var(--foreground)]">Porezne implikacije:</strong> Različite
              pravne forme imaju različite porezne obveze
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Postojeće fakture:</strong> Ranije izdane
              fakture ostaju pod starom pravnom formom
            </li>
            <li>
              <strong className="text-[var(--foreground)]">PDV status:</strong> Promjena može
              utjecati na PDV obveze i evidentiranje
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Pristup modulima:</strong> Neke funkcije
              mogu postati nedostupne ili dostupne
            </li>
          </ul>
          {historicalDataDetails && (
            <div className="mt-3 p-3 bg-[var(--surface-secondary)] rounded-lg border border-[var(--border)]">
              <p className="font-medium mb-2">Postojeći podaci:</p>
              <ul className="text-xs space-y-1 text-[var(--muted)]">
                {historicalDataDetails.invoiceCount > 0 && (
                  <li>• {historicalDataDetails.invoiceCount} faktura</li>
                )}
                {historicalDataDetails.premisesCount > 0 && (
                  <li>• {historicalDataDetails.premisesCount} poslovnih prostora</li>
                )}
                {historicalDataDetails.contactCount > 0 && (
                  <li>• {historicalDataDetails.contactCount} kontakata</li>
                )}
              </ul>
            </div>
          )}
          <p className="font-medium text-warning-600 mt-4">
            Jeste li sigurni da želite promijeniti pravnu formu?
          </p>
        </div>
      </ConfirmDialog>
    </div>
  )
}
