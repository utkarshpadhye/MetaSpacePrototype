import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { askGemini, getGeminiProviderLabel, hasGeminiApiKey, type GeminiChatMessage } from '../services/gemini'

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
      return right === 0 ? null : left / right
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
    return 'Hi, I am Ana. Add a Gemini API key to enable richer workspace answers.'
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
    return 'I can answer through Gemini when VITE_GEMINI_API_KEY is configured. Without it, I can still handle basic local help, date, time, and calculations.'
  }
  return 'Gemini is not configured or unavailable right now. I can still help with basic local commands and simple calculations.'
}

function buildGeminiHistory(messages: AnaMessage[]): GeminiChatMessage[] {
  return [
    {
      role: 'system',
      text:
        'You are Ana, the MetaSpace assistant. Keep responses concise, practical, and friendly. Help with workspace navigation, project management, docs, CRM, meetings, and short explanations.',
    },
    ...messages
      .filter((message) => message.text.trim().length > 0)
      .slice(-CONTEXT_TURNS)
      .map((message): GeminiChatMessage => ({
        role: message.role,
        text: message.text,
      })),
  ]
}

async function streamText(text: string, onToken: (chunk: string) => void) {
  const chunks = text.split(/(\s+)/)
  for (const chunk of chunks) {
    onToken(chunk)
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 8)
    })
  }
}

export function useAnaAgent(): UseAnaAgentResult {
  const [messages, setMessages] = useState<AnaMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [providerLabel, setProviderLabel] = useState(getGeminiProviderLabel())
  const [modelStatus, setModelStatus] = useState<
    'idle' | 'connecting' | 'ready' | 'fallback'
  >(hasGeminiApiKey() ? 'idle' : 'fallback')
  const messagesRef = useRef<AnaMessage[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const prepareModel = useCallback(async () => {
    if (!hasGeminiApiKey()) {
      setModelStatus('fallback')
      setProviderLabel('Local fallback (Gemini key missing)')
      return null
    }

    setModelStatus('ready')
    setProviderLabel(getGeminiProviderLabel())
    return 'gemini'
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

    let finalText = ''
    let nextStatus: 'ready' | 'fallback' = hasGeminiApiKey() ? 'ready' : 'fallback'
    let nextLabel = getGeminiProviderLabel()

    try {
      if (hasGeminiApiKey()) {
        setModelStatus('connecting')
        setProviderLabel('Gemini (thinking)')
        finalText = await askGemini(clean, buildGeminiHistory(messagesRef.current))
        nextStatus = 'ready'
        nextLabel = getGeminiProviderLabel()
      }
    } catch {
      finalText = localRuleReply(clean)
      nextStatus = 'fallback'
      nextLabel = 'Local fallback (Gemini unavailable)'
    }

    if (!finalText.trim()) {
      finalText = localRuleReply(clean)
      nextStatus = 'fallback'
      nextLabel = 'Local fallback (Gemini unavailable)'
    }

    let streamedText = ''
    await streamText(finalText, (chunk) => {
      streamedText += chunk
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, text: streamedText } : message,
        ),
      )
    })

    setProviderLabel(nextLabel)
    setModelStatus(nextStatus)
    setIsThinking(false)
  }, [])

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
