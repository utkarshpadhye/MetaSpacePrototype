export type GeminiChatMessage = {
  role: 'user' | 'assistant' | 'system'
  text: string
}

export type GeminiSummary = {
  keyPoints: string[]
  actionItems: string[]
  decisions: string[]
}

type GeminiPart = {
  text?: string
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[]
    }
  }>
  error?: {
    message?: string
  }
}

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_ENDPOINT =
  import.meta.env.VITE_GEMINI_ENDPOINT ||
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export function hasGeminiApiKey() {
  return GEMINI_API_KEY.trim().length > 0
}

export function getGeminiProviderLabel() {
  return hasGeminiApiKey() ? `Gemini (${GEMINI_MODEL})` : 'Local fallback (Gemini key missing)'
}

function toGeminiRole(role: GeminiChatMessage['role']) {
  return role === 'assistant' ? 'model' : 'user'
}

async function requestGemini(prompt: string, history: GeminiChatMessage[] = []) {
  if (!hasGeminiApiKey()) {
    throw new Error('Missing VITE_GEMINI_API_KEY')
  }

  const systemParts = history
    .filter((message) => message.role === 'system')
    .map((message) => message.text.trim())
    .filter(Boolean)
  const conversation = history
    .filter((message) => message.role !== 'system' && message.text.trim())
    .map((message) => ({
      role: toGeminiRole(message.role),
      parts: [{ text: message.text }],
    }))

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction:
        systemParts.length > 0
          ? {
              parts: [{ text: systemParts.join('\n\n') }],
            }
          : undefined,
      contents: [...conversation, { role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 700,
      },
    }),
  })

  const payload = (await response.json()) as GeminiResponse
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini request failed: ${response.status}`)
  }

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? ''

  if (!text) {
    throw new Error('Gemini returned an empty response')
  }
  return text
}

export async function askGemini(
  prompt: string,
  history: GeminiChatMessage[] = [],
) {
  return requestGemini(prompt, history)
}

function parseJsonObject(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return null
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Partial<GeminiSummary>
  } catch {
    return null
  }
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => String(item).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5)
}

export async function summarizeMeetingWithGemini(transcript: string) {
  const prompt = `Summarize this meeting transcript for a project workspace.

Return only valid JSON with this exact shape:
{
  "keyPoints": ["..."],
  "actionItems": ["..."],
  "decisions": ["..."]
}

Keep each item concise. Use empty arrays when the transcript does not contain that category.

Transcript:
${transcript}`

  const response = await requestGemini(prompt, [
    {
      role: 'system',
      text:
        'You summarize meetings for MetaSpace. Be accurate, concise, and do not invent decisions or action items.',
    },
  ])
  const parsed = parseJsonObject(response)
  if (!parsed) {
    throw new Error('Gemini summary was not valid JSON')
  }
  return {
    keyPoints: normalizeList(parsed.keyPoints),
    actionItems: normalizeList(parsed.actionItems),
    decisions: normalizeList(parsed.decisions),
  }
}
