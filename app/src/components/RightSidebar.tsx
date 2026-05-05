import { useEffect, useMemo, useRef, useState } from 'react'
import { sections } from '../canvas/world'

type Participant = {
  id: string
  name: string
  muted: boolean
  cameraOff: boolean
  nearby: boolean
  distance: number
  sectionId: string
  sectionName: string
  roleName: string
  roleColor: string
}

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
  type: 'text' | 'system'
}

type RightSidebarProps = {
  activePanel: 'participants' | 'chat' | null
  participants: Participant[]
  messages: ChatMessage[]
  typingIndicator: string
}

export function RightSidebar({
  activePanel,
  participants,
  messages,
  typingIndicator,
}: RightSidebarProps) {
  const isOpen = activePanel !== null
  const [participantSearch, setParticipantSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const showNewMessage = !isAtBottom && messages.length > 0
  const sectionEntryAtRef = useRef<Map<string, number>>(new Map())
  const activeSectionByParticipantRef = useRef<Map<string, string>>(new Map())
  const [durationTick, setDurationTick] = useState(Date.now())

  const sectionOrder = useMemo(
    () => [
      ...sections.map((section) => ({ id: section.id, name: section.name })),
      { id: 'main', name: 'Main Room' },
    ],
    [],
  )

  const participantGroups = useMemo(() => {
    const query = participantSearch.trim().toLowerCase()
    const grouped = new Map<string, Participant[]>()

    participants.forEach((participant) => {
      const sectionId = participant.sectionId || 'main'
      const list = grouped.get(sectionId)
      if (list) {
        list.push(participant)
      } else {
        grouped.set(sectionId, [participant])
      }
    })

    return sectionOrder
      .map((section) => {
        const allParticipants = grouped.get(section.id) ?? []
        const filteredParticipants = query
          ? allParticipants.filter((participant) =>
              participant.name.toLowerCase().includes(query),
            )
          : allParticipants

        const sectionMatch = section.name.toLowerCase().includes(query)
        const visibleParticipants = query
          ? sectionMatch
            ? allParticipants
            : filteredParticipants
          : allParticipants

        return {
          id: section.id,
          name: section.name,
          totalCount: allParticipants.length,
          visibleParticipants,
        }
      })
      .filter((group) => query.length === 0 || group.visibleParticipants.length > 0)
  }, [participantSearch, participants, sectionOrder])

  useEffect(() => {
    const now = Date.now()
    const seenParticipants = new Set<string>()

    participants.forEach((participant) => {
      seenParticipants.add(participant.id)
      const key = `${participant.id}:${participant.sectionId || 'main'}`
      const previous = activeSectionByParticipantRef.current.get(participant.id)

      if (previous !== key) {
        activeSectionByParticipantRef.current.set(participant.id, key)
        if (!sectionEntryAtRef.current.has(key)) {
          sectionEntryAtRef.current.set(key, now)
        }
      }
    })

    Array.from(activeSectionByParticipantRef.current.keys()).forEach((participantId) => {
      if (!seenParticipants.has(participantId)) {
        activeSectionByParticipantRef.current.delete(participantId)
      }
    })
  }, [participants])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDurationTick(Date.now())
    }, 30000)
    return () => window.clearInterval(interval)
  }, [])

  const groupedMessages = useMemo(() => {
    return messages.map((message, index) => {
      if (message.type === 'system') {
        return { message, showHeader: false }
      }
      const prev = messages[index - 1]
      const showHeader =
        !prev ||
        prev.senderId !== message.senderId ||
        message.timestamp - prev.timestamp > 5 * 60 * 1000
      return { message, showHeader }
    })
  }, [messages])

  useEffect(() => {
    if (activePanel !== 'chat') {
      return
    }
    const container = messagesRef.current
    if (!container) {
      return
    }
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, activePanel])

  useEffect(() => {
    const container = messagesRef.current
    if (!container) {
      return
    }
    const handleScroll = () => {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 24
      isAtBottomRef.current = isNearBottom
      setIsAtBottom(isNearBottom)
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activePanel])

  return (
    <aside
      className={`pixel-panel pixel-ui fixed right-0 top-[52px] z-20 h-[calc(100vh-52px-56px)] w-[280px] bg-[#f7f9ff] transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {activePanel === 'participants' ? (
        <div className="flex h-full flex-col">
          <div className="pixel-divider border-b px-4 py-3 text-[10px] text-slate-800">
            Participants ({participants.length})
          </div>
          <div className="px-4 pb-3 pt-3">
            <input
              className="pixel-input h-8 w-full px-3 text-[10px] placeholder:text-slate-500"
              placeholder="Search people or section..."
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {participantGroups.length === 0 ? (
              <div className="px-1 text-[9px] text-slate-500">No matching sections.</div>
            ) : (
              participantGroups.map((group) => {
                const isExpanded = expandedSections.has(group.id)

                return (
                  <div key={group.id} className="mb-2 overflow-hidden rounded border border-[var(--pixel-border)] bg-white/80">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-2 py-2 text-left text-[9px] text-slate-800"
                      onClick={() => {
                        setExpandedSections((prev) => {
                          const next = new Set(prev)
                          if (next.has(group.id)) {
                            next.delete(group.id)
                          } else {
                            next.add(group.id)
                          }
                          return next
                        })
                      }}
                    >
                      <span className="truncate font-semibold">{group.name}</span>
                      <span className="text-slate-600">{group.totalCount} {group.totalCount === 1 ? 'person' : 'people'}</span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-[var(--pixel-border)] bg-slate-50/70 px-2 py-2">
                        {group.visibleParticipants.length === 0 ? (
                          <div className="text-[9px] text-slate-500">No one here.</div>
                        ) : (
                          group.visibleParticipants.map((participant) => {
                            const entryKey = `${participant.id}:${participant.sectionId || 'main'}`
                            const enteredAt = sectionEntryAtRef.current.get(entryKey) ?? durationTick
                            const minutes = Math.max(
                              0,
                              Math.floor((durationTick - enteredAt) / 60000),
                            )

                            return (
                              <div
                                key={participant.id}
                                className={`mb-1 flex items-center gap-2 rounded px-1 py-1 text-[9px] text-slate-700 ${
                                  participant.nearby ? 'participant-row--nearby' : ''
                                }`}
                              >
                                <div className="h-6 w-6 border-2 border-[var(--pixel-border)] bg-[#141a26]" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-semibold">{participant.name}</div>
                                  <div className="mt-0.5 inline-flex items-center rounded px-1 py-0.5 text-[8px] text-white" style={{ backgroundColor: participant.roleColor }}>
                                    {participant.roleName}
                                  </div>
                                  <div className="text-[8px] text-slate-500">{minutes} min in room</div>
                                </div>
                                <div className="flex items-center gap-1 text-[8px] text-red-300">
                                  {participant.muted ? 'M' : ''}
                                  {participant.cameraOff ? 'C' : ''}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {activePanel === 'chat' ? (
        <div className="flex h-full flex-col">
          <div className="pixel-divider border-b px-4 py-3 text-[10px] text-slate-800">
            Chat
          </div>
          <div ref={messagesRef} className="relative flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="text-[9px] text-slate-500">No messages yet.</div>
            ) : (
              groupedMessages.map(({ message, showHeader }) => (
                <div key={message.id} className="text-[10px]">
                  {message.type === 'system' ? (
                    <div className="my-2 text-center text-[9px] italic text-slate-500">
                      {message.text}
                    </div>
                  ) : showHeader ? (
                    <div className="chat-message mb-1 flex items-start gap-2">
                      <div className="mt-1 h-6 w-6 border-2 border-[var(--pixel-border)] bg-[#141a26]" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-600">
                            {message.senderName}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-700">{message.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-message mb-2 ml-8 text-slate-700">
                      {message.text}
                    </div>
                  )}
                </div>
              ))
            )}
            {typingIndicator ? (
              <div className="mt-2 text-[9px] text-slate-600">
                {typingIndicator} is typing
                <span className="typing-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            ) : null}
            {showNewMessage ? (
              <button
                type="button"
                className="pixel-button sticky bottom-3 mx-auto flex items-center gap-2 px-3 py-1 text-[9px] text-slate-700"
                onClick={() => {
                  const container = messagesRef.current
                  if (container) {
                    container.scrollTop = container.scrollHeight
                    setIsAtBottom(true)
                  }
                }}
              >
                New message ↓
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

    </aside>
  )
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
