import { Metadata } from "next"
import { ExampleTemplateContent } from "./ExampleTemplateContent"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Template Example | FiskAI",
  description: "Example page using MarketingPageTemplate",
  alternates: {
    canonical: `${BASE_URL}/example-template`,
  },
}

// The page is now just configuration - page.tsx is a thin server wrapper
export default function ExampleTemplatePage() {
  return <ExampleTemplateContent />
}
