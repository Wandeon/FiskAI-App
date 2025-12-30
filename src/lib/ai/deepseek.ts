const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

type Message =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user"
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: string } }
      >
    }

interface DeepseekResponse {
  choices: Array<{
    message: { content?: string }
  }>
}

async function requestDeepseek(body: Record<string, unknown>) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("AI features temporarily unavailable")
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Deepseek API error (${res.status}): ${text}`)
  }

  const json = (await res.json()) as DeepseekResponse
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("Deepseek API returned empty content")
  }
  return content
}

export async function deepseekJson({
  model = "deepseek-chat",
  messages,
  response_format = { type: "json_object" },
}: {
  model?: string
  messages: Message[]
  response_format?: { type: "json_object" }
}) {
  return requestDeepseek({
    model,
    messages,
    response_format,
  })
}

export async function deepseekVisionJson({
  model = "deepseek-chat",
  messages,
}: {
  model?: string
  messages: Message[]
}) {
  return requestDeepseek({
    model,
    messages,
    response_format: { type: "json_object" },
  })
}
