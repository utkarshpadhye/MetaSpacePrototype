import { useEffect, useRef, useState } from 'react'

type BottomBarProps = {
  hintText: string
  voiceLabel: string
  onSendMessage: (message: string) => void
  onTypingChange: (isTyping: boolean) => void
}

const MAX_MESSAGE_LENGTH = 500

export function BottomBar({
  hintText,
  voiceLabel,
  onSendMessage,
  onTypingChange,
}: BottomBarProps) {
  const hintVisible = hintText.trim().length > 0
  const [message, setMessage] = useState('')
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const emojiRef = useRef<HTMLDivElement | null>(null)
  const showCounter = message.length > 400
  const emojis = ['🙂', '👍', '🎉', '❤️', '😄', '👋']

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }
    textarea.style.height = 'auto'
    const nextHeight = Math.min(textarea.scrollHeight, 72)
    textarea.style.height = `${nextHeight}px`
  }, [message])

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

  const handleSend = () => {
    const trimmed = message.trim()
    if (!trimmed) {
      return
    }
    onSendMessage(trimmed)
    setMessage('')
  }

  return (
    <div className="pixel-panel pixel-ui fixed bottom-0 left-0 right-0 z-20 flex h-14 items-center justify-between px-4 text-[9px] text-slate-300">
      <div
        className={`italic text-slate-400 transition-opacity duration-200 ${
          hintVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {hintText}
      </div>
      <div className="flex w-[min(480px,50vw)] flex-col items-end gap-1">
        <div className="flex w-full items-center gap-2" ref={emojiRef}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={message}
            maxLength={MAX_MESSAGE_LENGTH}
            onFocus={() => onTypingChange(true)}
            onBlur={() => onTypingChange(false)}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSend()
                onTypingChange(false)
              }
              if (event.key === 'Escape') {
                event.currentTarget.blur()
              }
            }}
            className="pixel-input min-h-[32px] w-full resize-none px-3 py-2 text-[10px] placeholder:text-slate-500 focus:outline-none"
            placeholder="Say something..."
          />
          <div className="relative">
            <button
              type="button"
              className="pixel-button flex h-7 w-7 items-center justify-center text-[10px]"
              aria-label="Emoji"
              onClick={(event) => {
                event.stopPropagation()
                setIsEmojiOpen((prev) => !prev)
              }}
            >
              :)
            </button>
            {isEmojiOpen ? (
              <div className="pixel-panel emoji-popover absolute bottom-10 right-0 z-30 grid grid-cols-3 gap-2 p-2">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="pixel-button flex h-7 w-7 items-center justify-center text-[12px]"
                    onClick={() => {
                      setMessage((prev) => `${prev}${emoji}`)
                      setIsEmojiOpen(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {showCounter ? (
          <div className="text-[9px] text-slate-500">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </div>
        ) : null}
      </div>
      <div className="pixel-pill px-3 py-1 text-[9px]">
        {voiceLabel}
      </div>
    </div>
  )
}
