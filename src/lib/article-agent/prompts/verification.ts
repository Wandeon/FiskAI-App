// src/lib/article-agent/prompts/verification.ts

export const CLASSIFICATION_SYSTEM = `Ti si stručnjak za provjeru činjenica. Budi precizan i objektivan. Analiziraj odnos između dokaza iz izvora i sadržaja paragrafa.`

export const CLASSIFICATION_PROMPT = `Analiziraj podržava li IZVOR DOKAZ ovaj PARAGRAF iz članka.

PARAGRAF (iz nacrta članka):
{paragraph}

IZVOR DOKAZ (iz originalnog izvora):
{evidence}

Klasificiraj odnos kao JEDNO od:
- SUPPORTED: Dokaz izravno podržava tvrdnje paragrafa
- PARTIALLY_SUPPORTED: Dokaz podržava neke ali ne sve tvrdnje
- NOT_SUPPORTED: Dokaz ne adresira tvrdnje paragrafa
- CONTRADICTED: Dokaz proturiječi tvrdnjama paragrafa

Vrati JSON:
{
  "relationship": "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "CONTRADICTED",
  "confidence": 0.0-1.0,
  "explanation": "Kratko obrazloženje na hrvatskom"
}

VAŽNO: Vrati SAMO JSON objekt.`
