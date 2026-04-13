import { useEffect, useMemo, useRef, useState } from 'react'
import { debugLog, getSessionIdFromUrl } from '../utils/debugLog'

type PresenceState = {
  x: number
  y: number
  roomId: string
  muted: boolean
}

type SessionPeer = {
  id: string
  name: string
  x: number
  y: number
  roomId: string
  muted: boolean
  cameraOff: boolean
}

type PresenceMessage =
  | {
      type: 'presence'
      sessionId: string
      peerId: string
      name: string
      state: PresenceState
      timestamp: number
    }
  | {
      type: 'leave'
      sessionId: string
      peerId: string
    }

type UseSessionPresenceResult = {
  sessionId: string
  localPeerId: string
  localName: string
  remotePeers: SessionPeer[]
  publishPresence: (state: PresenceState) => void
}

const DEFAULT_SESSION = 'main-demo'
const STALE_PEER_MS = 15000
const HEARTBEAT_MS = 1000

export function useSessionPresence(): UseSessionPresenceResult {
  const [remotePeers, setRemotePeers] = useState<SessionPeer[]>([])

  const localPeerId = useMemo(() => `peer-${crypto.randomUUID().slice(0, 8)}`, [])
  const localName = useMemo(() => `Guest-${localPeerId.slice(-4)}`, [localPeerId])

  const sessionId = useMemo(() => {
    const url = new URL(window.location.href)
    const parsed = getSessionIdFromUrl(url)
    const id = parsed || DEFAULT_SESSION

    const expectedPath = `/session=${encodeURIComponent(id)}`
    if (url.pathname !== expectedPath) {
      url.pathname = expectedPath
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }

    return id
  }, [])

  const channelName = useMemo(() => `metaspace-presence-${sessionId}`, [sessionId])
  const channelRef = useRef<BroadcastChannel | null>(null)
  const lastPresenceRef = useRef<PresenceState | null>(null)
  const lastSentAtRef = useRef(0)
  const liveStateRef = useRef<PresenceState | null>(null)
  const peersRef = useRef<
    Map<string, SessionPeer & { lastSeenAt: number }>
  >(new Map())

  const syncPeers = () => {
    setRemotePeers(
      Array.from(peersRef.current.values()).map((peer) => ({
        id: peer.id,
        name: peer.name,
        x: peer.x,
        y: peer.y,
        roomId: peer.roomId,
        muted: peer.muted,
        cameraOff: peer.cameraOff,
      })),
    )
  }

  const publishPresence = (state: PresenceState) => {
    const channel = channelRef.current
    if (!channel) {
      return
    }
    const now = Date.now()
    const last = lastPresenceRef.current
    const stateChanged =
      !last ||
      last.x !== state.x ||
      last.y !== state.y ||
      last.roomId !== state.roomId ||
      last.muted !== state.muted

    if (!stateChanged && now - lastSentAtRef.current < 1000) {
      return
    }

    lastPresenceRef.current = state
    liveStateRef.current = state
    lastSentAtRef.current = now
    channel.postMessage({
      type: 'presence',
      sessionId,
      peerId: localPeerId,
      name: localName,
      state,
      timestamp: now,
    } satisfies PresenceMessage)
    debugLog('presence', 'sent', { sessionId, localPeerId, state })
  }

  useEffect(() => {
    const channel = new BroadcastChannel(channelName)
    const peerStore = peersRef.current
    channelRef.current = channel
    debugLog('presence', 'channel opened', { sessionId, localPeerId, channelName })

    channel.onmessage = (event: MessageEvent<PresenceMessage>) => {
      const message = event.data
      if (!message || message.sessionId !== sessionId) {
        return
      }

      if (message.type === 'leave') {
        if (message.peerId === localPeerId) {
          return
        }
        peerStore.delete(message.peerId)
        syncPeers()
        debugLog('presence', 'peer left', { sessionId, peerId: message.peerId })
        return
      }

      if (message.peerId === localPeerId) {
        return
      }

      peerStore.set(message.peerId, {
        id: message.peerId,
        name: message.name,
        x: message.state.x,
        y: message.state.y,
        roomId: message.state.roomId,
        muted: message.state.muted,
        cameraOff: false,
        lastSeenAt: message.timestamp,
      })
      syncPeers()
      debugLog('presence', 'peer updated', {
        sessionId,
        peerId: message.peerId,
        x: message.state.x,
        y: message.state.y,
        roomId: message.state.roomId,
      })
    }

    const heartbeat = window.setInterval(() => {
      const state = liveStateRef.current
      const now = Date.now()
      if (!state || !channelRef.current) {
        return
      }
      if (now - lastSentAtRef.current < HEARTBEAT_MS) {
        return
      }
      lastSentAtRef.current = now
      channelRef.current.postMessage({
        type: 'presence',
        sessionId,
        peerId: localPeerId,
        name: localName,
        state,
        timestamp: now,
      } satisfies PresenceMessage)
      debugLog('presence', 'heartbeat', { sessionId, localPeerId, state })
    }, HEARTBEAT_MS)

    const staleCheck = window.setInterval(() => {
      const now = Date.now()
      let changed = false
      peerStore.forEach((peer, peerId) => {
        if (now - peer.lastSeenAt > STALE_PEER_MS) {
          peerStore.delete(peerId)
          changed = true
        }
      })
      if (changed) {
        syncPeers()
        debugLog('presence', 'stale peers removed', { sessionId, remaining: peerStore.size }, 'warn')
      }
    }, 1000)

    return () => {
      channel.postMessage({
        type: 'leave',
        sessionId,
        peerId: localPeerId,
      } satisfies PresenceMessage)
      debugLog('presence', 'channel closing', { sessionId, localPeerId })
      window.clearInterval(heartbeat)
      window.clearInterval(staleCheck)
      channel.close()
      channelRef.current = null
      peerStore.clear()
      syncPeers()
    }
  }, [channelName, localName, localPeerId, sessionId])

  return {
    sessionId,
    localPeerId,
    localName,
    remotePeers,
    publishPresence,
  }
}
