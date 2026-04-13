import { useCallback, useEffect, useState } from 'react'
import type { WorldObject } from './canvas/world'
import { BottomBar } from './components/BottomBar'
import { AnaOverlay } from './components/AnaOverlay'
import { CalendarOverlay } from './components/CalendarOverlay'
import { ConferenceCallOverlay } from './components/ConferenceCallOverlay'
import { GameCanvas } from './components/GameCanvas'
import { InteractionModal } from './components/InteractionModal'
import { LoadingOverlay } from './components/LoadingOverlay'
import { NotificationToast } from './components/NotificationToast'
import { ProximityVoiceOverlay } from './components/ProximityVoiceOverlay'
import { RightSidebar } from './components/RightSidebar'
import { TopBar } from './components/TopBar'
import { VideoOverlay } from './components/VideoOverlay'
import { useAnaAgent } from './hooks/useAnaAgent'
import { useConferenceWebRTC } from './hooks/useConferenceWebRTC'
import { useProximityVoiceWebRTC } from './hooks/useProximityVoiceWebRTC'
import { useSessionPresence } from './hooks/useSessionPresence'
import { debugLog } from './utils/debugLog'

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
  type: 'text' | 'system'
}

type SpeechBubble = {
  id: string
  text: string
  createdAt: number
  expiresAt: number
}

type EmojiReaction = {
  id: string
  emoji: string
  createdAt: number
}

type Toast = {
  id: string
  message: string
  status: 'entering' | 'leaving'
}

