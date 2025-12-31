"use client"

import { ErrorDisplay } from "@/components/errors/error-display"

export default function TenantDetailError({
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
      title="Greška pri učitavanju detalja klijenta"
      message="Došlo je do greške prilikom učitavanja detalja klijenta. Molimo pokušajte ponovno."
    />
  )
}
