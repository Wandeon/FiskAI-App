import { Metadata } from "next"
import { MigrationPageClient } from "./MigrationPageClient"

export const metadata: Metadata = {
  title: "Prijeđi na FiskAI | Jednostavna migracija",
  description:
    "Umoran od kompliciranog softvera? Prijeđi na FiskAI u 5 minuta. Uvezi podatke, zadrži mir.",
  openGraph: {
    title: "Prijeđi na FiskAI | Jednostavna migracija",
    description: "Umoran od kompliciranog softvera? Prijeđi na FiskAI u 5 minuta.",
  },
}

export default function MigrationPage() {
  return <MigrationPageClient />
}
