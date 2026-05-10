import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  hasGeminiApiKey,
  summarizeMeetingWithGemini,
  type GeminiSummary,
} from '../services/gemini'

export type ConferenceTranscriptLine = {
  id: string
  peerId: string
  speaker: string
  text: string
  timestamp: number
}

export type ConferenceSummary = {
  keyPoints: string[]
  actionItems: string[]
  decisions: string[]
}

type SharedTranscriptPayload = {
  type: 'conference-transcript'
  sessionId: string
  senderId: string
  line: ConferenceTranscriptLine
}

type UseConferenceTranscriptionProps = {
  active: boolean
  sessionId: string
  localPeerId: string
  localName: string
  sourceStream: MediaStream | null
  endpoint?: string
}

type UseConferenceTranscriptionResult = {
  transcripts: ConferenceTranscriptLine[]
  summary: ConferenceSummary
  error: string | null
  isTranscribing: boolean
  isSupported: boolean
  captionsEnabled: boolean
  setCaptionsEnabled: (enabled: boolean) => void
  clearTranscript: () => void
}

const MAX_TRANSCRIPT_LINES = 250
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8765/transcribe'
const TARGET_SAMPLE_RATE = 16000
const FLUSH_INTERVAL_MS = 3200
const MIN_CAPTURE_SECONDS = 1.0
const CARRY_SECONDS = 0.35

const actionPattern =
  /\b(action|todo|follow up|follow-up|next step|need to|should|let's|assign)\b/i
const decisionPattern = /\b(decide|decision|agreed|final|approved|we will)\b/i

function getAudioContextConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  const audioWindow = window as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function concatFloat32Arrays(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function downsampleTo16k(input: Float32Array, sourceSampleRate: number) {
  if (sourceSampleRate === TARGET_SAMPLE_RATE) {
    return input
  }

  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)

  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < output.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0

    for (let index = offsetBuffer; index < nextOffsetBuffer && index < input.length; index += 1) {
      accum += input[index]
      count += 1
    }

    output[offsetResult] = count > 0 ? accum / count : 0
    offsetResult += 1
    offsetBuffer = nextOffsetBuffer
  }

  return output
}

function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const pcm = floatTo16BitPCM(samples)
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(offset, pcm[index], true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function extractNovelText(currentText: string, previousText: string) {
  const current = currentText.trim()
  const previous = previousText.trim()
  if (!current) {
    return ''
  }
  if (!previous) {
    return current
  }

  const currentTokens = tokenize(current)
  const previousTokens = tokenize(previous)
  const maxOverlap = Math.min(previousTokens.length, currentTokens.length)

  for (let overlap = maxOverlap; overlap >= 3; overlap -= 1) {
    const prevTail = previousTokens.slice(previousTokens.length - overlap).join(' ')
    const currentHead = currentTokens.slice(0, overlap).join(' ')
    if (prevTail === currentHead) {
      const novel = currentTokens.slice(overlap).join(' ').trim()
      return novel
    }
  }

  if (current.toLowerCase().startsWith(previous.toLowerCase())) {
    return current.slice(previous.length).trim()
  }

  return current
}

function isLikelyHallucination(text: string) {
  const words = tokenize(text)
  if (words.length < 6) {
    return false
  }

  const uniqueRatio = new Set(words).size / words.length
  if (words.length >= 14 && uniqueRatio < 0.45) {
    return true
  }

  let maxRun = 1
  let currentRun = 1
  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) {
      currentRun += 1
      maxRun = Math.max(maxRun, currentRun)
    } else {
      currentRun = 1
    }
  }

  if (maxRun >= 5) {
    return true
  }

  return text.length > 280 && uniqueRatio < 0.55
}