function App() {
  const session = useSessionPresence()
  const [hintText, setHintText] = useState('')
  const [roomName, setRoomName] = useState('Main Room')
  const [voiceLabel, setVoiceLabel] = useState('Voice: Main Room (auto)')
  const [interaction, setInteraction] = useState<WorldObject | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [roomTransition, setRoomTransition] = useState<'idle' | 'in' | 'out'>(
    'idle',
  )
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isAnaOpen, setIsAnaOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<'participants' | 'chat' | null>(
    null,
  )
  const [participants, setParticipants] = useState<
    Array<{
      id: string
      name: string
      muted: boolean
      cameraOff: boolean
      nearby: boolean
      distance: number
      roomId: string
      inSameRoom: boolean
    }>
  >([])
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set())
  const visibleParticipants = participants.filter(
    (participant) => participant.inSameRoom,
  )
  const nearbyPeers = participants
    .filter((participant) => participant.nearby && participant.inSameRoom)
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      distance: participant.distance,
      muted: participant.muted,
      cameraOff: participant.cameraOff,
      speaking: speakingIds.has(participant.id) && !participant.muted,
    }))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubble[]>([])
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isInteractionClosing, setIsInteractionClosing] = useState(false)
  const ana = useAnaAgent()
  const prepareAnaModel = ana.prepareModel
  const isConferenceRoom = voiceLabel.includes('Conference Room')
  const conferenceCall = useConferenceWebRTC({
    active: isConferenceRoom,
    displayName: session.localName,
    muted: isMuted,
    sessionId: session.sessionId,
  })
  const proximityTargets = participants
    .filter((participant) => participant.nearby && participant.inSameRoom)
    .map((participant) => ({ id: participant.id, name: participant.name }))
  const proximityVoice = useProximityVoiceWebRTC({
    active: !isConferenceRoom,
    sessionId: session.sessionId,
    localPeerId: session.localPeerId,
    displayName: session.localName,
    muted: isMuted,
    targets: proximityTargets,
  })

  useEffect(() => {
    if (!isAnaOpen) {
      return
    }
    void prepareAnaModel()
  }, [isAnaOpen, prepareAnaModel])

  useEffect(() => {
    debugLog('session', 'remote peers changed', {
      sessionId: session.sessionId,
      count: session.remotePeers.length,
      peers: session.remotePeers.map((peer) => ({
        id: peer.id,
        name: peer.name,
        x: peer.x,
        y: peer.y,
      })),
    })
  }, [session.remotePeers, session.sessionId])

  const handleInteractionClose = useCallback(() => {
    if (!interaction) {
      return
    }
    setIsInteractionClosing(true)
    window.setTimeout(() => {
      setInteraction(null)
      setIsInteractionClosing(false)
    }, 150)
  }, [interaction])

  const handleEmojiReaction = useCallback((emoji: string) => {
    const now = Date.now()
    setEmojiReactions((prev) => [
      ...prev,
      { id: `e-${now}`, emoji, createdAt: now },
    ])
  }, [])

  const handleRoomTransition = useCallback((targetRoom: string) => {
    setRoomTransition('in')
    window.setTimeout(() => {
      setRoomName(targetRoom)
      setRoomTransition('out')
      window.setTimeout(() => setRoomTransition('idle'), 300)
    }, 300)
  }, [])

  const handleAssetsReady = useCallback(() => {
    setIsLoading(false)
  }, [])

  const handleToggleParticipants = useCallback(() => {
    setIsAnaOpen(false)
    setActivePanel((current) =>
      current === 'participants' ? null : 'participants',
    )
  }, [])

  const handleToggleChat = useCallback(() => {
    setIsAnaOpen(false)
    setActivePanel((current) => {
      const next = current === 'chat' ? null : 'chat'
      if (next === 'chat') {
        setUnreadCount(0)
      }
      return next
    })
  }, [])

  const handleToggleAna = useCallback(() => {
    setIsCalendarOpen(false)
    setIsAnaOpen((prev) => !prev)
    setActivePanel(null)
  }, [])

  const handleToggleCalendar = useCallback(() => {
    setIsCalendarOpen((prev) => !prev)
    setActivePanel(null)
    setIsAnaOpen(false)
  }, [])

  const pushToast = useCallback((message: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, status: 'entering' }])
    window.setTimeout(() => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, status: 'leaving' } : toast,
        ),
      )
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
      }, 220)
    }, 4000)
  }, [])

  const handleSendMessage = useCallback(
    (text: string) => {
      const now = Date.now()
      const message: ChatMessage = {
        id: `m-${now}`,
        senderId: 'you',
        senderName: session.localName,
        text,
        timestamp: now,
        type: 'text',
      }
      setMessages((prev) => [...prev, message])

      const duration = Math.min(6000, Math.max(3000, text.length * 80))
      const bubble: SpeechBubble = {
        id: `b-${now}`,
        text,
        createdAt: now,
        expiresAt: now + duration,
      }
      setSpeechBubbles((prev) => [...prev, bubble])
    },
    [session.localName],
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()
      setSpeechBubbles((prev) => prev.filter((bubble) => bubble.expiresAt > now))
    }, 250)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nearby = participants.filter(
        (participant) => participant.nearby && participant.inSameRoom,
      )
      if (nearby.length === 0) {
        setSpeakingIds(new Set())
        return
      }
      const active = nearby[Math.floor(Math.random() * nearby.length)]
      setSpeakingIds(new Set([active.id]))
    }, 1800)
    return () => window.clearInterval(interval)
  }, [participants])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()
      setEmojiReactions((prev) => prev.filter((item) => now - item.createdAt < 2000))
    }, 250)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      pushToast('Alex joined the space')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pushToast])

  return (
    <div className="min-h-screen bg-[var(--pixel-bg)] text-[var(--pixel-ink)]">
      <TopBar
        roomName={roomName}
        participantCount={visibleParticipants.length}
        unreadCount={unreadCount}
        chatBadgePulse={0}
        activePanel={activePanel}
        isMuted={isMuted}
        onToggleParticipants={handleToggleParticipants}
        onToggleChat={handleToggleChat}
        onToggleAna={handleToggleAna}
        onToggleCalendar={handleToggleCalendar}
        onEmojiSelect={handleEmojiReaction}
        onToggleMute={() => setIsMuted((prev) => !prev)}
        isAnaThinking={ana.isThinking}
        anaStatus={ana.modelStatus}
        isAnaOpen={isAnaOpen}
        isCalendarOpen={isCalendarOpen}
      />
      <NotificationToast toasts={toasts} />
      <ProximityVoiceOverlay
        active={!isConferenceRoom}
        connectedPeers={proximityVoice.connectedPeers}
        error={proximityVoice.error}
      />
      {isConferenceRoom ? (
        <ConferenceCallOverlay
          active={isConferenceRoom}
          localStream={conferenceCall.localStream}
          remotePeers={conferenceCall.remotePeers}
          error={conferenceCall.error}
        />
      ) : (
        <VideoOverlay nearbyPeers={nearbyPeers} />
      )}
      <GameCanvas
        onHintChange={setHintText}
        interaction={interaction}
        onInteractionChange={setInteraction}
        isTyping={isTyping}
        speechBubbles={speechBubbles}
        emojiReactions={emojiReactions}
        onParticipantsUpdate={setParticipants}
        onRoomTransition={handleRoomTransition}
        onAssetsReady={handleAssetsReady}
        onVoiceChannelChange={setVoiceLabel}
        syncedPeers={session.remotePeers}
        localName={session.localName}
        localMuted={isMuted}
        onLocalPresence={session.publishPresence}
      />
      <RightSidebar
        activePanel={activePanel}
        participants={visibleParticipants}
        messages={messages}
        typingIndicator=""
      />
      <BottomBar
        hintText={hintText}
        voiceLabel={voiceLabel}
        onSendMessage={handleSendMessage}
        onTypingChange={setIsTyping}
      />
      <InteractionModal
        interaction={interaction}
        isClosing={isInteractionClosing}
        onClose={handleInteractionClose}
      />
      <CalendarOverlay
        open={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        sessionId={session.sessionId}
        localPeerId={session.localPeerId}
        onReminder={(event) => {
          pushToast(`Reminder: ${event.title}`)
        }}
      />
      <AnaOverlay
        open={isAnaOpen}
        onClose={() => setIsAnaOpen(false)}
        messages={ana.messages}
        thinking={ana.isThinking}
        providerLabel={ana.providerLabel}
        onSend={(text) => {
          void ana.sendMessage(text)
        }}
      />
      <LoadingOverlay visible={isLoading} />
      {roomTransition !== 'idle' ? (
        <div
          className={`room-transition fixed inset-0 z-40 bg-black ${
            roomTransition === 'in' ? 'room-fade-in' : 'room-fade-out'
          }`}
        />
      ) : null}
    </div>
  )
}

export default App
