"use client"

import { MarketingPageTemplate } from "@/components/templates"
import { Receipt, Building2, CreditCard, FileText } from "lucide-react"

/**
 * Client component wrapper for the example template page.
 *
 * Demonstrates the MarketingPageTemplate pattern where pages
 * become pure configuration, not layout code.
 */
export function ExampleTemplateContent() {
  return (
    <MarketingPageTemplate
      hero={{
        label: "Template Demo",
        title: "Pages Are Now Configuration",
        description:
          "This entire page is defined by passing props to a template. Zero layout code in page.tsx.",
        actions: [
          { label: "Primary Action", href: "#", variant: "primary" },
          { label: "Secondary Action", href: "#", variant: "secondary" },
        ],
      }}
      featureSections={[
        {
          label: "Features",
          title: "What You Get",
          description: "Every feature card uses the same pattern, ensuring visual consistency.",
          items: [
            {
              icon: Receipt,
              title: "Fiscalization",
              description: "Automatic JIR/ZKI for every invoice.",
              href: "/features/fiscalization",
            },
            {
              icon: Building2,
              title: "Bank Sync",
              description: "Connect to all major Croatian banks.",
              href: "/features/banking",
            },
            {
              icon: CreditCard,
              title: "Payments",
              description: "Track payments and reconcile automatically.",
              href: "/features/payments",
            },
            {
              icon: FileText,
              title: "Reports",
              description: "Generate tax-ready reports instantly.",
              href: "/features/reports",
            },
          ],
          columns: 2,
        },
      ]}
      cta={{
        title: "Ready to Start?",
        description: "Join thousands of Croatian businesses using FiskAI.",
        actions: [{ label: "Get Started Free", href: "/register", variant: "primary" }],
      }}
    />
  )
}
