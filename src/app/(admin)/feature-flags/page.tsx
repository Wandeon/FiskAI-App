import { Suspense } from "react"
import { requireAdmin } from "@/lib/auth-utils"
import { Flag } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { FeatureFlagsView } from "./feature-flags-view"
import { listFlags, getFlagStats } from "@/lib/feature-flags"

export const metadata = {
  title: "Feature Flags | Admin | FiskAI",
  description: "Centralized feature flag management",
}

export const dynamic = "force-dynamic"

export default async function FeatureFlagsPage() {
  await requireAdmin()

  const [flags, stats] = await Promise.all([listFlags(), getFlagStats()])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="h-8 w-8 text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Feature Flags</h1>
          <p className="text-sm text-tertiary">
            Centralized feature flag management with rollout support
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <FeatureFlagsView initialFlags={flags} initialStats={stats} />
      </Suspense>
    </div>
  )
}
