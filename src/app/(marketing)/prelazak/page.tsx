import { Metadata } from "next"
import { MigrationPageClient } from "./MigrationPageClient"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Prijeđi na FiskAI | Jednostavna migracija",
  description:
    "Umoran od kompliciranog softvera? Prijeđi na FiskAI u 5 minuta. Uvezi podatke, zadrži mir.",
  alternates: {
    canonical: `${BASE_URL}/prelazak`,
  },
  openGraph: {
    title: "Prijeđi na FiskAI | Jednostavna migracija",
    description: "Umoran od kompliciranog softvera? Prijeđi na FiskAI u 5 minuta.",
  },
}

export default function MigrationPage() {
  return <MigrationPageClient />
}
