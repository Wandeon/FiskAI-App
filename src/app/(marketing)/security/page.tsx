import type { Metadata } from "next"
import Link from "next/link"
import {
  Shield,
  Lock,
  Database,
  Eye,
  Clock,
  Download,
  AlertTriangle,
  Users,
  Globe,
} from "lucide-react"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Sigurnost i Trust Center",
  description:
    "Detaljna sigurnosna politika, podaci o privatnosti, rezidenciji podataka, incidentima i dostupnosti za FiskAI.",
  alternates: {
    canonical: `${BASE_URL}/security`,
  },
  openGraph: {
    title: "FiskAI — Sigurnost i Trust Center",
    description:
      "Detaljna sigurnosna politika, podaci o privatnosti, rezidenciji podataka, incidentima i dostupnosti za FiskAI.",
    url: `${BASE_URL}/security`,
    siteName: "FiskAI",
    locale: "hr_HR",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "FiskAI - Sigurnost i zaštita podataka",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FiskAI — Sigurnost i Trust Center",
    description:
      "Detaljna sigurnosna politika, podaci o privatnosti, rezidenciji podataka, incidentima i dostupnosti za FiskAI.",
    images: [`${BASE_URL}/opengraph-image`],
  },
}

export default function SecurityPage() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
        <div className="mb-10">
          <h1 className="text-display text-4xl font-semibold">Sigurnost i Trust Center</h1>
          <p className="mt-4 text-lg text-white/60 max-w-2xl">
            FiskAI obrađuje osjetljive poslovne i računovodstvene podatke. Ovdje možete pronaći sve
            informacije o sigurnosti, privatnosti, podacima i našim operativnim standardima.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-8">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Sigurnosni principi</h2>
                  <p className="text-sm text-white/60 mt-1">
                    Temeljni stavovi koji vode naš pristup sigurnosti
                  </p>
                </div>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Kontrola ostaje kod klijenta:</strong> jasni izvozi, audit tragovi i
                    potpuna transparentnost promjena.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Najmanje privilegije:</strong> multi-tenant izolacija, role-based
                    pristupi po tvrtki.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Eye className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Auditabilnost:</strong> kompletan trag tko je što promijenio, kada i
                    zašto.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>AI je opcionalan i kontroliran:</strong> korisnik uvijek potvrđuje AI
                    prijedloge, nikad &quot;tiho&quot; mijenjanje.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Rezidencija i pohrana podataka</h2>
                  <p className="text-sm text-white/60 mt-1">
                    Gdje se podaci pohranjuju i koliko dugo
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Glavna lokacija podataka</p>
                  <p className="text-white/60">
                    Primarna baza podataka: EU (Njemačka) - Hetzner Cloud
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Svi podaci ostaju unutar Europske unije u skladu s GDPR
                  </p>
                </div>
                <div>
                  <p className="font-medium">Backup lokacije</p>
                  <p className="text-white/60">EU (Njemačka) - Hetzner Cloud</p>
                  <p className="text-xs text-white/60 mt-1">
                    Dnevni backupi, 30 dana retencije, šifrirani
                  </p>
                </div>
                <div>
                  <p className="font-medium">AI/OCR obrada (opcionalna)</p>
                  <p className="text-white/60">
                    OpenAI API (EU, Dublin) ili lokalni modeli za osjetljive podatke
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Korisnik može onemogućiti AI obrada u postavkama
                  </p>
                </div>
                <div>
                  <p className="font-medium">Arhiviranje (računi)</p>
                  <p className="text-white/60">
                    11 godina za fiskalizirane račune (hrvatski zakon)
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Automatska migracija u cold storage nakon 2 godine
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Dostupnost i uptime</h2>
                  <p className="text-sm text-white/60 mt-1">Očekivanja i monitoring</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">SLA za produkciju</p>
                  <p className="text-white/60">99.5% mjesečne dostupnosti (cilj 99.9%)</p>
                  <p className="text-xs text-white/60 mt-1">
                    Iznimke: planirano održavanje (najavljivo) i force majeure
                  </p>
                </div>
                <div>
                  <p className="font-medium">Monitoring</p>
                  <p className="text-white/60">
                    24/7 monitoring aplikacije, baze podataka, API endpointa
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Automatski alerti za kritične komponente
                  </p>
                </div>
                <div>
                  <p className="font-medium">Status stranica</p>
                  <div className="flex items-center gap-3 mt-2">
                    <a href="/status" className="text-primary hover:underline text-sm font-medium">
                      Status sustava
                    </a>
                    <a
                      href="/api/health"
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      /api/health
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Prava korisnika i izvoz podataka</h2>
                  <p className="text-sm text-white/60 mt-1">Kontrola nad vašim podacima</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">Izvoz podataka</p>
                  <p className="text-white/60">
                    Kompletan izvoz u CSV/Excel/JSON formatu sa svim privitcima
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Dostupno u postavkama računa, filtriranje po datumu
                  </p>
                </div>
                <div>
                  <p className="font-medium">Brisanje računa</p>
                  <p className="text-white/60">Trajno brisanje svih podataka na zahtjev</p>
                  <p className="text-xs text-white/60 mt-1">
                    Izuzetak: fiskalizirani računi (11 godina zakonske obveze)
                  </p>
                </div>
                <div>
                  <p className="font-medium">GDPR prava</p>
                  <p className="text-white/60">
                    Pravo na pristup, ispravak, brisanje, ograničenje obrade i prijenos podataka
                  </p>
                </div>
                <div>
                  <p className="font-medium">Zahtjevi za podacima</p>
                  <p className="text-white/60">
                    Slanje zahtjeva na:{" "}
                    <a href="mailto:gdpr@fiskai.hr" className="text-primary hover:underline">
                      gdpr@fiskai.hr
                    </a>
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Odgovor unutar 30 dana u skladu s GDPR
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1">
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Incidenti i sigurnosni program</h2>
                  <p className="text-sm text-white/60 mt-1">
                    Kako postupamo u slučaju sigurnosnih incidenta
                  </p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">Sigurnosni program</p>
                  <p className="text-white/60">
                    Redovite sigurnosne revizije, penetration testing (planirano Q2 2025)
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Bug bounty program za sigurnosne propuste
                  </p>
                </div>
                <div>
                  <p className="font-medium">Proces za incidente</p>
                  <ul className="list-disc pl-5 space-y-1 text-white/60">
                    <li>Detekcija i klasifikacija (kritičan/visok/srednji/nizak)</li>
                    <li>Containment i eradikacija</li>
                    <li>Obnova i lessons learned</li>
                    <li>Obavijest klijenata (prema GDPR i ugovornim obvezama)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Prijava sigurnosnih propusta</p>
                  <p className="text-white/60">
                    Email:{" "}
                    <a href="mailto:security@fiskai.hr" className="text-primary hover:underline">
                      security@fiskai.hr
                    </a>
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Enkripcija PGP ključem dostupna na zahtjev
                  </p>
                </div>
                <div>
                  <p className="font-medium">Obligacija obavijesti</p>
                  <p className="text-white/60">
                    Obavijest klijenata u roku od 72h za kritične sigurnosne incidente
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Privatnost i AI politika</h2>
                  <p className="text-sm text-white/60 mt-1">
                    Kako koristimo AI i štitimo vašu privatnost
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">AI obrada (OCR, kategorizacija)</p>
                  <p className="text-white/60">
                    Opt-in po defaultu, korisnik može onemogućiti u postavkama
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Za AI obrada koristimo isključivo EU-based provajdere
                  </p>
                </div>
                <div>
                  <p className="font-medium">Podaci za trening modela</p>
                  <p className="text-white/60">
                    NE koristimo korisničke podatke za trening AI modela bez eksplicitnog pristanka
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Anonimizirani i agregirani podaci samo za poboljšanje usluge
                  </p>
                </div>
                <div>
                  <p className="font-medium">Povezane politike</p>
                  <div className="flex flex-col gap-2 mt-2">
                    <Link href="/privacy" className="text-primary hover:underline text-sm">
                      Politika privatnosti
                    </Link>
                    <Link href="/ai-data-policy" className="text-primary hover:underline text-sm">
                      AI politika podataka
                    </Link>
                    <Link href="/dpa" className="text-primary hover:underline text-sm">
                      DPA (Obrada podataka)
                    </Link>
                    <Link href="/cookies" className="text-primary hover:underline text-sm">
                      Politika kolačića
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg border border-info-border bg-gradient-to-r from-info-bg to-info-bg p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Certifikati i usklađenost (u izradi)
          </h3>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="font-medium">GDPR</p>
              <p className="text-white/60">Usklađeni s EU GDPR regulativom</p>
            </div>
            <div>
              <p className="font-medium">ISO 27001</p>
              <p className="text-white/60">Planirano za Q3 2025</p>
            </div>
            <div>
              <p className="font-medium">Fiskalizacija 2.0</p>
              <p className="text-white/60">Priprema za EN 16931 i hrvatske propise</p>
            </div>
          </div>
          <p className="text-xs text-white/60 mt-4">
            Ova stranica se kontinuirano ažurira. Zadnja revizija:{" "}
            {new Date().toLocaleDateString("hr-HR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Za pitanja o sigurnosti kontaktirajte{" "}
            <a href="mailto:security@fiskai.hr" className="text-primary hover:underline">
              security@fiskai.hr
            </a>
            .
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
