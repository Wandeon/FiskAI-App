import type { Metadata } from "next"
import { MarketingPricingClient } from "@/components/marketing/MarketingPricingClient"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Cijene i paketi",
  description:
    "Transparentne cijene za paušalni obrt, VAT obrt/d.o.o. i knjigovođe. Besplatna proba, bez ugovorne obveze.",
  alternates: {
    canonical: `${BASE_URL}/pricing`,
  },
}

export default function PricingPage() {
  return <MarketingPricingClient />
}
