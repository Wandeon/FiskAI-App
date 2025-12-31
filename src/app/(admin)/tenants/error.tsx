"use client"

import { ErrorDisplay } from "@/components/errors/error-display"

export default function TenantsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorDisplay
      error={error}
      reset={reset}
      title="Greška pri učitavanju klijenata"
      message="Došlo je do greške prilikom učitavanja liste klijenata. Molimo pokušajte ponovno."
    />
  )
}
