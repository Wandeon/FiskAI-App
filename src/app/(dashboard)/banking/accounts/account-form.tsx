'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBankAccount } from '../actions'
import { useRouter } from 'next/navigation'

export function AccountForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iban, setIban] = useState('')
  const [ibanError, setIbanError] = useState<string | null>(null)

  function validateIban(value: string) {
    const cleaned = value.replace(/\s/g, '').toUpperCase()
    if (!cleaned) {
      setIbanError(null)
      return cleaned
    }
    if (!/^HR\d{19}$/.test(cleaned)) {
      setIbanError('IBAN mora biti u formatu HR + 19 znamenki')
    } else {
      setIbanError(null)
    }
    return cleaned
  }

  function handleIbanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\s/g, '').toUpperCase()
    const validated = validateIban(value)
    setIban(validated)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    // Validate IBAN before submit
    const ibanValue = formData.get('iban') as string
    if (!/^HR\d{19}$/.test(ibanValue)) {
      setError('IBAN mora biti u formatu HR + 19 znamenki')
      setLoading(false)
      return
    }

    const result = await createBankAccount(formData)

    if (result.success) {
      router.refresh()
      // Reset form
      e.currentTarget.reset()
      setIban('')
    } else {
      setError(result.error || 'Greška pri dodavanju računa')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
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
            placeholder="HR1234567890123456789"
            value={iban}
            onChange={handleIbanChange}
            required
            disabled={loading}
            maxLength={21}
            className={ibanError ? 'border-red-500' : ''}
          />
          {ibanError && (
            <p className="text-xs text-red-600 mt-1">{ibanError}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Format: HR + 19 znamenki</p>
        </div>

        <div>
          <Label htmlFor="bankName">Naziv banke *</Label>
          <Input
            id="bankName"
            name="bankName"
            placeholder="npr. Privredna banka Zagreb"
            required
            disabled={loading}
          />
        </div>

        <div>
          <Label htmlFor="currency">Valuta</Label>
          <select
            id="currency"
            name="currency"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            disabled={loading}
            defaultValue="EUR"
          >
            <option value="EUR">EUR</option>
            <option value="HRK">HRK</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          name="isDefault"
          className="rounded border-gray-300"
          disabled={loading}
        />
        <Label htmlFor="isDefault" className="font-normal cursor-pointer">
          Postavi kao zadani račun
        </Label>
      </div>

      <Button type="submit" disabled={loading || !!ibanError}>
        {loading ? 'Dodavanje...' : 'Dodaj račun'}
      </Button>
    </form>
  )
}
