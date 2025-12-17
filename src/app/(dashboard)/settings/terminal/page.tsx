import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TerminalSettingsForm } from "./terminal-settings-form"

export default async function TerminalSettingsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stripe Terminal</h1>
        <p className="text-gray-500">Konfiguracija fizičkog čitača kartica za POS</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Terminal postavke</CardTitle>
        </CardHeader>
        <CardContent>
          <TerminalSettingsForm
            initialData={{
              locationId: company.stripeTerminalLocationId || "",
              readerId: company.stripeTerminalReaderId || "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
