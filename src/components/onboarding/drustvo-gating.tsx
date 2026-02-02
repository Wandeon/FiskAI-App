"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * @deprecated DRUSTVO onboarding is now active. This component redirects to the new flow.
 *
 * Previously displayed a waitlist signup form for users who selected Društvo.
 * Now that DRUSTVO onboarding is implemented, this component simply redirects
 * users to the actual onboarding flow.
 */
export function DrushtvoGating() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to actual DRUSTVO onboarding
    router.replace("/onboarding?step=drustvo-step1")
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Preusmjeravam...</p>
    </div>
  )
}
