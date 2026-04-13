import { useEffect, useRef } from 'react'

type FrameCallback = (deltaMs: number) => void

export function useGameLoop(callback: FrameCallback, enabled = true) {
  const callbackRef = useRef(callback)
  const frameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const tick = (time: number) => {
      const lastTime = lastTimeRef.current
      const deltaMs = lastTime == null ? 0 : time - lastTime
      lastTimeRef.current = time
      callbackRef.current(deltaMs)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
      lastTimeRef.current = null
    }
  }, [enabled])
}
