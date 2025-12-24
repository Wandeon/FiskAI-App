import { Metadata } from "next"
import { AssistantContainer } from "@/components/assistant-v2"

export const metadata: Metadata = {
  title: "Asistent | FiskAI",
  description: "AI asistent za regulatorne upite s podacima vaše tvrtke.",
}

export default function AppAssistantPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Regulatorni asistent</h1>
        <p className="text-muted-foreground">
          Postavite pitanje. Odgovor će koristiti podatke vaše tvrtke.
        </p>
      </header>

      <AssistantContainer surface="APP" />
    </div>
  )
}
