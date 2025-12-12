import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "FiskAI — Kontakt",
  description: "Kontaktirajte FiskAI tim za demo i beta program.",
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
      <h1 className="text-display text-4xl font-semibold">Kontakt</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Želite demo, beta pristup ili imate pitanje o paušalnom obrtu / e-računima? Javite se.
      </p>

      <div className="mt-8 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm">
          Email:{" "}
          <a className="font-semibold text-blue-700 hover:underline" href="mailto:hello@metrica.hr">
            hello@metrica.hr
          </a>
        </p>
        <p className="text-sm text-[var(--muted)]">
          U poruci navedite: tip poslovanja (paušalni obrt / VAT / d.o.o.), broj računa mjesečno i želite li suradnju s knjigovođom.
        </p>
        <p className="text-sm">
          Već imate račun?{" "}
          <Link href="/login" className="font-semibold text-blue-700 hover:underline">
            Prijava
          </Link>
        </p>
      </div>
    </div>
  )
}

