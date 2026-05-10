import { useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import type {
  ConferenceSummary,
  ConferenceTranscriptLine,
} from '../hooks/useConferenceTranscription'

type RemotePeer = {
  id: string
  name: string
  stream: MediaStream
}

type ConferenceCallOverlayProps = {
  active: boolean
  localStream: MediaStream | null
  presentationStream: MediaStream | null
  remotePeers: RemotePeer[]
  error: string | null
  screenShareError: string | null
  transcriptionError: string | null
  isMicMuted: boolean
  onToggleMute: () => void
  isScreenSharing: boolean
  isScreenShareSupported: boolean
  onToggleScreenShare: () => void
  transcripts: ConferenceTranscriptLine[]
  summary: ConferenceSummary
  summaryProviderLabel: string
  isTranscribing: boolean
  isTranscriptionSupported: boolean
  captionsEnabled: boolean
  onToggleCaptions: () => void
  onClearTranscript: () => void
}

export function ConferenceCallOverlay({
  active,
  localStream,
  presentationStream,
  remotePeers,
  error,
  screenShareError,
  transcriptionError,
  isMicMuted,
  onToggleMute,
  isScreenSharing,
  isScreenShareSupported,
  onToggleScreenShare,
  transcripts,
  summary,
  summaryProviderLabel,
  isTranscribing,
  isTranscriptionSupported,
  captionsEnabled,
  onToggleCaptions,
  onClearTranscript,
}: ConferenceCallOverlayProps) {
  const hasPresentation = Boolean(presentationStream)

  const handleDownloadPdf = () => {
    const document = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = document.internal.pageSize.getWidth()
    const pageHeight = document.internal.pageSize.getHeight()
    const left = 40
    const right = pageWidth - 40
    const maxWidth = right - left
    let y = 48

    const ensureSpace = (heightNeeded: number) => {
      if (y + heightNeeded <= pageHeight - 40) {
        return
      }
      document.addPage()
      y = 48
    }

    const writeHeading = (text: string) => {
      ensureSpace(24)
      document.setFont('helvetica', 'bold')
      document.setFontSize(16)
      document.text(text, left, y)
      y += 22
    }

    const writeSubHeading = (text: string) => {
      ensureSpace(18)
      document.setFont('helvetica', 'bold')
      document.setFontSize(12)
      document.text(text, left, y)
      y += 16
    }

    const writeBodyLines = (lines: string[]) => {
      if (lines.length === 0) {
        ensureSpace(14)
        document.setFont('helvetica', 'normal')
        document.setFontSize(10)
        document.text('None', left, y)
        y += 14
        return
      }

      document.setFont('helvetica', 'normal')
      document.setFontSize(10)
      for (const line of lines) {
        const wrapped = document.splitTextToSize(line, maxWidth) as string[]
        ensureSpace(wrapped.length * 12 + 2)
        document.text(wrapped, left, y)
        y += wrapped.length * 12 + 2
      }
    }

    const stamp = new Date().toLocaleString()
    writeHeading('MetaSpace Meeting Report')
    document.setFont('helvetica', 'normal')
    document.setFontSize(10)
    document.text(`Generated: ${stamp}`, left, y)
    y += 18

    writeSubHeading('Meeting Summary')
    writeSubHeading('Key Points')
    writeBodyLines(summary.keyPoints.map((item) => `- ${item}`))
    y += 8
    writeSubHeading('Action Items')
    writeBodyLines(summary.actionItems.map((item) => `- ${item}`))
    y += 8
    writeSubHeading('Decisions')
    writeBodyLines(summary.decisions.map((item) => `- ${item}`))
    y += 12

    writeSubHeading('Live Transcript')
    const transcriptLines = transcripts.length
      ? transcripts.map(
          (line) => `${line.speaker} [${formatTime(line.timestamp)}]: ${line.text}`,
        )
      : ['No transcript captured.']
    writeBodyLines(transcriptLines)

    const filenameStamp = new Date().toISOString().replace(/[:.]/g, '-')
    document.save(`metaspace-meeting-report-${filenameStamp}.pdf`)
  }

  if (!active) {
    return null
  }

  return (
    <div className="pixel-ui fixed bottom-[72px] right-4 z-20 w-[min(760px,92vw)]">
      <div className="pixel-panel mb-2 px-3 py-2 text-[9px] text-slate-700">
        Conference Room WebRTC Call {remotePeers.length > 0 ? `(${remotePeers.length + 1} participants)` : '(waiting for others)'}
      </div>
      <div className="pixel-panel mb-2 flex flex-wrap items-center gap-2 px-3 py-2 text-[8px]">
        <button
          type="button"
          onClick={onToggleMute}
          className={`pixel-button h-8 px-3 ${isMicMuted ? 'pixel-button--danger' : 'pixel-button--success'}`}
        >
          {isMicMuted ? 'Mic Off' : 'Mic On'}
        </button>
        <button
          type="button"
          onClick={onToggleScreenShare}
          disabled={!isScreenShareSupported}
          className={`pixel-button h-8 px-3 ${isScreenSharing ? 'pixel-button--success' : ''}`}
        >
          {isScreenSharing ? 'Stop Share' : 'Share Screen'}
        </button>
        <button
          type="button"
          onClick={onToggleCaptions}
          disabled={!isTranscriptionSupported}
          className={`pixel-button h-8 px-3 ${captionsEnabled ? 'pixel-button--success' : ''}`}
        >
          {captionsEnabled ? 'Captions On' : 'Captions Off'}
        </button>
        <button
          type="button"
          onClick={onClearTranscript}
          className="pixel-button h-8 px-3"
        >
          Clear Notes
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="pixel-button h-8 px-3"
        >
          Download PDF
        </button>
        <span className="ml-auto text-[8px] text-slate-600">
          {isTranscribing ? 'Transcribing live' : 'Idle'}
        </span>
      </div>
      {error ? (
        <div className="pixel-panel mb-2 px-3 py-2 text-[9px] text-red-700">{error}</div>
      ) : null}
      {screenShareError ? (
        <div className="pixel-panel mb-2 px-3 py-2 text-[9px] text-red-700">{screenShareError}</div>
      ) : null}
      {transcriptionError ? (
        <div className="pixel-panel mb-2 px-3 py-2 text-[9px] text-red-700">{transcriptionError}</div>
      ) : null}
      {hasPresentation ? (
        <div className="video-bubble pixel-panel relative mb-3 h-[200px] overflow-hidden bg-slate-900">
          <VideoTileContent name="You (Screen)" stream={presentationStream} local />
        </div>
      ) : null}
      <div className={`grid gap-3 ${remotePeers.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <VideoTile name="You" stream={localStream} local />
        {remotePeers.map((peer) => (
          <VideoTile key={peer.id} name={peer.name} stream={peer.stream} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="pixel-panel min-h-[160px] p-3">
          <div className="mb-2 text-[9px] text-slate-700">Live Transcript</div>
          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 text-[9px] text-slate-700">
            {transcripts.length === 0 ? (
              <div className="text-slate-500">No transcript yet.</div>
            ) : (
              transcripts.slice(-16).map((line) => (
                <div key={line.id}>
                  <span className="font-semibold text-blue-700">{line.speaker}</span>
                  <span className="text-slate-500"> {formatTime(line.timestamp)} </span>
                  <span>{line.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="pixel-panel min-h-[160px] p-3 text-[9px] text-slate-700">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span>Meeting Summary</span>
            <span className="text-[8px] text-slate-500">{summaryProviderLabel}</span>
          </div>
          <SummarySection title="Key Points" items={summary.keyPoints} />
          <SummarySection title="Action Items" items={summary.actionItems} />
          <SummarySection title="Decisions" items={summary.decisions} />
        </div>
      </div>
    </div>
  )
}

type VideoTileProps = {
  name: string
  stream: MediaStream | null
  local?: boolean
}

function VideoTile({ name, stream, local = false }: VideoTileProps) {
  return (
    <div className="video-bubble pixel-panel relative h-[140px] overflow-hidden bg-slate-900">
      <VideoTileContent name={name} stream={stream} local={local} />
    </div>
  )
}

function VideoTileContent({ name, stream, local = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const element = videoRef.current
    if (!element) {
      return
    }
    element.srcObject = stream
  }, [stream])

  return (
    <>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={local}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-slate-300">
          {local ? 'Starting camera...' : 'Connecting...'}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-[9px] text-white">
        {name}
      </div>
    </>
  )
}

type SummarySectionProps = {
  title: string
  items: string[]
}

function SummarySection({ title, items }: SummarySectionProps) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[8px] uppercase tracking-wide text-slate-500">{title}</div>
      {items.length === 0 ? (
        <div className="text-slate-500">None yet.</div>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={`${title}-${index}`}>• {item}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}
