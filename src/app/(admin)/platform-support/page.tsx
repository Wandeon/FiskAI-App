import { requireAdmin } from "@/lib/auth-utils"
import { MessageSquare } from "lucide-react"

export const metadata = {
  title: "Support | Admin | FiskAI",
  description: "Manage support tickets",
}

export default async function SupportPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-8 w-8 text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Support</h1>
          <p className="text-sm text-tertiary">Manage support tickets and user inquiries</p>
        </div>
      </div>

      <div className="rounded-lg border border-default bg-white p-8 text-center">
        <MessageSquare className="mx-auto h-12 w-12 text-secondary" />
        <h2 className="mt-4 text-lg font-medium text-foreground">Coming Soon</h2>
        <p className="mt-2 text-sm text-tertiary">
          Support ticket management features are under development.
        </p>
      </div>
    </div>
  )
}
