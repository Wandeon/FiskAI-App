import { Metadata } from "next"
import { AssistantContainer } from "@/components/assistant-v2"

export const metadata: Metadata = {
  title: "AI Asistent | FiskAI",
  description:
    "Postavi pitanje o porezima, PDV-u, doprinosima ili fiskalizaciji. Odgovor potkrije službenim izvorima.",
}

export default function MarketingAssistantPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-20 pb-12 md:px-6 md:pt-24">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Regulatorni asistent
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Svaki odgovor potkrije službenim izvorima. Bez nagađanja.
        </p>
      </header>

      <AssistantContainer surface="MARKETING" />
    </div>
  )
}
