import { useCallback, useEffect, useRef, useState } from 'react'
import { debugLog } from '../utils/debugLog'

type RemotePeer = {
  id: string
  name: string
  stream: MediaStream
}

type SignalMessage =
  | { type: 'join'; peerId: string; name: string }
  | { type: 'join-ack'; from: string; to: string; name: string }
  | { type: 'leave'; peerId: string }
  | { type: 'offer'; from: string; to: string; name: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; from: string; to: string; candidate: RTCIceCandidateInit }

type UseConferenceWebRTCProps = {
  active: boolean
  displayName: string
  muted: boolean
  sessionId: string
}

type UseConferenceWebRTCResult = {
  localStream: MediaStream | null
  remotePeers: RemotePeer[]
  error: string | null
  setSharedVideoTrack: (track: MediaStreamTrack | null) => void
}

const SIGNAL_CHANNEL_PREFIX = 'metaspace-conference-webrtc'

function toDescriptionInit(
  description: RTCSessionDescription | RTCSessionDescriptionInit,
): RTCSessionDescriptionInit {
  return {
    type: description.type,
    sdp: description.sdp,
  }
}

export function useConferenceWebRTC({
  active,
  displayName,
  muted,
  sessionId,
}: UseConferenceWebRTCProps): UseConferenceWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([])
  const [error, setError] = useState<string | null>(null)

  const peerIdRef = useRef<string>('')

  const channelRef = useRef<BroadcastChannel | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const remoteNamesRef = useRef<Map<string, string>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null)
  const sharedVideoTrackRef = useRef<MediaStreamTrack | null>(null)
  const signalingChannelName = `${SIGNAL_CHANNEL_PREFIX}-${sessionId}`

  const getPeerId = () => {
    if (!peerIdRef.current) {
      peerIdRef.current = `peer-${crypto.randomUUID().slice(0, 8)}`
    }
    return peerIdRef.current
  }

  const syncRemoteState = () => {
    setRemotePeers(
      Array.from(remoteStreamsRef.current.entries()).map(([id, stream]) => ({
        id,
        stream,
        name: remoteNamesRef.current.get(id) ?? 'Guest',
      })),
    )
  }

  const sendSignal = (message: SignalMessage) => {
    if (!channelRef.current) {
      return
    }
    try {
      channelRef.current.postMessage(message)
      debugLog('webrtc', 'signal sent', { type: message.type, to: 'to' in message ? message.to : 'all' })
    } catch (error) {
      debugLog('webrtc', 'signaling postMessage failed', error, 'error')
    }
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
    remoteStreamsRef.current.delete(remoteId)
    remoteNamesRef.current.delete(remoteId)
    pendingCandidatesRef.current.delete(remoteId)
    syncRemoteState()
  }

  const ensurePeerConnection = (remoteId: string, remoteName?: string) => {
    const existing = pcsRef.current.get(remoteId)
    if (existing) {
      if (remoteName) {
        remoteNamesRef.current.set(remoteId, remoteName)
      }
      return existing
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    const stream = localStreamRef.current
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })
      const outboundVideoTrack =
        sharedVideoTrackRef.current ?? cameraVideoTrackRef.current
      if (outboundVideoTrack) {
        pc.addTrack(outboundVideoTrack, stream)
      }
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return
      }
      sendSignal({
        type: 'candidate',
        from: getPeerId(),
        to: remoteId,
        candidate: event.candidate.toJSON(),
      })
    }

    pc.ontrack = (event) => {
      const streamFromRemote = event.streams[0]
      if (!streamFromRemote) {
        return
      }
      remoteStreamsRef.current.set(remoteId, streamFromRemote)
      syncRemoteState()
    }

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'closed'
      ) {
        cleanupPeer(remoteId)
      }
    }

    if (remoteName) {
      remoteNamesRef.current.set(remoteId, remoteName)
    }
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

  const createAndSendOffer = async (remoteId: string, remoteName?: string) => {
    try {
      const pc = ensurePeerConnection(remoteId, remoteName)
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
        from: getPeerId(),
        to: remoteId,
        name: displayName,
        sdp: toDescriptionInit(pc.localDescription),
      })
    } catch (error) {
      debugLog('webrtc', 'offer failed', error, 'error')
      setError('Unable to establish outgoing conference connection.')
    }
  }

  const setSharedVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    sharedVideoTrackRef.current = track
    const fallbackTrack = cameraVideoTrackRef.current
    const nextTrack = track ?? fallbackTrack

    pcsRef.current.forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((candidate) => candidate.track?.kind === 'video')

      if (sender) {
        void sender.replaceTrack(nextTrack ?? null)
        return
      }

      if (!nextTrack) {
        return
      }

      const stream = localStreamRef.current
      if (stream) {
        pc.addTrack(nextTrack, stream)
      }
    })

    debugLog('webrtc', 'updated outbound video track', {
      usingSharedTrack: Boolean(track),
      hasFallbackTrack: Boolean(fallbackTrack),
    })
  }, [])

  useEffect(() => {
    if (!active) {
      debugLog('webrtc', 'deactivating conference')
      sendSignal({ type: 'leave', peerId: getPeerId() })

      pcsRef.current.forEach((_, remoteId) => cleanupPeer(remoteId))
      pcsRef.current.clear()
      remoteStreamsRef.current.clear()
      remoteNamesRef.current.clear()
      pendingCandidatesRef.current.clear()
      syncRemoteState()

      if (channelRef.current) {
        channelRef.current.close()
        channelRef.current = null
      }

      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      localStreamRef.current = null
      cameraVideoTrackRef.current = null
      sharedVideoTrackRef.current = null
      queueMicrotask(() => {
        setLocalStream(null)
        setError(null)
      })
      return
    }

    let cancelled = false
    const myPeerId = getPeerId()
    const channel = new BroadcastChannel(signalingChannelName)
    channelRef.current = channel
    debugLog('webrtc', 'channel opened', { signalingChannelName, sessionId })

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        stream.getAudioTracks().forEach((track) => {
          track.enabled = !muted
        })

        cameraVideoTrackRef.current = stream.getVideoTracks()[0] ?? null

        localStreamRef.current = stream
        setLocalStream(stream)
        debugLog('webrtc', 'local media ready', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        })

        channel.postMessage({
          type: 'join',
          peerId: myPeerId,
          name: displayName,
        } satisfies SignalMessage)
      } catch (error) {
        debugLog('webrtc', 'getUserMedia failed', error, 'error')
        setError('Camera/microphone permission denied or unavailable.')
      }
    }

    channel.onmessage = async (event: MessageEvent<SignalMessage>) => {
      const message = event.data
      if (!message || typeof message !== 'object') {
        return
      }

      if (message.type === 'join') {
        if (message.peerId === myPeerId) {
          return
        }
        remoteNamesRef.current.set(message.peerId, message.name)
        debugLog('webrtc', 'peer joined', { peerId: message.peerId, name: message.name })
        sendSignal({
          type: 'join-ack',
          from: myPeerId,
          to: message.peerId,
          name: displayName,
        })
        if (myPeerId < message.peerId) {
          await createAndSendOffer(message.peerId, message.name)
        }
        return
      }

      if (message.type === 'join-ack') {
        if (message.to !== myPeerId || message.from === myPeerId) {
          return
        }
        remoteNamesRef.current.set(message.from, message.name)
        debugLog('webrtc', 'peer acknowledged join', {
          peerId: message.from,
          name: message.name,
        })
        if (myPeerId < message.from) {
          await createAndSendOffer(message.from, message.name)
        }
        return
      }

      if (message.type === 'leave') {
        if (message.peerId === myPeerId) {
          return
        }
        cleanupPeer(message.peerId)
        debugLog('webrtc', 'peer left', { peerId: message.peerId })
        return
      }

      if ('to' in message && message.to !== myPeerId) {
        return
      }

      if (message.type === 'offer') {
        debugLog('webrtc', 'offer received', { from: message.from })
        const pc = ensurePeerConnection(message.from, message.name)
        await pc.setRemoteDescription(toDescriptionInit(message.sdp))
        await flushPendingCandidates(message.from)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (!pc.localDescription) {
          return
        }
        sendSignal({
          type: 'answer',
          from: myPeerId,
          to: message.from,
          sdp: toDescriptionInit(pc.localDescription),
        })
        return
      }

      if (message.type === 'answer') {
        debugLog('webrtc', 'answer received', { from: message.from })
        const pc = ensurePeerConnection(message.from)
        await pc.setRemoteDescription(toDescriptionInit(message.sdp))
        await flushPendingCandidates(message.from)
        return
      }

      if (message.type === 'candidate') {
        debugLog('webrtc', 'candidate received', { from: message.from })
        const pc = ensurePeerConnection(message.from)
        if (pc.remoteDescription) {
          await pc.addIceCandidate(message.candidate)
        } else {
          const pending = pendingCandidatesRef.current.get(message.from) ?? []
          pending.push(message.candidate)
          pendingCandidatesRef.current.set(message.from, pending)
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      if (channelRef.current) {
        channelRef.current.close()
        channelRef.current = null
      }
    }
  }, [active, displayName, muted])

  useEffect(() => {
    const stream = localStreamRef.current
    if (!stream) {
      return
    }
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }, [muted])

  return {
    localStream,
    remotePeers,
    error,
    setSharedVideoTrack,
  }
}
