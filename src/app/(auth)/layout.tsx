import type { Metadata } from "next"
import { MarketingAnalyticsInit } from "@/components/marketing/marketing-analytics-init"

export const metadata: Metadata = {
  title: "FiskAI - Prijava",
  description: "Prijavite se u FiskAI sustav",
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-base font-sans antialiased">
      <MarketingAnalyticsInit />
      {/* We can add a simple absolute positioned logo here if needed, 
          but AuthFlow seems to handle its own full-page design. 
          Keeping this layout minimal ensures no conflict. */}
      {children}
    </div>
  )
}
