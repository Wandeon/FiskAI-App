"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateTerminalSettings } from "@/app/actions/terminal"
import { toast } from "@/lib/toast"

interface Props {
  initialData: {
    locationId: string
    readerId: string
  }
}

export function TerminalSettingsForm({ initialData }: Props) {
  const [locationId, setLocationId] = useState(initialData.locationId)
  const [readerId, setReaderId] = useState(initialData.readerId)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const result = await updateTerminalSettings({
        stripeTerminalLocationId: locationId || null,
        stripeTerminalReaderId: readerId || null,
      })

      if (result.success) {
        toast.success("Postavke spremljene")
      }
    } catch (error) {
      toast.error("Greška pri spremanju")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Terminal Location ID
        </label>
        <Input
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          placeholder="tml_..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Pronađite u Stripe Dashboard → Terminal → Locations
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Reader ID
        </label>
        <Input
          value={readerId}
          onChange={(e) => setReaderId(e.target.value)}
          placeholder="tmr_..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Pronađite u Stripe Dashboard → Terminal → Readers
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Spremanje..." : "Spremi"}
      </Button>
    </form>
  )
}
