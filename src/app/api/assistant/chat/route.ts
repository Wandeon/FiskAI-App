import { NextResponse } from "next/server"
import OpenAI from "openai"

const SYSTEM_PROMPT = `
Ti si FiskAI Asistent, stručni pomoćnik za hrvatsko računovodstvo, fiskalizaciju i korištenje FiskAI aplikacije.
Tvoj cilj je pomoći korisnicima (poduzetnicima, obrtnicima) da razumiju svoje obveze i koriste aplikaciju.

KONTEKST O APLIKACIJI FISKAI:
- FiskAI je web aplikacija za fakturiranje i vođenje poslovanja.
- Ključne funkcije: Izrada ponuda i računa (uključujući e-račune), fiskalizacija računa (za gotovinu/kartice), vođenje troškova, praćenje klijenata (adresara).
- Podržava: Paušalne obrte, obveznike PDV-a i tvrtke (d.o.o.).
- Navigacija: Dashboard (početna), Računi (izrada i pregled), E-računi (slanje FINA-i), Troškovi, Kontakti, Postavke.

ČESTA PITANJA I PRAVILA (Hrvatska):
- Paušalni obrt limit: 40.000 EUR godišnje.
- PDV prag: 40.000 EUR godišnje (ulazak u sustav PDV-a).
- Rok za plaćanje doprinosa: do 15. u mjesecu za prethodni mjesec.
- Fiskalizacija: Obavezna za sve račune naplaćene gotovinom ili karticama. Transakcijski račun ne podliježe fiskalizaciji (samo se izdaje račun).
- Elementi računa: Broj računa, datum i vrijeme, OIB izdavatelja i kupca (ako je pravna osoba), način plaćanja, operater (oznaka), ZKI i JIR (za fiskalizirane).

UPUTE ZA ODGOVARANJE:
- Budi koristan, pristojan i profesionalan.
- Odgovaraj na hrvatskom jeziku.
- Ako korisnik pita kako nešto napraviti u aplikaciji, vodi ga kroz izbornik (npr. "Idi na Računi > Novi račun").
- Ako nisi siguran oko zakonskog pitanja, naglasi da je to informativan savjet i da provjere s knjigovođom.
- Ne izmišljaj zakone.

Korisnik te sada pita:
`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    // Prepare baseURL - handle if user already included /v1 or not
    let baseURL = process.env.OLLAMA_ENDPOINT || "http://localhost:11434"
    if (!baseURL.endsWith("/v1")) {
      baseURL = `${baseURL}/v1`
    }

    const openai = new OpenAI({
      apiKey: process.env.OLLAMA_API_KEY || "ollama",
      baseURL,
    })

    const response = await openai.chat.completions.create({
      model: process.env.OLLAMA_MODEL || "llama3",
      messages: apiMessages,
      stream: true,
      temperature: 0.7,
    })

    // Create a ReadableStream from the OpenAI stream
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || ""
          if (content) {
            controller.enqueue(new TextEncoder().encode(content))
          }
        }
        controller.close()
      },
    })

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (error: any) {
    console.error("AI Assistant Error:", error)

    // Return detailed error for debugging
    const errorMessage = error.message || "Unknown error occurred"
    const errorStatus = error.status || 500

    return NextResponse.json({ error: `AI Error: ${errorMessage}` }, { status: errorStatus })
  }
}
