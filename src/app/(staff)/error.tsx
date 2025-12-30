"use client"

import { ErrorDisplay } from "@/components/errors/error-display"

export default function StaffError({
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
      title="Greška u Staff portalu"
      message="Došlo je do greške prilikom učitavanja Staff portala. Molimo pokušajte ponovno."
    />
  )
}
