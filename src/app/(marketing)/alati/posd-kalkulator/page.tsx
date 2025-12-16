import { Metadata } from "next"
import { POSDCalculatorClient } from "./POSDCalculatorClient"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"

export const metadata: Metadata = {
  title: "PO-SD Kalkulator | Izračunaj iz bankovnog izvoda | FiskAI",
  description:
    "Besplatni PO-SD kalkulator za paušalne obrtnike. Učitaj XML izvod iz banke i automatski izračunaj primitke po kvartalima. Erste, PBZ, ZABA, RBA.",
  keywords: [
    "PO-SD",
    "paušalni obrt",
    "kalkulator poreza",
    "bankovni izvod",
    "primitci",
    "ePorezna",
    "porez na dohodak",
  ],
  openGraph: {
    title: "PO-SD Kalkulator | Izračunaj iz bankovnog izvoda",
    description: "Učitaj XML izvod iz banke i automatski izračunaj primitke za PO-SD obrazac.",
    type: "website",
  },
}

export default function POSDCalculatorPage() {
  const webAppSchema = generateWebApplicationSchema({
    name: "PO-SD Kalkulator",
    description:
      "Besplatni PO-SD kalkulator za paušalne obrtnike. Učitaj XML izvod iz banke i automatski izračunaj primitke po kvartalima.",
    url: "https://fisk.ai/alati/posd-kalkulator",
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <POSDCalculatorClient />
    </>
  )
}
