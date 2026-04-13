import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { debugLog, getSessionIdFromUrl } from '../utils/debugLog'

type ExcalidrawInitialData = ComponentProps<typeof Excalidraw>['initialData']
type ExcalidrawOnChange = NonNullable<ComponentProps<typeof Excalidraw>['onChange']>
type SceneElements = Parameters<ExcalidrawOnChange>[0]

type SceneData = {
  elements: SceneElements
}

type WhiteboardPayload =
  | {
      type: 'scene-update'
      sessionId: string
      senderId: string
      scene: SceneData
    }
  | {
      type: 'scene-request'
      sessionId: string
      senderId: string
    }

const DEFAULT_SESSION = 'main-demo'

function getSessionId() {
  const url = new URL(window.location.href)
  return getSessionIdFromUrl(url) ?? DEFAULT_SESSION
}

function readInitialData(storageKey: string, sessionId: string): ExcalidrawInitialData | null {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      debugLog('whiteboard', 'local storage scene ignored (not an object)', { sessionId }, 'warn')
      return null
    }

    const maybeElements = (parsed as { elements?: unknown }).elements
    if (!Array.isArray(maybeElements)) {
      debugLog('whiteboard', 'local storage scene ignored (invalid elements)', { sessionId }, 'warn')
      return null
    }

    debugLog('whiteboard', 'loaded from local storage', { sessionId })
    return parsed as ExcalidrawInitialData
  } catch (error) {
    debugLog('whiteboard', 'failed to parse local storage scene', error, 'warn')
    return null
  }
}

export function LoungeWhiteboard() {
  const apiRef = useRef<unknown>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const syncingRef = useRef(false)
  const latestSceneRef = useRef<SceneData | null>(null)
  const pendingSceneRef = useRef<SceneData | null>(null)
  const persistTimeoutRef = useRef<number | null>(null)

  const sessionId = useMemo(() => getSessionId(), [])
  const senderId = useMemo(() => `wb-${crypto.randomUUID().slice(0, 8)}`, [])
  const channelName = useMemo(() => `metaspace-whiteboard-${sessionId}`, [sessionId])
  const storageKey = useMemo(() => `metaspace-whiteboard-${sessionId}`, [sessionId])

  const [initialData] = useState<ExcalidrawInitialData | null>(() =>
    readInitialData(storageKey, sessionId)
  )

  useEffect(() => {
    if (!initialData || typeof initialData !== 'object') {
      return
    }
    const sceneWithElements = initialData as { elements?: SceneElements }
    if (!Array.isArray(sceneWithElements.elements)) {
      return
    }
    latestSceneRef.current = { elements: [...sceneWithElements.elements] }
  }, [initialData])

  useEffect(() => {
    const channel = new BroadcastChannel(channelName)
    channelRef.current = channel
    debugLog('whiteboard', 'channel opened', { channelName, sessionId })

    channel.onmessage = (event: MessageEvent<WhiteboardPayload>) => {
      const payload = event.data
      if (!payload || payload.sessionId !== sessionId || payload.senderId === senderId) {
        return
      }

      if (payload.type === 'scene-request') {
        if (!latestSceneRef.current) {
          return
        }
        channel.postMessage({
          type: 'scene-update',
          sessionId,
          senderId,
          scene: latestSceneRef.current,
        } satisfies WhiteboardPayload)
        debugLog('whiteboard', 'scene sent to requester', { sessionId })
        return
      }

      if (payload.type !== 'scene-update') {
        return
      }
      const api = apiRef.current as
        | {
            updateScene: (scene: {
              elements?: SceneElements
              collaborators?: Map<unknown, unknown>
            }) => void
          }
        | null
      if (!api) {
        pendingSceneRef.current = payload.scene
        return
      }

      syncingRef.current = true
      api.updateScene({
        elements: payload.scene.elements,
        collaborators: new Map(),
      })
      syncingRef.current = false

      latestSceneRef.current = payload.scene
      window.localStorage.setItem(storageKey, JSON.stringify(payload.scene))
      debugLog('whiteboard', 'scene synced from peer', {
        sessionId,
        senderId: payload.senderId,
      })
    }

    channel.postMessage({
      type: 'scene-request',
      sessionId,
      senderId,
    } satisfies WhiteboardPayload)
    debugLog('whiteboard', 'requested latest scene from peers', { sessionId })

    return () => {
      channel.close()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
      debugLog('whiteboard', 'channel closed', { channelName })
      if (persistTimeoutRef.current != null) {
        window.clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [channelName, senderId, sessionId, storageKey])

  const handleChange: ExcalidrawOnChange = (elements) => {
    if (syncingRef.current) {
      return
    }

    const scene: SceneData = {
      elements: [...elements],
    }
    latestSceneRef.current = scene

    if (persistTimeoutRef.current != null) {
      window.clearTimeout(persistTimeoutRef.current)
    }

    persistTimeoutRef.current = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, JSON.stringify(scene))
      channelRef.current?.postMessage({
        type: 'scene-update',
        sessionId,
        senderId,
        scene,
      } satisfies WhiteboardPayload)
      debugLog('whiteboard', 'scene saved and broadcast', { sessionId })
    }, 200)
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api
          if (pendingSceneRef.current) {
            const pendingScene = pendingSceneRef.current
            pendingSceneRef.current = null
            const typedApi = apiRef.current as {
              updateScene: (scene: {
                elements?: SceneElements
                collaborators?: Map<unknown, unknown>
              }) => void
            }
            syncingRef.current = true
            typedApi.updateScene({
              elements: pendingScene.elements,
              collaborators: new Map(),
            })
            syncingRef.current = false
            latestSceneRef.current = pendingScene
          }
        }}
        initialData={initialData ?? undefined}
        onChange={handleChange}
      />
    </div>
  )
}
