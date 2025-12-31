import { Metadata } from "next"
import { ExampleTemplateContent } from "./ExampleTemplateContent"

export const metadata: Metadata = {
  title: "Template Example | FiskAI",
  description: "Example page using MarketingPageTemplate",
}

// The page is now just configuration - page.tsx is a thin server wrapper
export default function ExampleTemplatePage() {
  return <ExampleTemplateContent />
}
