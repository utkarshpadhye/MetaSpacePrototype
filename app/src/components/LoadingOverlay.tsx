type LoadingOverlayProps = {
  visible: boolean
  message?: string
  variant?: 'map' | 'entry'
}

export function LoadingOverlay({ visible, message, variant = 'map' }: LoadingOverlayProps) {
  if (!visible) {
    return null
  }

  const label = message ?? (variant === 'entry' ? 'Syncing your space...' : 'Loading map...')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="loading-panel pixel-panel pixel-ui flex flex-col items-center gap-3 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="loading-runner">
            <img src="/assets/avatars/player.png" alt="Runner" />
          </div>
          <div className="loading-spinner h-10 w-10 rounded-full border-4 border-emerald-400 border-t-transparent" />
        </div>
        <span className="text-[10px] text-slate-200">{label}</span>
      </div>
    </div>
  )
}
