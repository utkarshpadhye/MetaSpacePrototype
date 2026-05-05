import { useEffect, useRef, useState } from 'react'

type TopBarProps = {
  profileName: string
  roomName: string
  participantCount: number
  unreadCount: number
  chatBadgePulse: number
  activePanel: 'participants' | 'chat' | null
  isMuted: boolean
  onToggleParticipants: () => void
  onToggleChat: () => void
  onToggleAna: () => void
  onToggleCalendar: () => void
  onToggleProjects: () => void
  onToggleDocs: () => void
  onToggleCrm: () => void
  onEmojiSelect: (emoji: string) => void
  onToggleMute: () => void
  isAnaThinking: boolean
  anaStatus: 'idle' | 'connecting' | 'ready' | 'fallback'
  isAnaOpen: boolean
  isCalendarOpen: boolean
  isProjectsOpen: boolean
  isDocsOpen: boolean
  isCrmOpen: boolean
}

export function TopBar({
  profileName,
  roomName,
  participantCount,
  unreadCount,
  chatBadgePulse,
  activePanel,
  isMuted,
  onToggleParticipants,
  onToggleChat,
  onToggleAna,
  onToggleCalendar,
  onToggleProjects,
  onToggleDocs,
  onToggleCrm,
  onEmojiSelect,
  onToggleMute,
  isAnaThinking,
  anaStatus,
  isAnaOpen,
  isCalendarOpen,
  isProjectsOpen,
  isDocsOpen,
  isCrmOpen,
}: TopBarProps) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)
  const emojiRef = useRef<HTMLDivElement | null>(null)
  const emojis = ['👍', '❤️', '😄', '🙂', '✅']
  const initial = profileName.trim().slice(0, 1).toUpperCase() || 'G'

  useEffect(() => {
    if (!isEmojiOpen) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (!emojiRef.current) {
        return
      }
      if (!emojiRef.current.contains(event.target as Node)) {
        setIsEmojiOpen(false)
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [isEmojiOpen])

  return (
    <div className="pixel-panel pixel-ui fixed left-0 right-0 top-0 z-20 flex h-[56px] items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-[var(--pixel-border)] bg-white text-[10px] text-slate-900">
            {initial}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] text-slate-500">Profile</span>
            <span className="text-[10px] text-slate-800">{profileName}</span>
          </div>
        </div>
        <span className="text-[10px] text-slate-800">{roomName}</span>
      </div>

      <div className="hidden text-[10px] text-slate-800 md:block">
        {roomName}
      </div>

      <div className="flex items-center gap-3">
        <TopBarButton
          label="Mute"
          active={isMuted}
          variant={isMuted ? 'danger' : 'default'}
          onClick={onToggleMute}
        />
        <div className="relative" ref={emojiRef}>
          <TopBarButton
            label="Emoji"
            active={isEmojiOpen}
            onClick={() => setIsEmojiOpen((prev) => !prev)}
          />
          {isEmojiOpen ? (
            <div className="pixel-panel emoji-popover absolute right-0 top-11 z-30 flex min-w-[220px] flex-wrap justify-center gap-3 p-3">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="pixel-button emoji-option flex h-9 w-9 items-center justify-center text-[16px] leading-none normal-case"
                  onClick={() => {
                    onEmojiSelect(emoji)
                    setIsEmojiOpen(false)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <TopBarButton
          label="Ana"
          active={isAnaOpen}
          variant={isAnaThinking ? 'success' : 'default'}
          statusDot={anaStatus === 'ready' ? 'green' : anaStatus === 'connecting' ? 'amber' : undefined}
          onClick={onToggleAna}
        />
        <TopBarButton
          label="Calendar"
          active={isCalendarOpen}
          onClick={onToggleCalendar}
        />
        <TopBarButton
          label="Docs"
          active={isDocsOpen}
          onClick={onToggleDocs}
        />
        <TopBarButton
          label="Projects"
          active={isProjectsOpen}
          onClick={onToggleProjects}
        />
        <TopBarButton
          label="CRM"
          active={isCrmOpen}
          onClick={onToggleCrm}
        />
        <TopBarButton
          label="People"
          active={activePanel === 'participants'}
          badgeCount={participantCount}
          onClick={onToggleParticipants}
        />
        <TopBarButton
          label="Chat"
          active={activePanel === 'chat'}
          badgeCount={unreadCount}
          badgePulseKey={chatBadgePulse}
          onClick={onToggleChat}
        />
      </div>
    </div>
  )
}

type TopBarButtonProps = {
  label: string
  active: boolean
  variant?: 'default' | 'danger' | 'success'
  badgeCount?: number
  badgePulseKey?: number
  statusDot?: 'green' | 'amber'
  onClick?: () => void
}

function TopBarButton({
  label,
  active,
  variant = 'default',
  badgeCount = 0,
  badgePulseKey,
  statusDot,
  onClick,
}: TopBarButtonProps) {
  const showBadge = badgeCount > 0
  const variantClass =
    variant === 'danger'
      ? 'pixel-button--danger'
      : variant === 'success'
        ? 'pixel-button--success'
        : ''
  const badgeClass = badgePulseKey ? 'badge-bounce' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pixel-button topbar-button relative flex h-8 min-w-[52px] items-center justify-center px-2 text-[8px] ${
        active ? 'bg-[#cbd5f5] text-slate-900' : 'text-slate-700'
      } ${variantClass}`}
    >
      {label}
      {showBadge ? (
        <span
          key={badgePulseKey}
          className={`pixel-badge absolute -right-2 -top-2 flex h-[18px] w-[18px] items-center justify-center text-[8px] ${badgeClass}`}
        >
          {badgeCount}
        </span>
      ) : null}
      {statusDot ? (
        <span
          className={`absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border border-slate-900 ${
            statusDot === 'green' ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
      ) : null}
    </button>
  )
}
