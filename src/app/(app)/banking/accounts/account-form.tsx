"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBankAccount } from "../actions"
import { useRouter } from "next/navigation"
import { getBankNameFromIban, isValidIban, formatIban } from "@/lib/banking/constants"
import { validateIban as fullValidateIban } from "@/lib/barcode"

export function AccountForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iban, setIban] = useState("")
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [bankName, setBankName] = useState("")
  const [currency, setCurrency] = useState("EUR")

  function validateIban(value: string) {
    const cleaned = value.replace(/\s/g, "").toUpperCase()
    if (!cleaned) {
      setIbanError(null)
      return cleaned
    }

    // Validate any European IBAN format and checksum
    const validation = fullValidateIban(cleaned)
    if (!validation.valid) {
      setIbanError(validation.error || "Invalid IBAN format or checksum")
    } else {
      setIbanError(null)

      // Auto-detect bank name from IBAN (only for Croatian IBANs)
      if (cleaned.startsWith("HR")) {
        const detectedBankName = getBankNameFromIban(cleaned)
        if (detectedBankName) {
          setBankName(detectedBankName)
        }
        // Auto-select EUR for Croatian IBANs
        setCurrency("EUR")
      } else {
        // For non-Croatian IBANs, clear bank name and default to EUR
        setBankName("")
        setCurrency("EUR")
      }
    }
    return cleaned
  }

  function handleIbanChange(e: React.ChangeEvent<HTMLInputElement>) {
    let value = e.target.value.toUpperCase().replace(/\s/g, "")

    // Limit to maximum IBAN length (34 characters)
    if (value.length > 34) {
      value = value.substring(0, 34)
    }

    // Format for display (add spaces every 4 characters)
    const formatted = value.match(/.{1,4}/g)?.join(" ") || value

    setIban(formatted)
    validateIban(value.replace(/\s/g, ""))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    // Add auto-detected bank name if available
    if (bankName) {
      formData.set("bankName", bankName)
    }

    // Add auto-selected currency
    formData.set("currency", currency)

    // Validate IBAN before submit
    const ibanValue = (formData.get("iban") as string).replace(/\s/g, "")
    const validation = fullValidateIban(ibanValue)
    if (!validation.valid) {
      setError(validation.error || "Invalid IBAN format or checksum")
      setLoading(false)
      return
    }

    const result = await createBankAccount(formData)

    if (result.success) {
      router.refresh()
      // Reset form
      e.currentTarget.reset()
      setIban("")
      setBankName("")
      setCurrency("EUR")
    } else {
      setError(result.error || "Greška pri dodavanju računa")
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Naziv računa *</Label>
          <Input
            id="name"
            name="name"
            placeholder="npr. PBZ Poslovni"
            required
            disabled={loading}
          />
        </div>

        <div>
          <Label htmlFor="iban">IBAN *</Label>
          <Input
            id="iban"
            name="iban"
            placeholder="HR1234567890123456789 or DE89370400440532013000"
            value={iban}
            onChange={handleIbanChange}
            required
            disabled={loading}
            className={ibanError ? "border-danger-border" : ""}
          />
          {ibanError && <p className="text-xs text-danger-text mt-1">{ibanError}</p>}
          <p className="text-xs text-secondary mt-1">Accepts all European IBAN formats</p>
        </div>

        <div>
          <Label htmlFor="bankName">Naziv banke *</Label>
          <Input
            id="bankName"
            name="bankName"
            placeholder="npr. Privredna banka Zagreb"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
            disabled={loading}
            className={bankName ? "bg-info-bg border-info-border" : ""}
          />
          {bankName && <p className="text-xs text-link mt-1">Automatski otkriveno iz IBAN-a</p>}
        </div>

        <div>
          <Label htmlFor="currency">Valuta</Label>
          <select
            id="currency"
            name="currency"
            className="w-full rounded-md border border-default px-3 py-2 text-sm"
            disabled={loading}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="EUR">EUR</option>
            <option value="HRK">HRK</option>
            <option value="USD">USD</option>
          </select>
          {iban.startsWith("HR") && currency === "EUR" && (
            <p className="text-xs text-link mt-1">Automatski odabrano za hrvatske IBAN-ove</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          name="isDefault"
          className="rounded border-default"
          disabled={loading}
        />
        <Label htmlFor="isDefault" className="font-normal cursor-pointer">
          Postavi kao zadani račun
        </Label>
      </div>

      <Button type="submit" disabled={loading || !!ibanError}>
        {loading ? "Dodavanje..." : "Dodaj račun"}
      </Button>
    </form>
  )
}
