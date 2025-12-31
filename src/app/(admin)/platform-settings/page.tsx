import { requireAdmin } from "@/lib/auth-utils"
import { Settings } from "lucide-react"

export const metadata = {
  title: "Settings | Admin | FiskAI",
  description: "Platform settings and configuration",
}

export default async function SettingsPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
          <p className="text-sm text-tertiary">Platform settings and configuration</p>
        </div>
      </div>

      <div className="rounded-lg border border-default bg-surface p-8 text-center">
        <Settings className="mx-auto h-12 w-12 text-secondary" />
        <h2 className="mt-4 text-lg font-medium text-foreground">Coming Soon</h2>
        <p className="mt-2 text-sm text-tertiary">
          Platform settings features are under development.
        </p>
      </div>
    </div>
  )
}
