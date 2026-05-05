import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type UseScreenShareResult = {
  isSupported: boolean
  isSharing: boolean
  stream: MediaStream | null
  error: string | null
  startSharing: () => Promise<void>
  stopSharing: () => void
}

export function useScreenShare(): UseScreenShareResult {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const isSupported = useMemo(() => {
    return Boolean(navigator.mediaDevices?.getDisplayMedia)
  }, [])

  const stopSharing = useCallback(() => {
    const current = streamRef.current
    if (current) {
      current.getTracks().forEach((track) => track.stop())
    }
    streamRef.current = null
    setStream(null)
  }, [])

  const startSharing = useCallback(async () => {
    if (!isSupported) {
      setError('Screen sharing is not supported in this browser.')
      return
    }

    try {
      setError(null)
      const nextStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      stopSharing()
      streamRef.current = nextStream
      setStream(nextStream)

      const videoTrack = nextStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.onended = () => {
          stopSharing()
        }
      }
    } catch {
      setError('Unable to start screen sharing. Permission may have been denied.')
    }
  }, [isSupported, stopSharing])

  useEffect(() => {
    return () => {
      stopSharing()
    }
  }, [stopSharing])

  return {
    isSupported,
    isSharing: stream !== null,
    stream,
    error,
    startSharing,
    stopSharing,
  }
}
