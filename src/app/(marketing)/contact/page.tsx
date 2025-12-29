import type { Metadata } from "next"
import Link from "next/link"
import { Mail, Phone, MapPin, Clock, MessageSquare } from "lucide-react"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { companyInfo, getPhoneLink, getFullAddress } from "@/config/company"
import { ContactForm } from "@/components/marketing/contact-form"

export const metadata: Metadata = {
  title: "FiskAI — Kontakt",
  description: "Kontaktirajte FiskAI tim za demo, beta program ili podršku.",
}

export default function ContactPage() {
  return (
    <SectionBackground variant="dark">
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
        <div className="mb-10">
          <h1 className="text-display text-4xl font-semibold">Kontakt i podrška</h1>
          <p className="mt-4 text-lg text-white/60 max-w-2xl">
            Javite nam se za demo, beta pristup ili tehničku podršku. Fokusirani smo na paušalni
            obrt, VAT i suradnju s knjigovođama.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-8">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Kontakt podaci</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <MapPin className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="font-medium">Adresa</p>
                    <p className="text-sm text-white/60">{getFullAddress()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Mail className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <a
                      href={`mailto:${companyInfo.emailContact}`}
                      className="text-sm text-cyan-400 hover:underline block"
                    >
                      {companyInfo.emailContact}
                    </a>
                    <p className="text-xs text-white/60 mt-1">Općeniti upiti, demo zahtjevi</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Phone className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="font-medium">Telefon</p>
                    <a
                      href={getPhoneLink(companyInfo.phone)}
                      className="text-sm text-cyan-400 hover:underline block"
                    >
                      {companyInfo.phone}
                    </a>
                    <p className="text-xs text-white/60 mt-1">Radnim danima 9-17h</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <MessageSquare className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="font-medium">Podrška</p>
                    <a
                      href={`mailto:${companyInfo.emailSupport}`}
                      className="text-sm text-cyan-400 hover:underline block"
                    >
                      {companyInfo.emailSupport}
                    </a>
                    <p className="text-xs text-white/60 mt-1">
                      Tehnički problemi, pomoć u aplikaciji
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Clock className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="font-medium">Vrijeme odgovora</p>
                    <p className="text-sm text-white/60">Unutar 24h radnim danima</p>
                    <p className="text-xs text-white/60 mt-1">
                      Hitni slučajevi:{" "}
                      <a
                        href={getPhoneLink(companyInfo.phoneEmergency)}
                        className="text-cyan-400 hover:underline"
                      >
                        {companyInfo.phoneEmergency}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Tvrtka</h2>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Naziv:</span> {companyInfo.name}
                </p>
                <p>
                  <span className="font-medium">OIB:</span> {companyInfo.oib}
                </p>
                <p>
                  <span className="font-medium">IBAN:</span> {companyInfo.iban} ({companyInfo.bank})
                </p>
                <p>
                  <span className="font-medium">VAT ID:</span> {companyInfo.vatId}
                </p>
                <p className="text-white/60 mt-2">
                  Registrirana u Sudskom registru Republike Hrvatske
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Zahtjev za demo</h2>
              <p className="text-sm text-white/60 mb-4">
                Zatražite personalizirani demo koji pokazuje kako FiskAI može ubrzati vaše
                računovodstvo.
              </p>
              <ContactForm />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <h2 className="text-xl font-semibold mb-2">Već imate račun?</h2>
              <p className="text-sm text-white/60 mb-4">
                Prijavite se u aplikaciju ili koristite in-app podršku za tehnička pitanja.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/login"
                  className="flex-1 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-center text-sm font-medium hover:bg-white/10"
                >
                  Prijava
                </Link>
                <Link
                  href="/register"
                  className="flex-1 rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  Besplatna registracija
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Phone className="h-5 w-5 text-red-700" />
            Hitna podrška
          </h3>
          <p className="text-sm text-white/60 mb-3">
            Ako imate kritičan problem koji sprečava korištenje aplikacije (npr. ne možete izdati
            račun):
          </p>
          <div className="flex items-center gap-4">
            <a
              href={getPhoneLink(companyInfo.phoneEmergency)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-white/95 border border-red-200"
            >
              <Phone className="h-4 w-4" />
              {companyInfo.phoneEmergency}
            </a>
            <span className="text-xs text-white/60">Radnim danima 9-17h, subota 10-14h</span>
          </div>
        </div>
      </div>
    </SectionBackground>
  )
}
