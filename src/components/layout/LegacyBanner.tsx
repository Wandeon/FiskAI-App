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
      className="mb-4 flex items-center gap-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-warning-text"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm">
        <span className="font-medium">Legacy view.</span> {message || "Actions are disabled."}{" "}
        <Link
          href="/control-center"
          className="font-medium underline underline-offset-2 hover:brightness-90"
        >
          Go to Control Center
        </Link>
      </p>
    </div>
  )
}
