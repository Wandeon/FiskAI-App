import type { Metadata } from "next"
import Link from "next/link"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Uvjeti korištenja",
  description: "Uvjeti korištenja za FiskAI - prava i obveze korisnika i pružatelja usluge.",
  alternates: {
    canonical: `${BASE_URL}/terms`,
  },
}

export default function TermsPage() {
  return (
    <SectionBackground variant="dark" showOrbs={false}>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold">Uvjeti korištenja</h1>
        <p className="mt-4 text-sm text-white/60">
          Zadnja izmjena:{" "}
          {new Date().toLocaleDateString("hr-HR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <div className="mt-8 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm">
          <p>
            Korištenjem usluge FiskAI prihvaćate ove uvjete korištenja. Molimo pažljivo pročitajte
            prije registracije. Ako se ne slažete s uvjetima, ne smijete koristiti uslugu.
          </p>
        </div>

        <h2 className="text-display mt-10 text-2xl font-semibold">1. Definicije</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>&quot;Usluga&quot;</strong> - FiskAI web aplikacija dostupna na fiskai.app
          </li>
          <li>
            <strong>&quot;Mi&quot;, &quot;nas&quot;, &quot;FiskAI&quot;</strong> - FiskAI d.o.o.,
            pružatelj usluge
          </li>
          <li>
            <strong>&quot;Korisnik&quot;, &quot;vi&quot;</strong> - fizička ili pravna osoba koja
            koristi uslugu
          </li>
          <li>
            <strong>&quot;Račun&quot;</strong> - korisnički račun kreiran registracijom
          </li>
          <li>
            <strong>&quot;Sadržaj&quot;</strong> - svi podaci, dokumenti i informacije koje unesete
            u uslugu
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">2. Opis usluge</h2>
        <p className="mt-3 text-sm text-white/60">
          FiskAI je softver za fakturiranje i vođenje poslovanja namijenjen hrvatskim poduzetnicima.
          Usluga uključuje:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Kreiranje i slanje računa, ponuda i predračuna</li>
          <li>Fiskalizaciju računa putem Porezne uprave (gdje je primjenjivo)</li>
          <li>Praćenje troškova i skeniranje računa (OCR)</li>
          <li>Generiranje izvještaja i izvoz podataka</li>
          <li>AI-potpomognute funkcije (opcionalno)</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">3. Registracija i račun</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Za korištenje usluge potrebna je registracija s valjanom email adresom</li>
          <li>Morate imati najmanje 18 godina ili pravnu sposobnost za sklapanje ugovora</li>
          <li>Odgovorni ste za sigurnost svoje lozinke i pristupnih podataka</li>
          <li>Podaci o tvrtki (OIB, naziv) moraju biti točni i ažurirani</li>
          <li>Jedan OIB može imati samo jedan aktivni račun</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">4. Pretplata i plaćanje</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Probno razdoblje:</strong> 14 dana besplatnog korištenja bez obveze
          </li>
          <li>
            <strong>Naplata:</strong> mjesečna pretplata, naplata unaprijed
          </li>
          <li>
            <strong>Cijene:</strong> aktualne cijene prikazane su na{" "}
            <Link href="/pricing" className="text-cyan-400 hover:underline">
              stranici cijena
            </Link>
          </li>
          <li>
            <strong>PDV:</strong> cijene ne uključuju PDV za hrvatske tvrtke
          </li>
          <li>
            <strong>Otkazivanje:</strong> možete otkazati bilo kada, pristup ostaje do kraja
            plaćenog razdoblja
          </li>
          <li>
            <strong>Povrat:</strong> nema automatskog povrata za djelomično korišteno razdoblje
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">5. Limiti korištenja</h2>
        <p className="mt-3 text-sm text-white/60">
          Svaki plan ima definirane limite (broj računa mjesečno, broj korisnika, itd.). Limiti su
          prikazani na stranici cijena. Prekoračenje limita može rezultirati:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Dodatnom naplatom po definiranoj tarifi</li>
          <li>Ograničenjem funkcionalnosti dok ne nadogradite plan</li>
          <li>Obavijesti o potrebi nadogradnje</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">6. Vaše obveze</h2>
        <p className="mt-3 text-sm text-white/60">Kao korisnik obvezujete se:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Koristiti uslugu u skladu s hrvatskim zakonima i propisima</li>
          <li>Unositi točne i istinite podatke o tvrtki i transakcijama</li>
          <li>Pregledati i potvrditi ispravnost AI-generiranih prijedloga</li>
          <li>Čuvati pristupne podatke i ne dijeliti ih s neovlaštenim osobama</li>
          <li>Ne koristiti uslugu za nezakonite aktivnosti</li>
          <li>Obavijestiti nas o sigurnosnim incidentima vezanim uz vaš račun</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">7. AI i automatizacija</h2>
        <p className="mt-3 text-sm text-white/60">
          FiskAI koristi umjetnu inteligenciju za pomoć pri unosu podataka. Važno je razumjeti:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            AI prijedlozi su <strong>samo prijedlozi</strong> - vi donosite konačnu odluku
          </li>
          <li>AI može pogriješiti - uvijek provjerite prijedloge prije potvrde</li>
          <li>AI funkcije su opcionalne i možete ih onemogućiti</li>
          <li>Vi ste odgovorni za konačne podatke u vašim dokumentima</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">
          8. Fiskalizacija i regulatorne obveze
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>FiskAI omogućuje fiskalizaciju računa putem Porezne uprave</li>
          <li>Vi ste odgovorni za ispravnost podataka poslanih na fiskalizaciju</li>
          <li>FiskAI ne zamjenjuje knjigovođu - za porezne obveze konzultirajte stručnjaka</li>
          <li>Arhivirani fiskalizirani računi čuvaju se 11 godina (zakonska obveza)</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">9. Vlasništvo nad sadržajem</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Vi zadržavate vlasništvo nad svim podacima koje unesete</li>
          <li>Dajete nam licencu za obradu podataka radi pružanja usluge</li>
          <li>Možete izvesti svoje podatke u bilo kojem trenutku</li>
          <li>FiskAI ne preuzima vlasništvo niti prava na vaše poslovne podatke</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">10. Dostupnost i SLA</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Ciljna dostupnost: 99.5% mjesečno</li>
          <li>Planirano održavanje najavit ćemo unaprijed (min. 24h)</li>
          <li>U slučaju nedostupnosti, prioritet je sigurnost i integritet podataka</li>
          <li>
            Status sustava dostupan na{" "}
            <Link href="/status" className="text-cyan-400 hover:underline">
              /status
            </Link>
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">11. Ograničenje odgovornosti</h2>
        <p className="mt-3 text-sm text-white/60">U maksimalnom opsegu dopuštenom zakonom:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Usluga se pruža &quot;kakva jest&quot; bez garancija bilo koje vrste</li>
          <li>Ne odgovaramo za indirektne, posljedične ili kaznene štete</li>
          <li>Naša maksimalna odgovornost ograničena je na iznos pretplate u zadnjih 12 mjeseci</li>
          <li>Ne odgovaramo za gubitak podataka uzrokovan vašom nepažnjom</li>
          <li>Ne odgovaramo za porezne ili pravne posljedice vaših odluka</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">12. Prekid ugovora</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Vi možete:</strong> otkazati pretplatu bilo kada putem postavki računa
          </li>
          <li>
            <strong>Mi možemo:</strong> suspendirati ili ukinuti račun zbog kršenja uvjeta,
            neplaćanja ili nezakonitih aktivnosti
          </li>
          <li>
            <strong>Nakon prekida:</strong> imat ćete 30 dana za izvoz podataka, nakon čega će biti
            obrisani (osim zakonski obveznih)
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">13. Izmjene uvjeta</h2>
        <p className="mt-3 text-sm text-white/60">
          Možemo izmijeniti ove uvjete uz prethodnu obavijest od najmanje 30 dana. O značajnim
          promjenama obavijestit ćemo vas emailom. Nastavak korištenja nakon stupanja izmjena na
          snagu smatra se prihvaćanjem novih uvjeta.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">
          14. Mjerodavno pravo i sporovi
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Na ove uvjete primjenjuje se hrvatsko pravo</li>
          <li>Sporove ćemo pokušati riješiti mirnim putem</li>
          <li>Za sporove je nadležan sud u Zagrebu</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">15. Kontakt</h2>
        <div className="mt-3 text-sm text-white/60">
          <p>
            <strong>FiskAI d.o.o.</strong>
          </p>
          <p>
            Email:{" "}
            <a href="mailto:info@fiskai.hr" className="text-cyan-400 hover:underline">
              info@fiskai.hr
            </a>
          </p>
          <p>
            Podrška:{" "}
            <a href="mailto:podrska@fiskai.hr" className="text-cyan-400 hover:underline">
              podrska@fiskai.hr
            </a>
          </p>
          <p>Adresa: [Adresa tvrtke], Zagreb, Hrvatska</p>
        </div>

        <div className="mt-12 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <p className="text-sm text-white/60">
            <strong>Povezane politike:</strong>{" "}
            <Link href="/privacy" className="text-cyan-400 hover:underline">
              Politika privatnosti
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
