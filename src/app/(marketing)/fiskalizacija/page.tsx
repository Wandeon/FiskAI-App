import { Metadata } from "next"
import Link from "next/link"
import { FileCheck, Calendar, ArrowRight, AlertTriangle } from "lucide-react"
import { Fiskalizacija2Wizard } from "@/components/marketing/Fiskalizacija2Wizard"
import { FAQ } from "@/components/content/FAQ"
import { Sources } from "@/components/content/Sources"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/schema"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

export const metadata: Metadata = {
  title: "Fiskalizacija 2.0 | Sve što trebate znati | FiskAI",
  description:
    "Kompletan vodič za Fiskalizaciju 2.0 u Hrvatskoj. Rokovi, obveze, priprema. Provjerite jeste li spremni.",
  openGraph: {
    title: "Fiskalizacija 2.0 | FiskAI",
    description: "Provjerite jeste li spremni za Fiskalizaciju 2.0",
  },
}

const keyDates = [
  { date: "1. rujna 2025.", event: "Početak testne faze" },
  { date: "31. prosinca 2025.", event: "Rok za registraciju posrednika" },
  { date: "1. siječnja 2026.", event: "Obvezno e-fakturiranje (PDV obveznici)" },
  { date: "1. siječnja 2027.", event: "Obvezno e-fakturiranje (svi)" },
]

const faq = [
  {
    q: "Što je Fiskalizacija 2.0?",
    a: "Fiskalizacija 2.0 je proširenje postojećeg sustava fiskalizacije koje uvodi obvezno e-fakturiranje za sve poslovne transakcije (B2B, B2G) i proširuje fiskalizaciju na sve načine plaćanja.",
  },
  {
    q: "Tko mora implementirati Fiskalizaciju 2.0?",
    a: "Svi poduzetnici u RH. PDV obveznici od 1.1.2026., ostali od 1.1.2027. Paušalci mogu koristiti besplatnu državnu aplikaciju MIKROeRAČUN.",
  },
  {
    q: "Što je informacijski posrednik?",
    a: "Ovlaštena tvrtka koja posreduje u razmjeni e-računa između poduzetnika i Porezne uprave. Mora se registrirati do 31.12.2025.",
  },
  {
    q: "Što ako ne implementiram na vrijeme?",
    a: "Kazne za neusklađenost kreću se od 2.000 do 200.000 EUR ovisno o vrsti prekršaja i veličini poduzeća.",
  },
]

const sources = [
  { name: "Zakon o fiskalizaciji (NN 89/25)", url: "https://narodne-novine.nn.hr/" },
  { name: "Porezna uprava - Fiskalizacija", url: "https://www.porezna-uprava.hr/" },
  { name: "e-Račun portal", url: "https://e-racun.hr/" },
]

export default function FiskalizacijaHubPage() {
  const breadcrumbs = [
    { name: "Baza znanja", url: "https://fisk.ai/baza-znanja" },
    { name: "Fiskalizacija 2.0", url: "https://fisk.ai/fiskalizacija" },
  ]

  return (
    <>
      <JsonLd schemas={[generateBreadcrumbSchema(breadcrumbs), generateFAQSchema(faq)]} />

      <SectionBackground variant="dark" showGrid={true} showOrbs={true}>
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <nav className="mb-6 text-sm text-white/60">
            <Link href="/baza-znanja" className="hover:text-white/90">
              Baza znanja
            </Link>{" "}
            <span>/</span> <span className="text-white/90">Fiskalizacija 2.0</span>
          </nav>

          {/* Hero */}
          <header className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-500/10 backdrop-blur-sm border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Rok: 31. prosinca 2025.
            </div>
            <h1 className="text-4xl font-bold text-white/90 md:text-5xl">Fiskalizacija 2.0</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Nova era e-fakturiranja u Hrvatskoj. Provjerite što se mijenja za vaše poslovanje i
              pripremite se na vrijeme.
            </p>
          </header>

          {/* Key dates */}
          <section className="mb-12">
            <h2 className="mb-6 text-center text-2xl font-bold text-white/90">Ključni datumi</h2>
            <div className="grid gap-4 md:grid-cols-4">
              {keyDates.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 text-center"
                >
                  <Calendar className="mx-auto mb-2 h-6 w-6 text-cyan-400" />
                  <p className="font-bold text-white/90">{item.date}</p>
                  <p className="mt-1 text-sm text-white/60">{item.event}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Wizard */}
          <section className="mb-12">
            <h2 className="mb-6 text-center text-2xl font-bold text-white/90">
              Provjerite svoju spremnost
            </h2>
            <Fiskalizacija2Wizard />
          </section>

          {/* Related guides */}
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-white/90">Povezani vodiči</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/kako-da/registrirati-informacijskog-posrednika"
                className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-cyan-500/20 hover:bg-cyan-500/10 hover:shadow-md"
              >
                <div>
                  <h3 className="font-semibold text-white/90 group-hover:text-cyan-400">
                    Kako registrirati informacijskog posrednika
                  </h3>
                  <p className="mt-1 text-sm text-white/50">
                    Korak po korak vodič za FiskAplikacija
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50 group-hover:text-cyan-400" />
              </Link>
              <Link
                href="/kako-da/registrirati-informacijskog-posrednika"
                className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-cyan-500/20 hover:bg-cyan-500/10 hover:shadow-md"
              >
                <div>
                  <h3 className="font-semibold text-white/90 group-hover:text-cyan-400">
                    Kako izdati prvi fiskalizirani račun
                  </h3>
                  <p className="mt-1 text-sm text-white/50">Od certifikata do JIR-a</p>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50 group-hover:text-cyan-400" />
              </Link>
            </div>
          </section>

          {/* FAQ */}
          <FAQ items={faq} />

          {/* Sources */}
          <Sources sources={sources} lastUpdated="2025-12-16" reviewer="Porezni savjetnik" />

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-8 text-center">
            <FileCheck className="mx-auto mb-4 h-12 w-12 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white/90">Spremni za Fiskalizaciju 2.0?</h2>
            <p className="mx-auto mt-2 max-w-lg text-white/60">
              FiskAI automatski generira e-račune u UBL formatu, fiskalizira ih i šalje putem PEPPOL
              mreže.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-medium text-white hover:opacity-90"
              >
                Započni besplatno
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-medium text-white/90 hover:bg-white/10"
              >
                Saznaj više
              </Link>
            </div>
          </div>
        </div>
      </SectionBackground>
    </>
  )
}
