import type { Metadata } from "next"
import { MarketingFeaturesClient } from "@/components/marketing/MarketingFeaturesClient"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Mogućnosti",
  description:
    "Pregled mogućnosti FiskAI platforme (beta): računi, troškovi, AI/OCR i priprema za e-račune.",
  alternates: {
    canonical: `${BASE_URL}/features`,
  },
}

export default function FeaturesPage() {
  return <MarketingFeaturesClient />
}
