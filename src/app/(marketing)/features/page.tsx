import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ScanText, Sparkles, Shield, Users, Landmark } from "lucide-react"

export const metadata: Metadata = {
  title: "FiskAI — Mogućnosti",
  description: "Pregled mogućnosti FiskAI platforme (beta): računi, troškovi, AI/OCR i priprema za e-račune.",
}

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <div className="space-y-3">
        <h1 className="text-display text-4xl font-semibold">Mogućnosti</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          FiskAI je modularan: počnite s osnovama (paušalni obrt), a zatim dodajte e-račune, fiskalizaciju i napredne funkcije kako rastete.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="card card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Računi
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Kreiranje, slanje i praćenje računa, statusi, kupci, artikli, predlošci i izvozi.
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
            Skenirajte račun, automatski izvucite podatke i potvrdite unos (AI/OCR).
          </CardContent>
        </Card>

        <Card className="card card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-blue-600" />
              E-računi i fiskalizacija 2.0 (u razvoju)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Priprema za integraciju s informacijskim posrednicima (npr. IE-Računi) i praćenje statusa e-računa.
          </CardContent>
        </Card>

        <Card className="card card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Suradnja s knjigovođom
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Izvozi i audit trag omogućuju suradnju bez “fascikla” i ručnog prepisivanja.
          </CardContent>
        </Card>

        <Card className="card card-hover md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI-first princip
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            AI nikad ne “mijenja istinu” bez potvrde korisnika: prijedlozi su vidljivi, reverzibilni i (idealno) auditabilni.
          </CardContent>
        </Card>

        <Card className="card card-hover md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Sigurnost i privatnost
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            FiskAI treba imati jasan “Trust Center”: gdje su podaci, koliko se čuvaju, kako se izvoze i brišu te kako radi AI obrada.
            <div className="mt-3">
              <Link href="/security" className="text-sm font-semibold text-blue-700 hover:underline">
                Pročitaj više
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

