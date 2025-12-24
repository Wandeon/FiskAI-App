import { Metadata } from "next"
import { AssistantContainer } from "@/components/assistant-v2"

export const metadata: Metadata = {
  title: "AI Asistent | FiskAI",
  description:
    "Postavi pitanje o porezima, PDV-u, doprinosima ili fiskalizaciji. Odgovor potkrije službenim izvorima.",
}

export default function MarketingAssistantPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Regulatorni asistent
        </h1>
        <p className="mt-2 text-white/70">
          Svaki odgovor potkrije službenim izvorima. Bez nagađanja.
        </p>
      </header>

      <AssistantContainer surface="MARKETING" />
    </div>
  )
}
