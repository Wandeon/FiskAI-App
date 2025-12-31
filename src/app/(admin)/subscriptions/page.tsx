import { requireAdmin } from "@/lib/auth-utils"
import { CreditCard } from "lucide-react"

export const metadata = {
  title: "Subscriptions | Admin | FiskAI",
  description: "Manage platform subscriptions",
}

export default async function SubscriptionsPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-8 w-8 text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Subscriptions</h1>
          <p className="text-sm text-tertiary">Manage platform subscriptions and billing</p>
        </div>
      </div>

      <div className="rounded-lg border border-default bg-surface p-8 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-secondary" />
        <h2 className="mt-4 text-lg font-medium text-foreground">Coming Soon</h2>
        <p className="mt-2 text-sm text-tertiary">
          Subscription management features are under development.
        </p>
      </div>
    </div>
  )
}
