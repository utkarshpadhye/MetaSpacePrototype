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
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2'
const OLLAMA_ENDPOINT =
  import.meta.env.VITE_OLLAMA_ENDPOINT || 'http://127.0.0.1:11434/api/generate'

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

function buildMeetingSummaryPrompt(transcript: string) {
  return `You are producing meeting intelligence for a software project workspace.

Read the transcript and return ONLY valid JSON with this exact shape:

{
  "keyPoints": ["..."],
  "actionItems": ["..."],
  "decisions": ["..."]
}

Rules:
- keyPoints must be synthesized themes or outcomes, not copied transcript sentences.
- actionItems must only include explicit work to do after the meeting. Prefer "Owner: task (due: date)" when an owner or due date is present. If no owner is clear, write the task without inventing one.
- decisions must only include explicit agreements, approvals, final choices, commitments, or "we will..." statements.
- Do not move ordinary discussion into actionItems or decisions.
- Use empty arrays when the transcript does not contain that category.
- Keep each item under 22 words.
- Return at most 5 keyPoints, 5 actionItems, and 5 decisions.

Transcript:
${transcript}`
}

export async function summarizeMeetingWithGemini(transcript: string) {
  const prompt = buildMeetingSummaryPrompt(transcript)

  const response = await requestGemini(prompt, [
    {
      role: 'system',
      text:
        'You summarize meetings for MetaSpace. Extract only evidence-backed summaries, actions, and decisions. Never invent missing owners, due dates, or decisions.',
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

export async function summarizeMeetingWithOllama(transcript: string) {
  const response = await fetch(OLLAMA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildMeetingSummaryPrompt(transcript),
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 700,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`)
  }

  const payload = (await response.json()) as { response?: string; error?: string }
  if (payload.error) {
    throw new Error(payload.error)
  }
  const parsed = parseJsonObject(payload.response ?? '')
  if (!parsed) {
    throw new Error('Ollama summary was not valid JSON')
  }
  return {
    keyPoints: normalizeList(parsed.keyPoints),
    actionItems: normalizeList(parsed.actionItems),
    decisions: normalizeList(parsed.decisions),
  }
}

export async function summarizeMeetingWithAi(transcript: string) {
  if (hasGeminiApiKey()) {
    try {
      return await summarizeMeetingWithGemini(transcript)
    } catch {
      // Fall through to Ollama when Gemini is unavailable or returns invalid JSON.
    }
  }

  return summarizeMeetingWithOllama(transcript)
}
