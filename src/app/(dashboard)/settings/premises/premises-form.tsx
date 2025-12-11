'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'
import { createPremises } from '@/app/actions/premises'

interface PremisesFormProps {
  companyId: string
}

export function PremisesForm({ companyId }: PremisesFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createPremises({
      companyId,
      code: parseInt(formData.get('code') as string, 10),
      name: formData.get('name') as string,
      address: formData.get('address') as string || undefined,
      isDefault: formData.get('isDefault') === 'on',
    })

    setIsLoading(false)

    if (result.success) {
      toast.success('Poslovni prostor je uspješno dodan')
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } else {
      toast.error(result.error || 'Greška pri dodavanju poslovnog prostora')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4">
      <div>
        <Label htmlFor="code">Kod</Label>
        <Input
          id="code"
          name="code"
          type="number"
          min="1"
          required
          placeholder="1"
          className="font-mono"
        />
      </div>
      <div>
        <Label htmlFor="name">Naziv</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Glavni ured"
        />
      </div>
      <div>
        <Label htmlFor="address">Adresa (opcionalno)</Label>
        <Input
          id="address"
          name="address"
          placeholder="Ilica 123, Zagreb"
        />
      </div>
      <div className="flex items-end gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDefault" className="rounded" />
          Zadani
        </label>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Spremanje...' : 'Dodaj'}
        </Button>
      </div>
    </form>
  )
}
