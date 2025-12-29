import type { Metadata } from "next"
import Link from "next/link"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Politika privatnosti",
  description:
    "Politika privatnosti za FiskAI - kako prikupljamo, koristimo i štitimo vaše podatke.",
  alternates: {
    canonical: `${BASE_URL}/privacy`,
  },
}

export default function PrivacyPage() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold">Politika privatnosti</h1>
        <p className="mt-4 text-sm text-white/60">
          Zadnja izmjena:{" "}
          {new Date().toLocaleDateString("hr-HR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <div className="mt-8 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 text-sm">
          <p>
            FiskAI d.o.o. (&quot;mi&quot;, &quot;nas&quot;, &quot;FiskAI&quot;) je voditelj obrade
            vaših osobnih podataka. Ova politika privatnosti objašnjava kako prikupljamo, koristimo,
            dijelimo i štitimo vaše podatke kada koristite našu uslugu na fiskai.app.
          </p>
        </div>

        <h2 className="text-display mt-10 text-2xl font-semibold">1. Koje podatke prikupljamo</h2>

        <h3 className="mt-6 text-lg font-semibold">Podaci koje nam dajete direktno</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Podaci o računu:</strong> ime, prezime, email adresa, lozinka (hashirana)
          </li>
          <li>
            <strong>Podaci o tvrtki:</strong> naziv, OIB, adresa, kontakt podaci, IBAN
          </li>
          <li>
            <strong>Poslovni dokumenti:</strong> računi, troškovi, kontakti kupaca/dobavljača koje
            kreirate ili učitavate
          </li>
          <li>
            <strong>Komunikacija:</strong> poruke koje nam šaljete putem podrške ili kontakt
            obrazaca
          </li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">Podaci koje prikupljamo automatski</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Podaci o korištenju:</strong> vrijeme pristupa, stranice koje posjetite, akcije
            koje izvršite
          </li>
          <li>
            <strong>Tehnički podaci:</strong> IP adresa, vrsta preglednika, operativni sustav,
            uređaj
          </li>
          <li>
            <strong>Kolačići:</strong> funkcionalni kolačići potrebni za rad aplikacije (detalji u{" "}
            <Link href="/cookies" className="text-cyan-400 hover:underline">
              politici kolačića
            </Link>
            )
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">
          2. Kako koristimo vaše podatke
        </h2>
        <p className="mt-3 text-sm text-white/60">Vaše podatke koristimo za sljedeće svrhe:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Pružanje usluge:</strong> kreiranje računa, fiskalizacija, obrada troškova,
            generiranje izvještaja
          </li>
          <li>
            <strong>Komunikacija:</strong> slanje obavijesti o računu, novostima, tehničkim
            problemima
          </li>
          <li>
            <strong>Poboljšanje usluge:</strong> analiza korištenja radi unapređenja korisničkog
            iskustva
          </li>
          <li>
            <strong>Pravne obveze:</strong> ispunjavanje zakonskih zahtjeva (npr. fiskalizacija,
            arhiviranje računa)
          </li>
          <li>
            <strong>Sigurnost:</strong> sprječavanje prijevara, zaštita sustava od zlouporabe
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">3. AI i OCR obrada</h2>
        <p className="mt-3 text-sm text-white/60">
          FiskAI koristi umjetnu inteligenciju za automatsku obradu dokumenata (OCR skeniranje
          računa, kategorizacija troškova). Ova obrada je <strong>opcionalna</strong> i možete je
          onemogućiti u postavkama.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>AI obrada se vrši putem EU-baziranih pružatelja usluga (OpenAI API, EU regija)</li>
          <li>
            Vaši podaci se <strong>ne koriste za treniranje AI modela</strong> bez vašeg
            eksplicitnog pristanka
          </li>
          <li>AI prijedlozi su uvijek prikazani kao prijedlozi - vi donosite konačnu odluku</li>
          <li>
            Detalji o AI obradi dostupni su u našoj{" "}
            <Link href="/ai-data-policy" className="text-cyan-400 hover:underline">
              AI politici podataka
            </Link>
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">4. Dijeljenje podataka</h2>
        <p className="mt-3 text-sm text-white/60">
          Vaše podatke ne prodajemo niti dijelimo s trećim stranama za marketinške svrhe. Podatke
          možemo dijeliti samo u sljedećim situacijama:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Pružatelji infrastrukture:</strong> hosting (AWS EU), baza podataka, email
            dostavljivost (Resend)
          </li>
          <li>
            <strong>Procesuiranje plaćanja:</strong> Stripe za obradu pretplata (ne pohranjujemo
            podatke o karticama)
          </li>
          <li>
            <strong>Državna tijela:</strong> Porezna uprava za fiskalizaciju (zakonska obveza)
          </li>
          <li>
            <strong>Pravne obveze:</strong> kada to zahtijeva sud ili nadležno tijelo
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">
          5. Pohrana i sigurnost podataka
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Lokacija:</strong> svi podaci pohranjeni su u EU (Njemačka, AWS eu-central-1)
          </li>
          <li>
            <strong>Enkripcija:</strong> podaci su šifrirani u mirovanju (AES-256) i u prijenosu
            (TLS 1.3)
          </li>
          <li>
            <strong>Backupi:</strong> dnevni backupi s 30-dnevnom retencijom, pohranjeni u EU
          </li>
          <li>
            <strong>Pristup:</strong> stroga kontrola pristupa, minimalni privilegiji, audit tragovi
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">6. Čuvanje podataka</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Podaci o računu:</strong> dok je račun aktivan + 30 dana nakon zatvaranja
          </li>
          <li>
            <strong>Poslovni dokumenti:</strong> dok ih ne obrišete ili zatvorite račun
          </li>
          <li>
            <strong>Fiskalizirani računi:</strong> 11 godina (zakonska obveza čuvanja u Hrvatskoj)
          </li>
          <li>
            <strong>Logovi:</strong> 90 dana za sigurnosne logove, 30 dana za analitiku
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">7. Vaša prava (GDPR)</h2>
        <p className="mt-3 text-sm text-white/60">Kao ispitanik u EU imate sljedeća prava:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Pravo pristupa:</strong> zatražite kopiju svih vaših podataka
          </li>
          <li>
            <strong>Pravo na ispravak:</strong> ispravite netočne podatke
          </li>
          <li>
            <strong>Pravo na brisanje:</strong> zatražite brisanje podataka (uz zakonske iznimke)
          </li>
          <li>
            <strong>Pravo na prijenos:</strong> preuzmite podatke u strojno čitljivom formatu
            (CSV/JSON)
          </li>
          <li>
            <strong>Pravo na ograničenje obrade:</strong> ograničite kako koristimo vaše podatke
          </li>
          <li>
            <strong>Pravo na prigovor:</strong> prigovorite određenim vrstama obrade
          </li>
        </ul>
        <p className="mt-4 text-sm text-white/60">
          Za ostvarivanje prava kontaktirajte nas na{" "}
          <a href="mailto:gdpr@fiskai.hr" className="text-cyan-400 hover:underline">
            gdpr@fiskai.hr
          </a>
          . Odgovorit ćemo unutar 30 dana.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">8. Kolačići</h2>
        <p className="mt-3 text-sm text-white/60">
          Koristimo samo nužne funkcionalne kolačiće potrebne za rad aplikacije (sesija,
          autentikacija). Ne koristimo marketinške ili analitičke kolačiće treće strane. Detalji su
          dostupni u{" "}
          <Link href="/cookies" className="text-cyan-400 hover:underline">
            politici kolačića
          </Link>
          .
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">9. Izmjene politike</h2>
        <p className="mt-3 text-sm text-white/60">
          Možemo povremeno ažurirati ovu politiku privatnosti. O značajnim promjenama obavijestit
          ćemo vas putem emaila ili obavijesti u aplikaciji najmanje 30 dana prije stupanja na
          snagu.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">10. Kontakt</h2>
        <div className="mt-3 text-sm text-white/60">
          <p>
            <strong>FiskAI d.o.o.</strong>
          </p>
          <p>Voditelj obrade osobnih podataka</p>
          <p className="mt-2">
            Email:{" "}
            <a href="mailto:gdpr@fiskai.hr" className="text-cyan-400 hover:underline">
              gdpr@fiskai.hr
            </a>
          </p>
          <p>Adresa: [Adresa tvrtke], Zagreb, Hrvatska</p>
          <p className="mt-4">
            Ako smatrate da smo prekršili vaša prava, možete podnijeti pritužbu Agenciji za zaštitu
            osobnih podataka (AZOP):{" "}
            <a
              href="https://azop.hr"
              className="text-cyan-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              azop.hr
            </a>
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-white/60">
            <strong>Povezane politike:</strong>{" "}
            <Link href="/terms" className="text-cyan-400 hover:underline">
              Uvjeti korištenja
            </Link>{" "}
            •
            <Link href="/cookies" className="text-cyan-400 hover:underline ml-2">
              Politika kolačića
            </Link>{" "}
            •
            <Link href="/ai-data-policy" className="text-cyan-400 hover:underline ml-2">
              AI politika
            </Link>{" "}
            •
            <Link href="/dpa" className="text-cyan-400 hover:underline ml-2">
              DPA
            </Link>{" "}
            •
            <Link href="/security" className="text-cyan-400 hover:underline ml-2">
              Sigurnost
            </Link>
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
