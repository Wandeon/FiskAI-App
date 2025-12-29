import { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Urednička politika | FiskAI",
  description: "Kako FiskAI održava točnost sadržaja, učestalost pregleda i proces ispravaka.",
  alternates: {
    canonical: `${BASE_URL}/urednicka-politika`,
  },
}

export default function UrednickaPoltikaPage() {
  return (
    <SectionBackground variant="dark" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-8 text-4xl font-bold text-white">Urednička politika</h1>

        <div className="prose prose-invert max-w-none">
          <p className="lead">
            FiskAI je posvećen pružanju točnih, ažurnih i pouzdanih informacija za hrvatske
            poduzetnike.
          </p>

          <h2>Učestalost pregleda</h2>
          <ul>
            <li>
              <strong>Hub stranice:</strong> Kvartalni pregled
            </li>
            <li>
              <strong>Satelitske stranice:</strong> Godišnji pregled
            </li>
            <li>
              <strong>Kalkulatori:</strong> Pregled pri svakoj promjeni propisa
            </li>
            <li>
              <strong>Rokovi:</strong> Mjesečno ažuriranje
            </li>
          </ul>

          <h2>Okidači za ažuriranje</h2>
          <p>Sadržaj se odmah ažurira kada:</p>
          <ul>
            <li>Narodne novine objave nove ili izmijenjene propise</li>
            <li>Porezna uprava objavi nove upute ili tumačenja</li>
            <li>Promijene se porezne stope ili pragovi</li>
            <li>Korisnik prijavi netočnost</li>
          </ul>

          <h2>Proces ispravaka</h2>
          <ol>
            <li>Korisnik ili tim identificira grešku</li>
            <li>Verificira se prema službenom izvoru</li>
            <li>Ispravak se objavljuje unutar 24 sata</li>
            <li>Značajne izmjene bilježe se u &ldquo;Što se promijenilo&rdquo;</li>
          </ol>

          <h2>Recenzenti</h2>
          <p>
            Sadržaj pregledavaju stručnjaci s relevantnim iskustvom u poreznom savjetovanju i
            računovodstvu. Svaka stranica navodi recenzenta.
          </p>

          <h2>Prijavite grešku</h2>
          <p>
            Uočili ste netočnost? Javite nam na{" "}
            <a href="mailto:info@fisk.ai" className="text-cyan-400">
              info@fisk.ai
            </a>{" "}
            ili putem kontakt obrasca.
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
