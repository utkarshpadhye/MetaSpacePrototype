import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnaMessage } from '../hooks/useAnaAgent'

type AnaOverlayProps = {
  open: boolean
  onClose: () => void
  messages: AnaMessage[]
  thinking: boolean
  providerLabel: string
  onSend: (text: string) => void
}

type MessagePart =
  | { kind: 'text'; content: string }
  | { kind: 'code'; content: string; language: string }

function parseMessageParts(text: string): MessagePart[] {
  const pattern = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g
  const parts: MessagePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null

  while ((match = pattern.exec(text)) !== null) {
    const index = match.index
    if (index > lastIndex) {
      const plain = text.slice(lastIndex, index)
      if (plain.trim().length > 0) {
        parts.push({ kind: 'text', content: plain })
      }
    }
    const language = match[1]?.trim() || 'text'
    const code = match[2] ?? ''
    parts.push({ kind: 'code', content: code, language })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex)
    if (plain.trim().length > 0) {
      parts.push({ kind: 'text', content: plain })
    }
  }

  if (parts.length === 0) {
    parts.push({ kind: 'text', content: text })
  }

  return parts
}

function MessageBubble({ message }: { message: AnaMessage }) {
  const isAssistant = message.role === 'assistant'
  const parts = useMemo(() => parseMessageParts(message.text), [message.text])
  return (
    <div className={`flex w-full ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-4 py-3 shadow-sm ${
          isAssistant
            ? 'border-slate-200 bg-white text-slate-800'
            : 'border-blue-300 bg-blue-50 text-slate-900'
        }`}
      >
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500">
          {isAssistant ? 'Ana' : 'You'}
        </div>
        <div className="space-y-3 text-[14px] leading-6">
          {parts.map((part, idx) => {
            if (part.kind === 'code') {
              return (
                <div key={`${message.id}-code-${idx}`} className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950/95 p-3 text-slate-100">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                    {part.language}
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-5">
                    {part.content}
                  </pre>
                </div>
              )
            }

            return (
              <p key={`${message.id}-text-${idx}`} className="whitespace-pre-wrap break-words">
                {part.content}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="ana-thinking rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500">Ana</div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-slate-700">Thinking</span>
          <span className="ana-thinking-dots">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  )
}

export function AnaOverlay({
  open,
  onClose,
  messages,
  thinking,
  providerLabel,
  onSend,
}: AnaOverlayProps) {
  const [input, setInput] = useState('')
  const messagesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, open])

  useEffect(() => {
    if (!open) {
      return
    }
    const container = messagesRef.current
    if (!container) {
      return
    }
    container.scrollTop = container.scrollHeight
  }, [messages, thinking, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(88vh,860px)] w-[min(94vw,1100px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafd] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ana</h2>
            <p className="text-sm text-slate-600">{providerLabel}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div ref={messagesRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-slate-500">
              Ask Ana anything. You can paste code, ask for summaries, or get implementation help.
            </div>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          {thinking ? <ThinkingIndicator /> : null}
        </div>

        <form
          className="border-t border-slate-200 bg-white px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            const value = input.trim()
            if (!value || thinking) {
              return
            }
            onSend(value)
            setInput('')
          }}
        >
          <div className="flex items-end gap-3">
            <textarea
              className="min-h-[88px] flex-1 resize-y rounded-xl border border-slate-300 bg-white p-3 text-[14px] leading-6 text-slate-900 shadow-inner focus:border-blue-400 focus:outline-none"
              placeholder="Message Ana..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button
              type="submit"
              disabled={thinking || input.trim().length === 0}
              className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