function shouldAcceptTranscriptText(
  text: string,
  avgLogprob: number,
  noSpeechProb: number,
) {
  const words = tokenize(text)
  if (words.length === 0) {
    return false
  }

  // Ignore low-confidence short snippets and likely silence-driven outputs.
  if (noSpeechProb > 0.72 && words.length < 8) {
    return false
  }
  if (avgLogprob < -1.25 && words.length < 10) {
    return false
  }

  // Filter tiny unstable fragments like "the also" / "to combine the".
  if (words.length < 4 && text.length < 24) {
    return false
  }

  return true
}

function joinTranscriptText(base: string, addition: string) {
  const left = base.trim()
  const right = addition.trim()
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  if (/[.!?]$/.test(left)) {
    return `${left} ${right}`
  }
  return `${left} ${right}`
}

function summarizeTranscript(lines: ConferenceTranscriptLine[]): ConferenceSummary {
  const recent = lines.slice(-120)
  const sentenceSet = new Set<string>()
  const sentences: string[] = []
  const actionItems: string[] = []
  const decisions: string[] = []

  for (const line of recent) {
    const normalized = line.text.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      continue
    }

    if (actionPattern.test(normalized)) {
      actionItems.push(`${line.speaker}: ${normalized}`)
    }
    if (decisionPattern.test(normalized)) {
      decisions.push(`${line.speaker}: ${normalized}`)
    }

    const parts = normalized
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 25)

    for (const part of parts) {
      const key = part.toLowerCase()
      if (sentenceSet.has(key)) {
        continue
      }
      sentenceSet.add(key)
      sentences.push(part)
    }
  }

  return {
    keyPoints: sentences.slice(-4),
    actionItems: actionItems.slice(-4),
    decisions: decisions.slice(-4),
  }
}

