import { useEffect, useMemo, useRef, useState } from 'react'
import { debugLog } from '../utils/debugLog'

type VoiceTarget = {
  id: string
  name: string
}

type VoicePeer = {
  id: string
  name: string
  stream: MediaStream
}

type VoiceSignalMessage =
  | { type: 'offer'; from: string; to: string; name: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'hangup'; from: string; to: string }

type UseProximityVoiceWebRTCProps = {
  active: boolean
  sessionId: string
  localPeerId: string
  displayName: string
  muted: boolean
  targets: VoiceTarget[]
}

type UseProximityVoiceWebRTCResult = {
  connectedPeers: VoicePeer[]
  error: string | null
}

const CHANNEL_PREFIX = 'metaspace-proximity-voice'

function toDescriptionInit(
  description: RTCSessionDescription | RTCSessionDescriptionInit,
): RTCSessionDescriptionInit {
  return {
    type: description.type,
    sdp: description.sdp,
  }
}

export function useProximityVoiceWebRTC({
  active,
  sessionId,
  localPeerId,
  displayName,
  muted,
  targets,
}: UseProximityVoiceWebRTCProps): UseProximityVoiceWebRTCResult {
  const [connectedPeers, setConnectedPeers] = useState<VoicePeer[]>([])
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<BroadcastChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const streamsRef = useRef<Map<string, MediaStream>>(new Map())
  const namesRef = useRef<Map<string, string>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())

  const channelName = useMemo(() => `${CHANNEL_PREFIX}-${sessionId}`, [sessionId])

  const syncPeers = () => {
    setConnectedPeers(
      Array.from(streamsRef.current.entries()).map(([id, stream]) => ({
        id,
        stream,
        name: namesRef.current.get(id) ?? 'Guest',
      })),
    )
  }

  const sendSignal = (message: VoiceSignalMessage) => {
    if (!channelRef.current) {
      return
    }
    channelRef.current.postMessage(message)
    debugLog('voice', 'signal sent', {
      type: message.type,
      from: 'from' in message ? message.from : localPeerId,
      to: 'to' in message ? message.to : 'n/a',
    })
  }

  const cleanupPeer = (remoteId: string) => {
    const pc = pcsRef.current.get(remoteId)
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
      pcsRef.current.delete(remoteId)
    }
    streamsRef.current.delete(remoteId)
    namesRef.current.delete(remoteId)
    pendingCandidatesRef.current.delete(remoteId)
    syncPeers()
  }

  const ensureLocalStream = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
      localStreamRef.current = stream
      debugLog('voice', 'local audio stream ready', {
        trackCount: stream.getAudioTracks().length,
      })
      return stream
    } catch (cause) {
      debugLog('voice', 'getUserMedia audio failed', cause, 'error')
      setError('Voice channel failed: microphone permission denied or unavailable.')
      throw cause
    }
  }

  const ensurePeerConnection = async (remoteId: string, remoteName?: string) => {
    const existing = pcsRef.current.get(remoteId)
    if (existing) {
      if (remoteName) {
        namesRef.current.set(remoteId, remoteName)
      }
      return existing
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    const stream = await ensureLocalStream()
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream)
    })

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return
      }
      sendSignal({
        type: 'candidate',
        from: localPeerId,
        to: remoteId,
        candidate: event.candidate.toJSON(),
      })
    }

    pc.ontrack = (event) => {
      const streamFromRemote = event.streams[0]
      if (!streamFromRemote) {
        return
      }
      streamsRef.current.set(remoteId, streamFromRemote)
      syncPeers()
      debugLog('voice', 'remote audio track received', { remoteId })
    }

    pc.onconnectionstatechange = () => {
      debugLog('voice', 'pc state changed', {
        remoteId,
        state: pc.connectionState,
      })
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'closed'
      ) {
        cleanupPeer(remoteId)
      }
    }

    namesRef.current.set(remoteId, remoteName ?? namesRef.current.get(remoteId) ?? 'Guest')
    pcsRef.current.set(remoteId, pc)
    return pc
  }

  const flushPendingCandidates = async (remoteId: string) => {
    const pc = pcsRef.current.get(remoteId)
    if (!pc || !pc.remoteDescription) {
      return
    }
    const pending = pendingCandidatesRef.current.get(remoteId) ?? []
    pendingCandidatesRef.current.delete(remoteId)
    for (const candidate of pending) {
      await pc.addIceCandidate(candidate)
    }
  }

  const createOfferIfNeeded = async (remoteId: string, remoteName: string) => {
    const pc = await ensurePeerConnection(remoteId, remoteName)
    if (pc.signalingState !== 'stable') {
      return
    }
    if (pc.localDescription || pc.remoteDescription) {
      return
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    if (!pc.localDescription) {
      return
    }

    sendSignal({
      type: 'offer',
      from: localPeerId,
      to: remoteId,
      name: displayName,
      sdp: toDescriptionInit(pc.localDescription),
    })
    debugLog('voice', 'offer created', { remoteId })
  }

  useEffect(() => {
    if (!active) {
      pcsRef.current.forEach((_, remoteId) => {
        sendSignal({ type: 'hangup', from: localPeerId, to: remoteId })
        cleanupPeer(remoteId)
      })
      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      localStreamRef.current = null
      queueMicrotask(() => {
        setConnectedPeers([])
        setError(null)
      })

      if (channelRef.current) {
        channelRef.current.close()
        channelRef.current = null
      }
      debugLog('voice', 'voice inactive; cleaned up')
      return
    }

    const channel = new BroadcastChannel(channelName)
    channelRef.current = channel
    debugLog('voice', 'channel opened', { channelName, sessionId, localPeerId })

    channel.onmessage = async (event: MessageEvent<VoiceSignalMessage>) => {
      const message = event.data
      if (!message || 'to' in message === false) {
        return
      }
      if (message.to !== localPeerId || message.from === localPeerId) {
        return
      }

      if (message.type === 'hangup') {
        cleanupPeer(message.from)
        debugLog('voice', 'hangup received', { from: message.from })
        return
      }

      if (message.type === 'offer') {
        debugLog('voice', 'offer received', { from: message.from })
        const pc = await ensurePeerConnection(message.from, message.name)
        await pc.setRemoteDescription(toDescriptionInit(message.sdp))
        await flushPendingCandidates(message.from)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (!pc.localDescription) {
          return
        }
        sendSignal({
          type: 'answer',
          from: localPeerId,
          to: message.from,
          sdp: toDescriptionInit(pc.localDescription),
        })
        return
      }

      if (message.type === 'answer') {
        debugLog('voice', 'answer received', { from: message.from })
        const pc = await ensurePeerConnection(message.from)
        await pc.setRemoteDescription(toDescriptionInit(message.sdp))
        await flushPendingCandidates(message.from)
        return
      }

      if (message.type === 'candidate') {
        const pc = await ensurePeerConnection(message.from)
        if (pc.remoteDescription) {
          await pc.addIceCandidate(message.candidate)
        } else {
          const pending = pendingCandidatesRef.current.get(message.from) ?? []
          pending.push(message.candidate)
          pendingCandidatesRef.current.set(message.from, pending)
        }
      }
    }

    return () => {
      channel.close()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
      debugLog('voice', 'channel closed', { channelName })
    }
  }, [active, channelName, localPeerId, sessionId, displayName])

  useEffect(() => {
    const stream = localStreamRef.current
    if (!stream) {
      return
    }
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
    debugLog('voice', 'local mute state updated', { muted })
  }, [muted])

  useEffect(() => {
    if (!active) {
      return
    }

    const targetMap = new Map(targets.map((target) => [target.id, target]))
    const existingPeerIds = Array.from(pcsRef.current.keys())

    existingPeerIds.forEach((peerId) => {
      if (!targetMap.has(peerId)) {
        sendSignal({ type: 'hangup', from: localPeerId, to: peerId })
        cleanupPeer(peerId)
      }
    })

    targets.forEach((target) => {
      namesRef.current.set(target.id, target.name)
      if (localPeerId < target.id) {
        void createOfferIfNeeded(target.id, target.name).catch((cause) => {
          debugLog('voice', 'offer creation failed', { targetId: target.id, cause }, 'error')
        })
      }
    })
  }, [active, displayName, localPeerId, targets])

  return {
    connectedPeers,
    error,
  }
}
