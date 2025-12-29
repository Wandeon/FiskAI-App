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
        <CreditCard className="h-8 w-8 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Subscriptions</h1>
          <p className="text-sm text-slate-500">Manage platform subscriptions and billing</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="mt-4 text-lg font-medium text-slate-900">Coming Soon</h2>
        <p className="mt-2 text-sm text-slate-500">
          Subscription management features are under development.
        </p>
      </div>
    </div>
  )
}
