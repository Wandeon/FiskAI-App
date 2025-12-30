// src/components/onboarding/step-pausalni-profile.tsx
"use client"

import { useEffect, useState } from "react"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, Info, AlertTriangle } from "lucide-react"
import { lookupPostalCode, TAX_RATES, CONTRIBUTIONS, CHAMBER_FEES } from "@/lib/fiscal-data"
import { saveOnboardingData } from "@/app/actions/onboarding"
import { useRouter } from "next/navigation"

interface ObligationRow {
  label: string
  enabled: boolean
  annualAmount: number
  description: string
}

export function StepPausalniProfile() {
  const router = useRouter()
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()
  const [isSaving, setIsSaving] = useState(false)
  const [postalLookupFailed, setPostalLookupFailed] = useState(false)

  // Auto-fill from postal code
  useEffect(() => {
    if (data.postalCode && data.postalCode.length === 5) {
      const postalData = lookupPostalCode(data.postalCode)
      if (postalData) {
        updateData({
          municipality: postalData.municipality,
          county: postalData.county,
          prirezRate: postalData.prirezRate,
        })
        setPostalLookupFailed(false)
      } else {
        // Postal code not found - allow manual entry
        setPostalLookupFailed(true)
      }
    }
  }, [data.postalCode, updateData])

  // Calculate annual expenses based on selections
  const calculateObligations = (): ObligationRow[] => {
    const base = CONTRIBUTIONS.base.minimum
    const bracket =
      TAX_RATES.pausal.brackets.find((b) => b.min <= 0 && data.taxBracket === 1) ||
      TAX_RATES.pausal.brackets[Number(data.taxBracket) - 1]
    const quarterlyTax = bracket?.quarterlyTax || 50.85
    const annualTax = quarterlyTax * 4
    const prirezAmount = annualTax * (data.prirezRate || 0)

    return [
      {
        label: "MIO I (15%)",
        enabled: !data.employedElsewhere,
        annualAmount: data.employedElsewhere ? 0 : base * CONTRIBUTIONS.rates.MIO_I.rate * 12,
        description: "Mirovinsko osiguranje I. stup",
      },
      {
        label: "MIO II (5%)",
        enabled: !data.employedElsewhere,
        annualAmount: data.employedElsewhere ? 0 : base * CONTRIBUTIONS.rates.MIO_II.rate * 12,
        description: "Mirovinsko osiguranje II. stup",
      },
      {
        label: "HZZO (16.5%)",
        enabled: true,
        annualAmount: base * CONTRIBUTIONS.rates.HZZO.rate * 12,
        description: "Zdravstveno osiguranje",
      },
      {
        label: `Porez (razred ${data.taxBracket || 1})`,
        enabled: true,
        annualAmount: annualTax,
        description: `Paušalni porez na dohodak`,
      },
      {
        label: `Prirez (${((data.prirezRate || 0) * 100).toFixed(0)}%)`,
        enabled: (data.prirezRate || 0) > 0,
        annualAmount: prirezAmount,
        description: "Prirez porezu na dohodak",
      },
      {
        label: "HOK",
        enabled: true,
        annualAmount: CHAMBER_FEES.hok.annual,
        description: "Hrvatska obrtnička komora",
      },
    ]
  }

  const obligations = calculateObligations()
  const totalAnnual = obligations
    .filter((o) => o.enabled)
    .reduce((sum, o) => sum + o.annualAmount, 0)

  const handleBack = () => setStep(4)

  const handleComplete = async () => {
    if (!isStepValid(5)) return

    setIsSaving(true)
    try {
      await saveOnboardingData({
        name: data.name!,
        oib: data.oib!,
        legalForm: data.legalForm!,
        competence: data.competence,
        address: data.address!,
        postalCode: data.postalCode!,
        city: data.city!,
        country: data.country!,
        email: data.email!,
        phone: data.phone || undefined,
        iban: data.iban!,
        isVatPayer: data.isVatPayer ?? false,
        // Pausalni profile fields
        acceptsCash: data.acceptsCash,
        hasEmployees: data.hasEmployees,
        employedElsewhere: data.employedElsewhere,
        hasEuVatId: data.hasEuVatId,
        taxBracket: data.taxBracket,
        prirezRate: data.prirezRate,
      })
      // Navigate to billing step (step 6)
      setStep(6)
    } catch (error) {
      console.error("Failed to save paušalni profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Paušalni profil</h2>
        <p className="text-sm text-muted-foreground">
          Konfigurirajte postavke specifične za paušalni obrt
        </p>
      </div>

      {/* Location Auto-fill */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lokacija</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {postalLookupFailed && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">
                  Poštanski broj nije pronađen u bazi
                </p>
                <p className="text-amber-700 mt-1">
                  Molimo unesite podatke o lokaciji ručno
                </p>
              </div>
            </div>
          )}

          {postalLookupFailed ? (
            <>
              <div>
                <Label htmlFor="municipality">Općina</Label>
                <Input
                  id="municipality"
                  type="text"
                  value={data.municipality || ""}
                  onChange={(e) => updateData({ municipality: e.target.value })}
                  placeholder="npr. Grad Zagreb"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="county">Županija</Label>
                <Input
                  id="county"
                  type="text"
                  value={data.county || ""}
                  onChange={(e) => updateData({ county: e.target.value })}
                  placeholder="npr. Grad Zagreb"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="prirezRate">Stopa prireza (%)</Label>
                <Input
                  id="prirezRate"
                  type="number"
                  min="0"
                  max="18"
                  step="0.01"
                  value={data.prirezRate ? (data.prirezRate * 100).toFixed(2) : ""}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    updateData({ prirezRate: isNaN(value) ? 0 : value / 100 })
                  }}
                  placeholder="npr. 18"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Stopa prireza za vašu općinu (0-18%)
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Općina</Label>
                  <p className="font-medium">{data.municipality || "—"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Županija</Label>
                  <p className="font-medium">{data.county || "—"}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Stopa prireza</Label>
                <p className="font-medium">{((data.prirezRate || 0) * 100).toFixed(0)}%</p>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Automatski popunjeno iz poštanskog broja
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Situation Questions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Situacija</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Primate gotovinu ili kartice?</Label>
              <p className="text-xs text-muted-foreground">
                Zahtijeva FINA certifikat za fiskalizaciju
              </p>
            </div>
            <Switch
              checked={data.acceptsCash}
              onCheckedChange={(checked) => updateData({ acceptsCash: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Imate zaposlenike?</Label>
              <p className="text-xs text-muted-foreground">Potreban JOPPD modul</p>
            </div>
            <Switch
              checked={data.hasEmployees}
              onCheckedChange={(checked) => updateData({ hasEmployees: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Zaposleni ste kod drugog poslodavca?</Label>
              <p className="text-xs text-muted-foreground">MIO doprinosi se ne plaćaju dvostruko</p>
            </div>
            <Switch
              checked={data.employedElsewhere}
              onCheckedChange={(checked) => updateData({ employedElsewhere: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Imate EU PDV-ID broj?</Label>
              <p className="text-xs text-muted-foreground">Za reverse charge mehanizam</p>
            </div>
            <Switch
              checked={data.hasEuVatId}
              onCheckedChange={(checked) => updateData({ hasEuVatId: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax Bracket Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Porezni razred</CardTitle>
          <p className="text-xs text-muted-foreground">Iz Rješenja Porezne uprave ili procjena</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {TAX_RATES.pausal.brackets.map((bracket, idx) => (
              <label
                key={idx}
                className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  data.taxBracket === idx + 1
                    ? "border-focus bg-info-bg"
                    : "border-default hover:border-default"
                }`}
              >
                <input
                  type="radio"
                  name="taxBracket"
                  value={idx + 1}
                  checked={data.taxBracket === idx + 1}
                  onChange={(e) => updateData({ taxBracket: parseInt(e.target.value) })}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <span className="font-medium">Razred {idx + 1}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {bracket.min.toLocaleString()} - {bracket.max.toLocaleString()} EUR
                  </span>
                  <span className="ml-2 text-sm font-medium text-brand-600">
                    {bracket.quarterlyTax.toFixed(2)} EUR/kvartal
                  </span>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Expense Preview */}
      <Card className="border-brand-200 bg-brand-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Godišnji pregled troškova</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {obligations.map((ob, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${ob.enabled ? "bg-success" : "bg-gray-300"}`}
                  />
                  <span className={ob.enabled ? "" : "text-muted-foreground line-through"}>
                    {ob.label}
                  </span>
                </div>
                <span className={`font-medium ${ob.enabled ? "" : "text-muted-foreground"}`}>
                  {ob.annualAmount.toFixed(2)} EUR
                </span>
              </div>
            ))}
            <div className="mt-3 border-t pt-3 flex items-center justify-between font-semibold">
              <span>Ukupno godišnje</span>
              <span className="text-brand-600">{totalAnnual.toFixed(2)} EUR</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pro Module Upsell */}
      <div className="rounded-lg border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4">
        <p className="text-sm">
          <span className="font-semibold">FiskAI Pro:</span> Praćenje prihoda u realnom vremenu,
          projekcije razreda, optimizacija poreza
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Natrag
        </Button>
        <Button onClick={handleComplete} disabled={!isStepValid(5) || isSaving}>
          {isSaving ? "Spremanje..." : "Nastavi"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
