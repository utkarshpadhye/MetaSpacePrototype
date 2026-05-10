/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'

type NearbyPeer = {
  id: string
  name: string
  distance: number
  muted: boolean
  cameraOff: boolean
  speaking: boolean
}

type VideoOverlayProps = {
  nearbyPeers: NearbyPeer[]
}

type BubbleState = {
  id: string
  name: string
  distance: number
  muted: boolean
  cameraOff: boolean
  speaking: boolean
  status: 'entering' | 'connected' | 'leaving'
}

const LOCAL_BUBBLE = {
  id: 'you',
  name: 'You',
}

export function VideoOverlay({ nearbyPeers }: VideoOverlayProps) {
  const [bubbles, setBubbles] = useState<BubbleState[]>([])

  useEffect(() => {
    setBubbles((prev) => {
      const updated = prev.map((bubble) => {
        const match = nearbyPeers.find((peer) => peer.id === bubble.id)
        if (match) {
          return {
            ...bubble,
            ...match,
            status:
              bubble.status === 'leaving' ? ('connected' as const) : bubble.status,
          }
        }
        return { ...bubble, status: 'leaving' as const }
      })

      const additions = nearbyPeers
        .filter((peer) => !prev.some((bubble) => bubble.id === peer.id))
        .map((peer) => ({
          ...peer,
          status: 'entering' as const,
        }))

      return [...updated, ...additions]
    })
  }, [nearbyPeers])

  useEffect(() => {
    if (bubbles.some((bubble) => bubble.status === 'entering')) {
      const timeout = window.setTimeout(() => {
        setBubbles((prev) =>
          prev.map((bubble) =>
            bubble.status === 'entering'
              ? { ...bubble, status: 'connected' }
              : bubble,
          ),
        )
      }, 300)
      return () => window.clearTimeout(timeout)
    }
    return
  }, [bubbles])

  useEffect(() => {
    const leaving = bubbles.filter((bubble) => bubble.status === 'leaving')
    if (leaving.length === 0) {
      return
    }
    const timeout = window.setTimeout(() => {
      setBubbles((prev) => prev.filter((bubble) => bubble.status !== 'leaving'))
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [bubbles])

  const orderedBubbles = useMemo(() => {
    return bubbles.filter((bubble) => bubble.status !== 'leaving')
  }, [bubbles])

  const gridClass =
    orderedBubbles.length <= 1
      ? 'grid-cols-1'
      : orderedBubbles.length <= 4
        ? 'grid-cols-2'
        : 'grid-cols-3'

  if (orderedBubbles.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-[72px] right-4 z-10 pixel-ui">
      <div className={`grid gap-3 ${gridClass}`}>
        {orderedBubbles.map((bubble) => (
          <VideoBubble key={bubble.id} bubble={bubble} />
        ))}
        <LocalBubble />
      </div>
    </div>
  )
}

function VideoBubble({ bubble }: { bubble: BubbleState }) {
  const signal = Math.max(0, 1 - bubble.distance / 5)
  const bars = Math.ceil(signal * 5)
  const barColor = bubble.distance >= 3 ? 'bg-yellow-400' : 'bg-green-400'

  return (
    <div
      className={`video-bubble pixel-panel relative h-[120px] w-[160px] overflow-hidden ${
        bubble.status === 'entering'
          ? 'bubble-enter'
          : bubble.status === 'leaving'
            ? 'bubble-leave'
            : ''
      } ${bubble.speaking ? 'bubble-speaking' : ''}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-1 left-2 text-[9px] text-white">
        {bubble.name}
      </div>
      <div className="absolute right-2 top-2 flex items-end gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const height = 6 + index * 2
          return (
            <span
              key={index}
              style={{ height }}
              className={`w-[3px] rounded-sm ${
                index < bars ? barColor : 'bg-white/20'
              }`}
            />
          )
        })}
      </div>
      {bubble.muted ? (
        <div className="absolute bottom-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/80 text-[9px] text-white">
          M
        </div>
      ) : null}
      {bubble.cameraOff ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
          <div className="h-14 w-14 border-2 border-[var(--pixel-border)] bg-[#141a26]" />
          <div className="mt-2 text-[9px] text-slate-200">{bubble.name}</div>
        </div>
      ) : null}
    </div>
  )
}

function LocalBubble() {
  return (
    <div className="pixel-panel relative h-[105px] w-[140px] overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-1 left-2 text-[9px] text-white">
        {LOCAL_BUBBLE.name}
      </div>
    </div>
  )
}
