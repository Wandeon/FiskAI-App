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
        <FileText className="h-8 w-8 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Log</h1>
          <p className="text-sm text-slate-500">View platform activity and audit trails</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="mt-4 text-lg font-medium text-slate-900">Coming Soon</h2>
        <p className="mt-2 text-sm text-slate-500">
          Audit logging features are under development.
        </p>
      </div>
    </div>
  )
}
