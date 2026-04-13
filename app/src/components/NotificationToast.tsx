type Toast = {
  id: string
  message: string
  status: 'entering' | 'leaving'
}

type NotificationToastProps = {
  toasts: Toast[]
}

export function NotificationToast({ toasts }: NotificationToastProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-[68px] z-40 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item w-[280px] rounded-lg border border-white/10 bg-[rgba(26,32,44,0.95)] px-3 py-2 text-sm text-slate-200 ${
            toast.status === 'leaving' ? 'toast-leave' : 'toast-enter'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
