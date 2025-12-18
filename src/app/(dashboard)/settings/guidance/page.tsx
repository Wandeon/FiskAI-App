// src/app/(dashboard)/settings/guidance/page.tsx
import { requireAuth } from "@/lib/auth-utils"
import { getGuidancePreferences } from "@/lib/guidance"
import { GuidanceSettingsClient } from "./GuidanceSettingsClient"

export const metadata = {
  title: "Postavke pomoći | FiskAI",
  description: "Konfigurirajte razinu pomoći i obavijesti",
}

export default async function GuidanceSettingsPage() {
  const user = await requireAuth()
  const preferences = await getGuidancePreferences(user.id!)

  return <GuidanceSettingsClient initialPreferences={preferences} />
}
