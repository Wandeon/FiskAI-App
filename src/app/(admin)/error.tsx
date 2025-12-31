"use client"

import { ErrorDisplay } from "@/components/errors/error-display"

export default function AdminError({
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
      title="Greška u admin portalu"
      message="Došlo je do greške prilikom učitavanja admin portala. Molimo pokušajte ponovno."
    />
  )
}
