type SettingsModalProps = {
  open: boolean
  avatar: 'male' | 'female'
  onAvatarChange: (avatar: 'male' | 'female') => void
  onClose: () => void
}

const AVATAR_OPTIONS: Array<{
  id: 'male' | 'female'
  label: string
  src: string
}> = [
  { id: 'male', label: 'Male', src: '/assets/avatars/player-male.png' },
  { id: 'female', label: 'Female', src: '/assets/avatars/player-female.png' },
]

export function SettingsModal({ open, avatar, onAvatarChange, onClose }: SettingsModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div className="pixel-panel pixel-ui relative w-[360px] px-4 py-3 text-[10px] text-slate-800">
        <div className="flex items-center justify-between border-b border-[var(--pixel-border)] pb-2">
          <div className="text-[10px] text-slate-800">Settings</div>
          <button
            type="button"
            className="pixel-button flex h-6 w-6 items-center justify-center text-[10px]"
            onClick={onClose}
            aria-label="Close"
          >
            X
          </button>
        </div>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2">
            <span>Character</span>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`pixel-button flex flex-col items-center gap-2 px-2 py-2 text-[8px] ${
                    avatar === option.id ? 'bg-[#cbd5f5] text-slate-950' : ''
                  }`}
                  onClick={() => onAvatarChange(option.id)}
                >
                  <span
                    className="h-12 w-12 bg-contain bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${option.src})`,
                      backgroundSize: '144px 192px',
                      backgroundPosition: '0 0',
                    }}
                  />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Show proximity ring</span>
            <div className="pixel-pill px-2 py-1 text-[9px]">Off</div>
          </div>
          <div className="flex items-center justify-between">
            <span>Notification sounds</span>
            <div className="pixel-pill px-2 py-1 text-[9px]">On</div>
          </div>
          <div className="flex items-center justify-between">
            <span>Show name tags</span>
            <div className="pixel-pill px-2 py-1 text-[9px]">On</div>
          </div>
        </div>
      </div>
    </div>
  )
}
