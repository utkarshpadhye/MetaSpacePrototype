import { useEffect, useRef } from 'react'

type RemotePeer = {
  id: string
  name: string
  stream: MediaStream
}

type ConferenceCallOverlayProps = {
  active: boolean
  localStream: MediaStream | null
  remotePeers: RemotePeer[]
  error: string | null
}

export function ConferenceCallOverlay({
  active,
  localStream,
  remotePeers,
  error,
}: ConferenceCallOverlayProps) {
  if (!active) {
    return null
  }

  return (
    <div className="pixel-ui fixed bottom-[72px] right-4 z-20 w-[min(760px,92vw)]">
      <div className="pixel-panel mb-2 px-3 py-2 text-[9px] text-slate-700">
        Conference Room WebRTC Call {remotePeers.length > 0 ? `(${remotePeers.length + 1} participants)` : '(waiting for others)'}
      </div>
      {error ? (
        <div className="pixel-panel mb-2 px-3 py-2 text-[9px] text-red-700">{error}</div>
      ) : null}
      <div className={`grid gap-3 ${remotePeers.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <VideoTile name="You" stream={localStream} local />
        {remotePeers.map((peer) => (
          <VideoTile key={peer.id} name={peer.name} stream={peer.stream} />
        ))}
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
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const element = videoRef.current
    if (!element) {
      return
    }
    element.srcObject = stream
  }, [stream])

  return (
    <div className="video-bubble pixel-panel relative h-[140px] overflow-hidden bg-slate-900">
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
    </div>
  )
}
