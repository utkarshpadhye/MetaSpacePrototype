import { useEffect, useRef } from 'react'

type VoicePeer = {
  id: string
  name: string
  stream: MediaStream
}

type ProximityVoiceOverlayProps = {
  active: boolean
  connectedPeers: VoicePeer[]
  error: string | null
}

export function ProximityVoiceOverlay({
  active,
  connectedPeers,
  error,
}: ProximityVoiceOverlayProps) {
  if (!active) {
    return null
  }

  return (
    <div className="pixel-ui fixed left-4 top-[70px] z-30 w-[min(340px,70vw)]">
      <div className="pixel-panel px-3 py-2 text-[9px] text-slate-700">
        Proximity Voice {connectedPeers.length > 0 ? `(${connectedPeers.length} connected)` : '(waiting for nearby users)'}
      </div>
      {error ? (
        <div className="pixel-panel mt-2 px-3 py-2 text-[9px] text-red-700">{error}</div>
      ) : null}
      <div className="sr-only">
        {connectedPeers.map((peer) => (
          <RemoteAudio key={peer.id} stream={peer.stream} />
        ))}
      </div>
    </div>
  )
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const element = audioRef.current
    if (!element) {
      return
    }
    element.srcObject = stream
  }, [stream])

  return <audio ref={audioRef} autoPlay playsInline />
}
