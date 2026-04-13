import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type AnaMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

type UseAnaAgentResult = {
  messages: AnaMessage[]
  isThinking: boolean
  providerLabel: string
  modelStatus: 'idle' | 'connecting' | 'ready' | 'fallback'
  prepareModel: () => Promise<string | null>
  sendMessage: (text: string) => Promise<void>
}

type OllamaTagResponse = {
  models?: Array<{ name?: string }>
}

type OllamaPullResponse = {
  status?: string
}

type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type OllamaChatChunk = {
  message?: { content?: string }
  done?: boolean
  error?: string
}

const OLLAMA_BASE_URL = import.meta.env.DEV
  ? '/ana-llm'
  : 'http://127.0.0.1:11434'
const PRIMARY_MODEL = 'phi3.5:mini'
const MODEL_PREFERENCES = ['phi3.5:mini', 'phi3:mini', 'qwen2.5:0.5b', 'gemma2:2b']
const CONTEXT_TURNS = 8

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function tryEvaluateMath(raw: string) {
  const expression = raw.trim().replace(/^calculate\s+/i, '')
  const match = expression.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/,
  )
  if (!match) {
    return null
  }

  const left = Number(match[1])
  const operator = match[2]
  const right = Number(match[3])
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null
  }

  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      if (right === 0) {
        return null
      }
      return left / right
    default:
      return null
  }
}

function localRuleReply(input: string) {
  const text = input.trim()
  const lower = text.toLowerCase()

  const mathValue = tryEvaluateMath(lower)
  if (mathValue != null) {
    return `Result: ${mathValue}`
  }

  if (/(hello|hi|hey)\b/.test(lower)) {
    return 'Hi, I am Ana. I can answer simple local questions, basic math, time, date, and quick help.'
  }
  if (/(time|current time)/.test(lower)) {
    return `Local time: ${new Date().toLocaleTimeString()}`
  }
  if (/(date|today)/.test(lower)) {
    return `Today is ${new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}.`
  }
  if (/(help|what can you do)/.test(lower)) {
    return 'I run locally. Ask me basic questions, summarize short text, do quick calculations, or ask for workspace guidance.'
  }
  if (/(who are you|your name)/.test(lower)) {
    return 'I am Ana, your local assistant in MetaSpace.'
  }

  if (text.length < 4) {
    return 'Please share a bit more detail, and I will try to help locally.'
  }

  return `I can help with that locally at a basic level. For richer answers, run a local model (Ollama) and I will use it automatically.`
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeout =
    timeoutMs > 0 ? window.setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    if (timeout != null) {
      window.clearTimeout(timeout)
    }
  }
}

async function listOllamaModels(): Promise<string[]> {
  const res = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, { method: 'GET' }, 2000)
  if (!res.ok) {
    return []
  }
  const data = (await res.json()) as OllamaTagResponse
  return (data.models ?? [])
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name))
}

async function pullOllamaModel(model: string): Promise<boolean> {
  const res = await fetchWithTimeout(
    `${OLLAMA_BASE_URL}/api/pull`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false }),
    },
    180000,
  )
  if (!res.ok) {
    return false
  }

  const data = (await res.json()) as OllamaPullResponse
  const status = data.status?.toLowerCase() ?? ''
  return status.includes('success') || status.includes('exists') || status.includes('pulling')
}

function pickBestAvailableModel(available: string[]) {
  if (available.length === 0) {
    return null
  }

  const preferred = MODEL_PREFERENCES.find((candidate) =>
    available.some((name) => name.toLowerCase() === candidate.toLowerCase()),
  )
  return preferred ?? available[0]
}

async function ensureOllamaModel(cached: string | null): Promise<string | null> {
  if (cached) {
    return cached
  }

  const available = await listOllamaModels()
  const hasPrimary = available.some(
    (name) => name.toLowerCase() === PRIMARY_MODEL.toLowerCase(),
  )
  if (hasPrimary) {
    return PRIMARY_MODEL
  }

  const pulled = await pullOllamaModel(PRIMARY_MODEL)
  if (pulled) {
    const refreshed = await listOllamaModels()
    const nowHasPrimary = refreshed.some(
      (name) => name.toLowerCase() === PRIMARY_MODEL.toLowerCase(),
    )
    if (nowHasPrimary) {
      return PRIMARY_MODEL
    }
    return pickBestAvailableModel(refreshed)
  }

  return pickBestAvailableModel(available)
}

