type LoadingOverlayProps = {
  visible: boolean
}

export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-3">
        <div className="loading-spinner h-10 w-10 rounded-full border-4 border-green-400 border-t-transparent" />
        <span className="text-sm text-slate-200">Loading map...</span>
      </div>
    </div>
  )
}
