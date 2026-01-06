import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { NotificationPreferences } from "@/components/pausalni/notification-preferences"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Bell } from "lucide-react"

export const metadata: Metadata = {
  title: "Postavke - Paušalni Compliance Hub | FiskAI",
  description: "Upravljajte postavkama obavijesti i integracija za paušalni obrt",
}

export default async function PausalniSettingsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  if (company.legalForm !== "OBRT_PAUSAL") {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Postavke - Paušalni Compliance Hub</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Prilagodite obavijesti i integracije za praćenje obveza
          </p>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Obavijesti i podsjetnici</CardTitle>
          </div>
          <CardDescription>
            Postavite obavijesti kako biste bili uvijek informirani o nadolazećim obvezama. Možete
            odabrati email podsjetnike ili sinkronizirati s vašim kalendarom.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Notification Preferences Component */}
      <NotificationPreferences />

      {/* Additional Settings Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">O postavkama</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Paušalni Compliance Hub automatski prati sve vaše obveze i rokove. Postavke
                  obavijesti omogućuju vam da budete uvijek informirani.
                </p>
                <p>
                  <strong>Email obavijesti:</strong> Primajte podsjetnike prije isteka roka na svoju
                  email adresu.
                </p>
                <p>
                  <strong>Kalendar integracija:</strong> Sinkronizirajte obveze s Google Calendar
                  ili preuzmite ICS datoteku za uvoz u bilo koju kalendar aplikaciju.
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Vrste obveza</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Compliance Hub prati sljedeće obveze:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Doprinosi MIO I i II (mjesečno)</li>
                  <li>Doprinosi zdravstveno (mjesečno)</li>
                  <li>Porez na dohodak (kvartalno)</li>
                  <li>PDV prijave (mjesečno, ako imate PDV-ID)</li>
                  <li>HOK članarina (godišnje)</li>
                  <li>PO-SD obrazac (godišnje)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
