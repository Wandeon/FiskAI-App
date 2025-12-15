"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">Došlo je do greške</h1>
            <p className="mb-6 text-gray-600">
              Nažalost, došlo je do neočekivane greške. Naš tim je obaviješten i radimo na rješenju.
            </p>
            <button
              onClick={() => reset()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Pokušaj ponovo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