async function askOllamaStream(
  model: string,
  messages: OllamaChatMessage[],
  onToken: (chunk: string) => void,
): Promise<void> {
  const res = await fetchWithTimeout(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          num_predict: 220,
          temperature: 0.3,
        },
      }),
    },
    25000,
  )

  if (!res.ok || !res.body) {
    throw new Error('Ollama stream unavailable')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return
      }
      try {
        const data = JSON.parse(trimmed) as OllamaChatChunk
        if (data.error) {
          throw new Error(data.error)
        }
        const token = data.message?.content ?? ''
        if (token) {
          onToken(token)
        }
      } catch {
        // Ignore malformed stream lines and continue.
      }
    })
  }

  const finalChunk = buffer.trim()
  if (finalChunk) {
    try {
      const data = JSON.parse(finalChunk) as OllamaChatChunk
      if (data.message?.content) {
        onToken(data.message.content)
      }
    } catch {
      // Ignore final malformed buffer.
    }
  }
}

function buildConversationMessages(messages: AnaMessage[], userQuery: string): OllamaChatMessage[] {
  const historyMessages: OllamaChatMessage[] = messages
    .filter((message) => message.text.trim().length > 0)
    .slice(-CONTEXT_TURNS)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }))

  return [
    {
      role: 'system',
      content:
        'You are Ana, the local MetaSpace assistant. Keep responses concise, practical, and friendly.',
    },
    ...historyMessages,
    { role: 'user', content: userQuery },
  ]
}

async function streamLocalRuleReply(text: string, onToken: (chunk: string) => void) {
  const reply = localRuleReply(text)
  const words = reply.split(/(\s+)/)
  for (const word of words) {
    onToken(word)
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 12)
    })
  }
}

export function useAnaAgent(): UseAnaAgentResult {
  const [messages, setMessages] = useState<AnaMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [providerLabel, setProviderLabel] = useState('Not initialized')
  const [modelStatus, setModelStatus] = useState<
    'idle' | 'connecting' | 'ready' | 'fallback'
  >('idle')
  const ollamaModelRef = useRef<string | null>(null)
  const messagesRef = useRef<AnaMessage[]>([])
  const preparePromiseRef = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const prepareModel = useCallback(async () => {
    if (ollamaModelRef.current) {
      setModelStatus('ready')
      setProviderLabel(`Ollama (${ollamaModelRef.current})`)
      return ollamaModelRef.current
    }

    if (preparePromiseRef.current) {
      return preparePromiseRef.current
    }

    setModelStatus('connecting')
    setProviderLabel('Ollama (connecting)')

    const prepareTask = (async () => {
      try {
        const model = await ensureOllamaModel(null)
        if (model) {
          ollamaModelRef.current = model
          setModelStatus('ready')
          setProviderLabel(`Ollama (${model})`)
          return model
        }
      } catch {
        // Ignore and fall back below.
      }

      setModelStatus('fallback')
      setProviderLabel('Local rules (Ollama unavailable)')
      return null
    })().finally(() => {
      preparePromiseRef.current = null
    })

    preparePromiseRef.current = prepareTask
    return prepareTask
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean) {
      return
    }

    const userMessage: AnaMessage = {
      id: nowId('ana-user'),
      role: 'user',
      text: clean,
      timestamp: Date.now(),
    }
    const assistantId = nowId('ana-assistant')
    const assistantMessage: AnaMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsThinking(true)

    let label = 'Local rules (Ollama unavailable)'
    let streamedText = ''

    const appendChunk = (chunk: string) => {
      streamedText += chunk
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, text: streamedText } : message,
        ),
      )
    }

    try {
      const model = await prepareModel()
      if (model) {
        ollamaModelRef.current = model
        const promptMessages = buildConversationMessages(messagesRef.current, clean)
        label = `Ollama (${model})`
        await askOllamaStream(model, promptMessages, appendChunk)
      }
    } catch {
      // Fall back to local rules when local model endpoint is unavailable.
    }

    if (!streamedText.trim()) {
      label = 'Local rules (Ollama unavailable)'
      setModelStatus('fallback')
      await streamLocalRuleReply(clean, appendChunk)
    }

    setProviderLabel(label)
    setIsThinking(false)
  }, [prepareModel])

  return useMemo(
    () => ({
      messages,
      isThinking,
      providerLabel,
      modelStatus,
      prepareModel,
      sendMessage,
    }),
    [isThinking, messages, modelStatus, prepareModel, providerLabel, sendMessage],
  )
}
