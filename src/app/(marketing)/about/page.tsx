import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { FadeIn } from "@/components/ui/motion/FadeIn"

export const metadata: Metadata = {
  title: "FiskAI — O nama",
  description: "Saznajte više o FiskAI platformi: naša misija, vrijednosti i zašto nas odabrati za vaše računovodstvo.",
}

export default function AboutPage() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <FadeIn>
          <h1 className="text-display text-4xl font-semibold">O nama</h1>
          <p className="mt-4 text-sm text-white/60">
            FiskAI je AI-first platforma za računovodstvo i ERP u nastajanju, fokusirana na hrvatsko
            tržište i nadolazeće zahtjeve (npr. Fiskalizacija 2.0).
          </p>
        </FadeIn>

        <h2 className="text-display mt-12 text-2xl font-semibold">Naša priča</h2>
        <div className="mt-4 space-y-4 text-sm text-white/60">
          <p>
            FiskAI nastaje iz duboke potrebe hrvatskih malih poduzetnika za pristupačnim, brzim i pouzdanim
            računovodstvenim rješenjem koje razumije specifičnosti lokalnog tržišta.
          </p>
          <p>
            Dok su globalne platforme često prekomplicirane ili ne poštuju hrvatske propise, a lokalna rješenja
            zastarjela i spora, mi gradimo most između moderne tehnologije i hrvatskih regulatornih zahtjeva.
            Koristimo umjetnu inteligenciju da automatiziramo dosadne zadatke, ali uz transparentnost i potpunu
            kontrolu korisnika nad svojim podacima.
          </p>
          <p>
            Naša vizija je platforma koja raste s vašim poslom - od jednostavnog paušalnog obrta do kompleksnog
            d.o.o., s modulima koje možete uključivati prema potrebi. Bez skrivenih troškova, bez prisile na
            &quot;upgrade&quot;, samo alat koji vam omogućava da se fokusirate na ono što radite najbolje.
          </p>
        </div>

        <h2 className="text-display mt-12 text-2xl font-semibold">Misija</h2>
        <p className="mt-3 text-sm text-white/60">
          Smanjiti administraciju i greške kroz automatizaciju, a da kontrola uvijek ostane kod
          klijenta: jasni izvještaji, audit trag i izvozi.
        </p>

        <h2 className="text-display mt-12 text-2xl font-semibold">Naše vrijednosti</h2>
        <ul className="mt-4 space-y-3">
          <li className="rounded-lg bg-white/5 px-5 py-4">
            <h3 className="text-display text-base font-semibold">Jednostavnost</h3>
            <p className="mt-2 text-sm text-white/60">
              Računovodstvo ne mora biti komplicirano. Dizajniramo sučelje koje razumije svaki poduzetnik,
              bez obzira na tehničko znanje. Kreni s osnovama, nadograđuj prema potrebi.
            </p>
          </li>
          <li className="rounded-lg bg-white/5 px-5 py-4">
            <h3 className="text-display text-base font-semibold">Automatizacija</h3>
            <p className="mt-2 text-sm text-white/60">
              AI asistent čita račune, predlaže knjiženja i prati rokove - vi samo potvrdite.
              Automatizacija štedi vrijeme, ali odluke ostaju kod vas. Bez &quot;skrivenih&quot; promjena.
            </p>
          </li>
          <li className="rounded-lg bg-white/5 px-5 py-4">
            <h3 className="text-display text-base font-semibold">Usklađenost</h3>
            <p className="mt-2 text-sm text-white/60">
              Gradimo platformu uz hrvatski regulatorni okvir - Fiskalizacija 2.0, e-računi, PDV, doprinosi.
              Automatski prati zakonske izmjene i upozorava na rokove. Compliance nije opcija, to je temelj.
            </p>
          </li>
          <li className="rounded-lg bg-white/5 px-5 py-4">
            <h3 className="text-display text-base font-semibold">Transparentnost</h3>
            <p className="mt-2 text-sm text-white/60">
              Vaši podaci su vaši. Izvoz u standardnim formatima (Excel, PDF, XML) u bilo kojem trenutku.
              Puni audit trag svih promjena. Bez vendor lock-in efekta.
            </p>
          </li>
        </ul>

        <h2 className="text-display mt-12 text-2xl font-semibold">Zašto FiskAI?</h2>
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                ✓
              </div>
              <div>
                <h3 className="text-display text-sm font-semibold">Prilagođeno hrvatskom tržištu</h3>
                <p className="mt-1 text-sm text-white/60">
                  Razumijemo specifičnosti paušalnih obrta, d.o.o., PDV-a, doprinosa i svih hrvatskih obveza.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                ✓
              </div>
              <div>
                <h3 className="text-display text-sm font-semibold">AI asistent koji štedi vrijeme</h3>
                <p className="mt-1 text-sm text-white/60">
                  Automatsko OCR čitanje računa, predlaganje knjiženja, praćenje rokova - oslobađa vam sate tjedno.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                ✓
              </div>
              <div>
                <h3 className="text-display text-sm font-semibold">Modularni pristup</h3>
                <p className="mt-1 text-sm text-white/60">
                  Plaćate samo module koje koristite. Kreni s fakturiranjem, dodaj PDV kad izrasteš - bez prisile.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                ✓
              </div>
              <div>
                <h3 className="text-display text-sm font-semibold">Spremni za budućnost</h3>
                <p className="mt-1 text-sm text-white/60">
                  Fiskalizacija 2.0, e-računi, API integracije - implementiramo nove zahtjeve automatski.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                ✓
              </div>
              <div>
                <h3 className="text-display text-sm font-semibold">Puna kontrola nad podacima</h3>
                <p className="mt-1 text-sm text-white/60">
                  Izvoz u svim formatima (Excel, PDF, XML), potpuni audit trag, bez vendor lock-in efekta.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg border border-primary/30 bg-primary/5 px-6 py-5">
          <h3 className="text-display text-base font-semibold">Platforma u razvoju</h3>
          <p className="mt-2 text-sm text-white/60">
            FiskAI je u beta fazi - aktivno slušamo feedback naših korisnika i kontinuirano nadograđujemo
            platformu. Svaki modul testiramo uz stvarne poduzetnike i računovođe, da bi finalni proizvod
            stvarno odgovarao potrebama hrvatskog tržišta.
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
