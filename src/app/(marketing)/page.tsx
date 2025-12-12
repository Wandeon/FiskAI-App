import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, FileText, ScanText, Shield, Sparkles } from "lucide-react"

export default async function MarketingHomePage() {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div>
      <section className="surface-gradient">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] md:items-center">
            <div className="space-y-6">
              <h1 className="text-display text-4xl font-semibold md:text-5xl">
                AI-first računovodstvo koje ostaje u vašim rukama.
              </h1>
              <p className="max-w-xl text-base/7 text-white/85">
                FiskAI pomaže izdavati račune, skupljati troškove i pripremati podatke za knjigovođu — bez slanja mailova i bez “donosim fascikl”.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-white/95"
                >
                  Započni besplatno
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Zatraži demo
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Hrvatski UI i terminologija
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Fokus na fiskalizaciju / e-račune
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> AI za ubrzanje unosa troškova
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="border-white/15 bg-white/10 text-white shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Što je “uspjeh” u 10 minuta?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-white/85">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4" />
                    <p>Kreirajte tvrtku, kupca i prvi račun.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <ScanText className="mt-0.5 h-4 w-4" />
                    <p>Skenirajte prvi račun/trošak i spremite ga.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4" />
                    <p>Dobijte prijedloge kategorija i provjerite ih.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/15 bg-white/10 text-white shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Transparentno: FiskAI je u beta fazi</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/85">
                  Fokus je na brzom “time-to-value” za male tvrtke, uz postepeno proširenje na punu ERP funkcionalnost.
                  <div className="mt-3">
                    <Link href="/features" className="text-sm font-semibold text-white underline underline-offset-4">
                      Pogledaj mogućnosti
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="card card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Računi i e-računi
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Izdavanje, slanje i praćenje računa uz jasan status i audit trag.
            </CardContent>
          </Card>

          <Card className="card card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanText className="h-5 w-5 text-blue-600" />
                Troškovi + skeniranje
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Slikajte račun, izvucite podatke i potvrdite unos u par klikova.
            </CardContent>
          </Card>

          <Card className="card card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Sigurnost i kontrola
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Podaci pripadaju klijentu: izvoz, audit log i jasna pravila obrade.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <h2 className="text-display text-3xl font-semibold">Za paušalni obrt: jednostavno i kompletno</h2>
              <p className="text-sm text-[var(--muted)]">
                Cilj je da najjednostavniji korisnici dobiju sve što im treba: izdavanje računa, evidenciju troškova i “paket za knjigovođu” bez ručnog rada.
              </p>
              <div className="pt-2">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Pogledaj cijene
                </Link>
              </div>
            </div>
            <Card className="card">
              <CardHeader>
                <CardTitle className="text-lg">Što dobivate odmah</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[var(--muted)]">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> Brzi onboarding s checklistom
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> OCR + AI prijedlozi kategorija za troškove
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> Izvoz podataka (računi, troškovi, kontakti)
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> Priprema za e-račune / fiskalizaciju 2.0
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

