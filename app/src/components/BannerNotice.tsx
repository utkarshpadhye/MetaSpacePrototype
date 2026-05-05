type BannerNoticeProps = {
  message: string
}

export function BannerNotice({ message }: BannerNoticeProps) {
  if (!message) {
    return null
  }

  return (
    <div className="banner-notice pixel-panel pixel-ui fixed left-1/2 top-4 z-40 w-[min(90vw,520px)] -translate-x-1/2 px-4 py-2 text-[10px] text-slate-900">
      {message}
    </div>
  )
}
