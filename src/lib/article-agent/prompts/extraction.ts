// src/lib/article-agent/prompts/extraction.ts

export const CLAIM_EXTRACTION_SYSTEM = `Ti si stručnjak za ekstrakciju činjenica iz izvora. Tvoj zadatak je identificirati atomske, provjerljive tvrdnje iz teksta. Budi precizan i ekstragiraj samo ono što je eksplicitno navedeno u tekstu.`

export const CLAIM_EXTRACTION_PROMPT = `Ekstrahiraj atomske činjenične tvrdnje iz ovog teksta izvora.

PRAVILA:
1. Svaka tvrdnja mora biti nezavisno provjerljiva
2. Uključi točan citat koji podržava svaku tvrdnju
3. Kategoriziraj: deadline (rok), amount (iznos), requirement (zahtjev), entity (entitet), general (opće)
4. Ocijeni pouzdanost ekstrakcije 0.0-1.0

IZVOR URL: {url}
TEKST:
{content}

Vrati JSON niz:
[
  {
    "statement": "Jasna, atomska tvrdnja na hrvatskom",
    "quote": "Točan citat iz teksta koji podržava tvrdnju",
    "category": "deadline|amount|requirement|entity|general",
    "confidence": 0.95
  }
]

VAŽNO: Vrati SAMO JSON niz, bez dodatnog teksta.`

export const KEY_ENTITIES_PROMPT = `Identificiraj ključne entitete iz ovih tvrdnji.

TVRDNJE:
{claims}

Ekstrahiraj i kategoriziraj entitete:

Vrati JSON:
{
  "names": ["imena osoba, organizacija, tvrtki"],
  "dates": ["datumi, rokovi, periodi"],
  "amounts": ["iznosi, postoci, pragovi"],
  "regulations": ["zakoni, pravilnici, službeni dokumenti"]
}

VAŽNO: Vrati SAMO JSON objekt, bez dodatnog teksta.`