export function useConferenceTranscription({
  active,
  sessionId,
  localPeerId,
  localName,
  sourceStream,
  endpoint = DEFAULT_ENDPOINT,
}: UseConferenceTranscriptionProps): UseConferenceTranscriptionResult {
  const [transcripts, setTranscripts] = useState<ConferenceTranscriptLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(true)

  const channelRef = useRef<BroadcastChannel | null>(null)
  const processingRef = useRef(false)
  const pendingChunksRef = useRef<Blob[]>([])
  const pcmChunksRef = useRef<Float32Array[]>([])
  const carryoverRef = useRef<Float32Array>(new Float32Array(0))
  const lastRawTextRef = useRef('')
  const lastAcceptedTextRef = useRef('')
  const lastTextAtRef = useRef(0)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const [geminiSummary, setGeminiSummary] = useState<GeminiSummary | null>(null)

  const audioContextCtor = getAudioContextConstructor()
  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(audioContextCtor) &&
    Boolean(navigator.mediaDevices)

  const appendTranscriptLine = useCallback((line: ConferenceTranscriptLine) => {
    if (seenIdsRef.current.has(line.id)) {
      return
    }
    seenIdsRef.current.add(line.id)

    setTranscripts((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1]
        const isRecentContinuation =
          last.peerId === line.peerId && line.timestamp - last.timestamp < 9000

        if (isRecentContinuation) {
          const normalizedLast = last.text.trim().toLowerCase()
          const normalizedNext = line.text.trim().toLowerCase()

          if (normalizedLast === normalizedNext) {
            return prev
          }

          if (
            normalizedNext.includes(normalizedLast) &&
            normalizedNext.length >= normalizedLast.length
          ) {
            const upgraded = { ...last, text: line.text, timestamp: line.timestamp }
            const replaced = [...prev]
            replaced[replaced.length - 1] = upgraded
            return replaced
          }

          const novelFromLast = extractNovelText(line.text, last.text)
          if (novelFromLast) {
            const merged = {
              ...last,
              text: joinTranscriptText(last.text, novelFromLast),
              timestamp: line.timestamp,
            }
            const replaced = [...prev]
            replaced[replaced.length - 1] = merged
            return replaced
          }
        }
      }

      const next = [...prev, line]
      if (next.length <= MAX_TRANSCRIPT_LINES) {
        return next
      }
      return next.slice(next.length - MAX_TRANSCRIPT_LINES)
    })
  }, [])

  useEffect(() => {
    const channel = new BroadcastChannel(`metaspace-conference-transcript-${sessionId}`)
    channelRef.current = channel

    channel.onmessage = (event: MessageEvent<SharedTranscriptPayload>) => {
      const payload = event.data
      if (!payload || payload.type !== 'conference-transcript') {
        return
      }
      if (payload.sessionId !== sessionId || payload.senderId === localPeerId) {
        return
      }
      appendTranscriptLine(payload.line)
    }

    return () => {
      channel.close()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
    }
  }, [appendTranscriptLine, localPeerId, sessionId])

  useEffect(() => {
    if (!active || !captionsEnabled || !sourceStream || !isSupported) {
      setIsTranscribing(false)
      return
    }

    const sourceAudioTracks = sourceStream.getAudioTracks()
    if (sourceAudioTracks.length === 0) {
      setError('No microphone track found for live transcription.')
      setIsTranscribing(false)
      return
    }

    const clonedAudioTracks = sourceAudioTracks.map((track) => track.clone())
    const audioOnlyStream = new MediaStream(clonedAudioTracks)

    if (!audioContextCtor) {
      setError('Audio context unavailable in this browser for raw PCM capture.')
      return
    }

    let audioContext: AudioContext | null = null
    let sourceNode: MediaStreamAudioSourceNode | null = null
    let processorNode: ScriptProcessorNode | null = null
    let silentGainNode: GainNode | null = null

    try {
      audioContext = new audioContextCtor()
      const context = audioContext
      sourceNode = context.createMediaStreamSource(audioOnlyStream)
      processorNode = context.createScriptProcessor(4096, 1, 1)
      silentGainNode = context.createGain()
      silentGainNode.gain.value = 0

      sourceNode.connect(processorNode)
      processorNode.connect(silentGainNode)
      silentGainNode.connect(context.destination)

      if (context.state === 'suspended') {
        void context.resume()
      }
    } catch {
      setError('Browser audio pipeline could not start for raw transcription.')
      setIsTranscribing(false)
      return
    }

    let cancelled = false
    setError(null)

    const processQueue = async () => {
      if (processingRef.current || cancelled) {
        return
      }

      processingRef.current = true
      setIsTranscribing(true)

      try {
        while (!cancelled && pendingChunksRef.current.length > 0) {
          const blob = pendingChunksRef.current.shift()
          if (!blob || blob.size < 1024) {
            continue
          }

          const form = new FormData()
          form.append('file', blob, 'conference-chunk.wav')

          const response = await fetch(endpoint, {
            method: 'POST',
            body: form,
          })

          if (!response.ok) {
            throw new Error(`STT service returned ${response.status}`)
          }

          const payload = (await response.json()) as {
            text?: string
            ignored?: boolean
            avg_logprob?: number
            no_speech_prob?: number
          }
          setError(null)
          if (payload.ignored) {
            continue
          }
          const rawText = (payload.text ?? '').trim()
          if (!rawText) {
            continue
          }

          const avgLogprob = payload.avg_logprob ?? 0
          const noSpeechProb = payload.no_speech_prob ?? 0

          if (!shouldAcceptTranscriptText(rawText, avgLogprob, noSpeechProb)) {
            continue
          }

          if (isLikelyHallucination(rawText)) {
            continue
          }

          const text = extractNovelText(rawText, lastRawTextRef.current)
          lastRawTextRef.current = rawText
          if (!text) {
            continue
          }

          if (
            text === lastAcceptedTextRef.current &&
            Date.now() - lastTextAtRef.current < 6000
          ) {
            continue
          }
          lastAcceptedTextRef.current = text
          lastTextAtRef.current = Date.now()

          const now = Date.now()
          const line: ConferenceTranscriptLine = {
            id: `tx-${localPeerId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
            peerId: localPeerId,
            speaker: localName,
            text,
            timestamp: now,
          }

          appendTranscriptLine(line)

          channelRef.current?.postMessage({
            type: 'conference-transcript',
            sessionId,
            senderId: localPeerId,
            line,
          } satisfies SharedTranscriptPayload)
        }
      } catch {
        setError(
          'Local STT service unavailable. Start local-ai/stt_server.py to enable live captions.',
        )
      } finally {
        processingRef.current = false
        if (!cancelled) {
          setIsTranscribing(false)
        }
      }
    }

    const minSamples = Math.floor(TARGET_SAMPLE_RATE * MIN_CAPTURE_SECONDS)
    const carrySamples = Math.floor(TARGET_SAMPLE_RATE * CARRY_SECONDS)

    const flushPcmBuffer = () => {
      if (cancelled) {
        return
      }

      const chunks = pcmChunksRef.current
      if (chunks.length === 0) {
        return
      }

      const mergedInput = concatFloat32Arrays(chunks)
      const contextSampleRate = audioContext?.sampleRate ?? TARGET_SAMPLE_RATE
      const merged16k = downsampleTo16k(mergedInput, contextSampleRate)

      if (merged16k.length < minSamples) {
        return
      }

      pcmChunksRef.current = []

      const withCarry = new Float32Array(carryoverRef.current.length + merged16k.length)
      withCarry.set(carryoverRef.current, 0)
      withCarry.set(merged16k, carryoverRef.current.length)

      const nextCarryStart = Math.max(0, merged16k.length - carrySamples)
      carryoverRef.current = merged16k.slice(nextCarryStart)

      const wavBlob = encodeWav(withCarry, TARGET_SAMPLE_RATE)
      pendingChunksRef.current.push(wavBlob)

      if (pendingChunksRef.current.length > 14) {
        pendingChunksRef.current.splice(0, pendingChunksRef.current.length - 14)
      }
      void processQueue()
    }

    processorNode.onaudioprocess = (event) => {
      if (cancelled) {
        return
      }

      const input = event.inputBuffer.getChannelData(0)
      if (!input || input.length === 0) {
        return
      }

      pcmChunksRef.current.push(new Float32Array(input))
    }

    const flushTimer = window.setInterval(() => {
      if (cancelled) {
        return
      }
      flushPcmBuffer()
    }, FLUSH_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(flushTimer)
      flushPcmBuffer()

      if (processorNode) {
        processorNode.onaudioprocess = null
        processorNode.disconnect()
      }
      if (sourceNode) {
        sourceNode.disconnect()
      }
      if (silentGainNode) {
        silentGainNode.disconnect()
      }
      if (audioContext) {
        void audioContext.close()
      }

      pendingChunksRef.current = []
      pcmChunksRef.current = []
      carryoverRef.current = new Float32Array(0)
      clonedAudioTracks.forEach((track) => track.stop())
      setIsTranscribing(false)
    }
  }, [
    active,
    appendTranscriptLine,
    captionsEnabled,
    endpoint,
    isSupported,
    localName,
    localPeerId,
    sessionId,
    sourceStream,
  ])

  const clearTranscript = useCallback(() => {
    seenIdsRef.current.clear()
    setTranscripts([])
    setGeminiSummary(null)
  }, [])

  const fallbackSummary = useMemo(() => summarizeTranscript(transcripts), [transcripts])

  useEffect(() => {
    if (transcripts.length === 0) {
      setGeminiSummary(null)
      return
    }

    const transcriptText = transcripts
      .slice(-80)
      .map((line) => `${line.speaker}: ${line.text}`)
      .join('\n')

    if (!hasGeminiApiKey() || transcriptText.trim().length < 120) {
      setGeminiSummary(null)
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      summarizeMeetingWithGemini(transcriptText)
        .then((nextSummary) => {
          if (!cancelled) {
            setGeminiSummary(nextSummary)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGeminiSummary(null)
          }
        })
    }, 1200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [transcripts])

  const summary = geminiSummary ?? fallbackSummary

  return {
    transcripts,
    summary,
    error,
    isTranscribing,
    isSupported,
    captionsEnabled,
    setCaptionsEnabled,
    clearTranscript,
  }
}
