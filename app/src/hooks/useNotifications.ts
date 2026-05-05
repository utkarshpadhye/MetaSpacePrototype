import { useEffect, useRef, useState } from 'react'

type NotificationItem = {
  id: string
  title: string
  body?: string | null
  priority: 'normal' | 'high'
  is_read: boolean
}

type UseNotificationsParams = {
  apiBaseUrl: string
  workspaceId: string
  userId: string
  enabled: boolean
}

export function useNotifications({ apiBaseUrl, workspaceId, userId, enabled }: UseNotificationsParams) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [highPriorityPulse, setHighPriorityPulse] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())
  const itemsRef = useRef<NotificationItem[]>([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let socket: WebSocket | null = null

    const ingest = (incoming: NotificationItem[]) => {
      setItems(incoming)
      incoming.forEach((item) => {
        if (seenRef.current.has(item.id)) {
          return
        }
        seenRef.current.add(item.id)
        if (item.priority === 'high') {
          setHighPriorityPulse((prev) => prev + 1)
        }
      })
    }

    const poll = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/${workspaceId}/notifications`, {
          headers: {
            'X-User-Id': userId,
            'X-Workspace-Id': workspaceId,
          },
        })
        if (!response.ok) {
          return
        }
        const data = (await response.json()) as NotificationItem[]
        ingest(data)
      } catch {
        // Polling fallback should stay silent in local demo mode.
      }
    }

    const openWs = () => {
      try {
        const wsUrl = apiBaseUrl.replace(/^http/, 'ws')
        socket = new WebSocket(
          `${wsUrl}/api/v1/${workspaceId}/notifications/ws?workspace_id=${workspaceId}&user_id=${userId}`,
        )
        socket.onopen = () => {
          socket?.send('subscribe')
        }
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { type?: string; notification?: NotificationItem }
            if (payload.type === 'notification.created' && payload.notification) {
              ingest([payload.notification, ...itemsRef.current])
            }
          } catch {
            // Ignore malformed payloads and rely on polling.
          }
        }
      } catch {
        // Rely on polling fallback if websocket setup fails.
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      void poll()
    }, 15000)
    openWs()

    return () => {
      window.clearInterval(interval)
      socket?.close()
    }
  }, [apiBaseUrl, enabled, userId, workspaceId])

  return { items, highPriorityPulse }
}
