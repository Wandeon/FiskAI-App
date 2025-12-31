import { requireAdmin } from "@/lib/auth-utils"
import { FileText } from "lucide-react"

export const metadata = {
  title: "Audit Log | Admin | FiskAI",
  description: "View platform audit logs",
}

export default async function AuditPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Log</h1>
          <p className="text-sm text-tertiary">View platform activity and audit trails</p>
        </div>
      </div>

      <div className="rounded-lg border border-default bg-surface p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-secondary" />
        <h2 className="mt-4 text-lg font-medium text-foreground">Coming Soon</h2>
        <p className="mt-2 text-sm text-tertiary">Audit logging features are under development.</p>
      </div>
    </div>
  )
}
