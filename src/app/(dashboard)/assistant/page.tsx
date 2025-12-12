import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, Search, Notebook } from "lucide-react"

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">FiskAI asistent</h1>
            <p className="text-gray-600">
              Asistent je u izradi. U međuvremenu koristite postojeće brze akcije i pretragu kako biste došli do računa i kontakata bez klikanja kroz izbornik.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/e-invoices/new">
                  <ArrowRight className="mr-2 h-4 w-4" /> Novi e-račun
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/contacts">
                  <ArrowRight className="mr-2 h-4 w-4" /> Pregled kontakata
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Search className="h-4 w-4 text-gray-500" />
            Command palette (⌘K / Ctrl+K)
          </div>
          <p className="text-sm text-gray-600">
            Otvorite paletu naredbi za brzu navigaciju, pretragu kontakata i skok na obrasce bez miša.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Notebook className="h-4 w-4 text-gray-500" />
            Vodiči i podrška
          </div>
          <p className="text-sm text-gray-600">
            Trebate pomoć oko fiskalizacije ili e-računa? Javi se timu ili pogledaj dokumentaciju iz dashboarda.
          </p>
        </div>
      </div>
    </div>
  )
}
