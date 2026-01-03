import React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

interface LegacyBannerProps {
  message?: string
}

export function LegacyBanner({ message }: LegacyBannerProps) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm">
        <span className="font-medium">Legacy view.</span> {message || "Actions are disabled."}{" "}
        <Link
          href="/control-center"
          className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
        >
          Go to Control Center
        </Link>
      </p>
    </div>
  )
}
