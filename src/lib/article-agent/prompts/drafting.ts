// src/lib/article-agent/prompts/drafting.ts

import type { ArticleType } from "@prisma/client"

export const DRAFTING_SYSTEM = `Ti si urednik FiskAI portala za hrvatske poduzetnike i računovođe. Pišeš jasno, konkretno i bez floskula. Ne izmišljaš činjenice - koristiš ISKLJUČIVO informacije iz dostavljenog fact sheeta.`

export const DRAFTING_PROMPTS: Record<ArticleType, string> = {
  NEWS: `Napiši članak za FiskAI vijesti koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

IZVORI:
{sources}

PRAVILA:
1. NE IZMIŠLJAJ činjenice - koristi samo gore navedene tvrdnje
2. Svaki paragraf mora biti potkrijepljen barem jednom tvrdnjom
3. Ako nešto nije u fact sheetu, NE SPOMINJI to
4. Bez generičkih uvoda i fraza
5. Za svaku činjenicu iz izvora dodaj inline oznaku [^N] gdje je N broj izvora

STRUKTURA:
- **TL;DR** (3 kratke stavke)
- **Što se promijenilo**
- **Koga se tiče**
- **Rokovi** (ako postoje u fact sheetu)
- **Što trebate napraviti** (ako je primjenjivo)

Ton: Profesionalan ali pristupačan.
Duljina: 300-500 riječi.

Vrati članak u Markdown formatu.`,

  GUIDE: `Napiši vodič za FiskAI koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

IZVORI:
{sources}

PRAVILA:
1. NE IZMIŠLJAJ činjenice - koristi samo gore navedene tvrdnje
2. Svaki paragraf mora biti potkrijepljen barem jednom tvrdnjom
3. Strukturiraj vodič logično s jasnim naslovima
4. Bez generičkih uvoda i fraza
5. Za svaku činjenicu iz izvora dodaj inline oznaku [^N] gdje je N broj izvora

STRUKTURA:
- Uvod (1 paragraf)
- Glavne sekcije s H2 naslovima
- Praktični koraci gdje je primjenjivo
- Zaključak

Ton: Edukativan i pristupačan.
Duljina: 500-800 riječi.

Vrati vodič u Markdown formatu.`,

  HOWTO: `Napiši praktični vodič "Kako da..." za FiskAI koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

IZVORI:
{sources}

PRAVILA:
1. NE IZMIŠLJAJ činjenice - koristi samo gore navedene tvrdnje
2. Fokusiraj se na praktične korake
3. Koristi numerirane liste za korake
4. Za svaku činjenicu iz izvora dodaj inline oznaku [^N] gdje je N broj izvora

STRUKTURA:
- Kratki uvod (što ćete postići)
- Preduvjeti (ako postoje)
- Koraci (numerirani)
- Česti problemi (ako su u fact sheetu)

Ton: Praktičan i jasan.
Duljina: 300-500 riječi.

Vrati vodič u Markdown formatu.`,

  GLOSSARY: `Napiši definiciju pojma za FiskAI rječnik koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

IZVORI:
{sources}

PRAVILA:
1. NE IZMIŠLJAJ činjenice
2. Kratka, precizna definicija
3. Primjeri ako su dostupni u fact sheetu
4. Za svaku činjenicu iz izvora dodaj inline oznaku [^N] gdje je N broj izvora

STRUKTURA:
- Definicija (1-2 rečenice)
- Detaljnije objašnjenje
- Primjer primjene (ako postoji)

Ton: Enciklopedijski.
Duljina: 150-300 riječi.

Vrati definiciju u Markdown formatu.`,

  COMPARISON: `Napiši usporedbu opcija za FiskAI koristeći ISKLJUČIVO činjenice iz fact sheeta.

FACT SHEET:
Tema: {topic}
Ključni entiteti: {entities}

TVRDNJE (koristi samo ove):
{claims}

IZVORI:
{sources}

PRAVILA:
1. NE IZMIŠLJAJ činjenice
2. Objektivna usporedba
3. Koristi tablice gdje je prikladno
4. Za svaku činjenicu iz izvora dodaj inline oznaku [^N] gdje je N broj izvora

STRUKTURA:
- Uvod (što uspoređujemo)
- Ključne razlike (tablica)
- Prednosti i nedostaci svake opcije
- Preporuka (ako proizlazi iz činjenica)

Ton: Objektivan i informativan.
Duljina: 400-600 riječi.

Vrati usporedbu u Markdown formatu.`,
}
