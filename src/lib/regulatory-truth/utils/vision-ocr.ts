// src/lib/regulatory-truth/utils/vision-ocr.ts
// Vision model fallback for low-confidence OCR pages

export interface VisionOcrResult {
  text: string
  confidence: number
}

const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "llama3.2-vision"
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434"
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY

const VISION_PROMPT = `You are an OCR assistant. Extract ALL text from this scanned document image.

Rules:
- Output ONLY the extracted text, no explanations or commentary
- Preserve original formatting (paragraphs, lists, tables)
- For tables, use | separators between columns
- Keep Croatian characters exactly as shown (č, ć, đ, š, ž, Č, Ć, Đ, Š, Ž)
- If text is unclear or illegible, use [nejasno] placeholder
- Do not translate, interpret, or summarize - just transcribe exactly what you see
- Maintain the original reading order (top to bottom, left to right)

Extract the text now:`

export async function runVisionOcr(imageBuffer: Buffer): Promise<VisionOcrResult> {
  const base64Image = imageBuffer.toString("base64")

  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OLLAMA_API_KEY && { Authorization: `Bearer ${OLLAMA_API_KEY}` }),
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: VISION_PROMPT,
            images: [base64Image],
          },
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 4096,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.message?.content?.trim() || ""
    const confidence = estimateVisionConfidence(text)

    console.log(
      `[vision-ocr] Extracted ${text.length} chars, confidence: ${confidence.toFixed(1)}%`
    )

    return { text, confidence }
  } catch (error) {
    console.error("[vision-ocr] Failed:", error)
    throw error
  }
}

function estimateVisionConfidence(text: string): number {
  if (!text || text.length < 10) return 0

  let confidence = 85

  const unclearCount = (text.match(/\[nejasno\]/gi) || []).length
  const totalWords = text.split(/\s+/).length
  const unclearRatio = unclearCount / Math.max(totalWords, 1)
  confidence -= unclearRatio * 40

  const validChars = text.match(/[\w\s\u0100-\u017Fčćđšž.,;:!?()\-"'\/\[\]|]/gi) || []
  const garbageRatio = 1 - validChars.length / text.length
  confidence -= garbageRatio * 50

  if (text.length < 50) confidence -= 20

  return Math.max(0, Math.min(100, confidence))
}

export async function isVisionModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, {
      headers: OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {},
    })
    if (!response.ok) return false

    const data = await response.json()
    const models = data.models?.map((m: { name: string }) => m.name) || []
    return models.some((m: string) => m.includes("vision") || m.includes("llava"))
  } catch {
    return false
  }
}
