import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type CalendarScope = 'global' | 'team' | 'personal'

export type CalendarEvent = {
  id: string
  scope: CalendarScope
  title: string
  description: string
  startAt: string
  endAt: string
  allDay: boolean
  category: string
  reminderMinutes: number | null
  isTask: boolean
  taskDone: boolean
}

type UseCalendarDataOptions = {
  sessionId: string
  localPeerId: string
  onReminder?: (event: CalendarEvent) => void
}

type UseCalendarDataResult = {
  events: CalendarEvent[]
  createEvent: (event: Omit<CalendarEvent, 'id'>) => void
  updateEvent: (eventId: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => void
  deleteEvent: (eventId: string) => void
  toggleTaskDone: (eventId: string) => void
}

type SharedPayload = {
  type: 'calendar-shared-sync'
  sessionId: string
  senderId: string
  events: CalendarEvent[]
}

function parseEvents(raw: string | null) {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return null
    }
    return parsed.filter((item): item is CalendarEvent => {
      if (!item || typeof item !== 'object') {
        return false
      }
      const event = item as Partial<CalendarEvent>
      return (
        typeof event.id === 'string' &&
        (event.scope === 'global' || event.scope === 'team' || event.scope === 'personal') &&
        typeof event.title === 'string' &&
        typeof event.description === 'string' &&
        typeof event.startAt === 'string' &&
        typeof event.endAt === 'string' &&
        typeof event.allDay === 'boolean' &&
        typeof event.category === 'string' &&
        (event.reminderMinutes === null || typeof event.reminderMinutes === 'number') &&
        typeof event.isTask === 'boolean' &&
        typeof event.taskDone === 'boolean'
      )
    })
  } catch {
    return null
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function atTime(date: Date, hours: number, minutes = 0) {
  const next = new Date(date)
  next.setHours(hours, minutes, 0, 0)
  return next
}

function makeEvent(
  id: string,
  scope: CalendarScope,
  title: string,
  description: string,
  startAt: Date,
  endAt: Date,
  category: string,
  config?: {
    allDay?: boolean
    reminderMinutes?: number | null
    isTask?: boolean
    taskDone?: boolean
  },
): CalendarEvent {
  return {
    id,
    scope,
    title,
    description,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    allDay: config?.allDay ?? false,
    category,
    reminderMinutes: config?.reminderMinutes ?? 30,
    isTask: config?.isTask ?? false,
    taskDone: config?.taskDone ?? false,
  }
}

function createSeedEvents(now: Date) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const globalEvents: CalendarEvent[] = [
    makeEvent(
      `seed-global-${today.getTime()}-1`,
      'global',
      'Quarterly Townhall',
      'Company-wide update with leadership.',
      atTime(addDays(today, 2), 16, 0),
      atTime(addDays(today, 2), 17, 0),
      'townhall',
      { reminderMinutes: 60 },
    ),
    makeEvent(
      `seed-global-${today.getTime()}-2`,
      'global',
      'Spring Office Celebration',
      'Office social event and team dinner.',
      atTime(addDays(today, 5), 18, 30),
      atTime(addDays(today, 5), 21, 0),
      'party',
      { reminderMinutes: 120 },
    ),
    makeEvent(
      `seed-global-${today.getTime()}-3`,
      'global',
      'Public Holiday',
      'Office closed for holiday.',
      addDays(today, 9),
      addDays(today, 10),
      'holiday',
      { allDay: true, reminderMinutes: 24 * 60 },
    ),
  ]

  const teamEvents: CalendarEvent[] = [
    makeEvent(
      `seed-team-${today.getTime()}-1`,
      'team',
      'Sprint Planning',
      'Plan sprint goals and assign work.',
      atTime(addDays(today, 1), 10, 0),
      atTime(addDays(today, 1), 11, 0),
      'meeting',
      { reminderMinutes: 30 },
    ),
    makeEvent(
      `seed-team-${today.getTime()}-2`,
      'team',
      'Implement API Contract',
      'Task: finalize converter API schema draft.',
      atTime(addDays(today, 3), 13, 0),
      atTime(addDays(today, 3), 15, 0),
      'task',
      { reminderMinutes: 45, isTask: true, taskDone: false },
    ),
    makeEvent(
      `seed-team-${today.getTime()}-3`,
      'team',
      'Release Readiness Check',
      'Review blockers and QA checklist.',
      atTime(addDays(today, 4), 17, 0),
      atTime(addDays(today, 4), 18, 0),
      'deadline',
      { reminderMinutes: 30, isTask: true, taskDone: false },
    ),
  ]

  const personalEvents: CalendarEvent[] = [
    makeEvent(
      `seed-personal-${today.getTime()}-1`,
      'personal',
      '1:1 with Mentor',
      'Personal growth and feedback sync.',
      atTime(addDays(today, 2), 11, 30),
      atTime(addDays(today, 2), 12, 0),
      'meeting',
      { reminderMinutes: 15 },
    ),
    makeEvent(
      `seed-personal-${today.getTime()}-2`,
      'personal',
      'Deep Work Block',
      'Focus time for architecture doc.',
      atTime(addDays(today, 3), 9, 0),
      atTime(addDays(today, 3), 11, 0),
      'personal',
      { reminderMinutes: 10 },
    ),
  ]

  return { globalEvents, teamEvents, personalEvents }
}

export function useCalendarData({
  sessionId,
  localPeerId,
  onReminder,
}: UseCalendarDataOptions): UseCalendarDataResult {
  const sharedStorageKey = `metaspace-calendar-shared-${sessionId}`
  const personalStorageKey = `metaspace-calendar-personal-${localPeerId}`
  const channelName = `metaspace-calendar-${sessionId}`

  const [sharedEvents, setSharedEvents] = useState<CalendarEvent[]>(() => {
    const existing = parseEvents(window.localStorage.getItem(sharedStorageKey))
    if (existing) {
      return existing.filter((event) => event.scope === 'global' || event.scope === 'team')
    }
    const seeds = createSeedEvents(new Date())
    return [...seeds.globalEvents, ...seeds.teamEvents]
  })

  const [personalEvents, setPersonalEvents] = useState<CalendarEvent[]>(() => {
    const existing = parseEvents(window.localStorage.getItem(personalStorageKey))
    if (existing) {
      return existing.filter((event) => event.scope === 'personal')
    }
    const seeds = createSeedEvents(new Date())
    return seeds.personalEvents
  })

  const senderIdRef = useRef(`calendar-${crypto.randomUUID().slice(0, 8)}`)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const remindedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    window.localStorage.setItem(sharedStorageKey, JSON.stringify(sharedEvents))
  }, [sharedEvents, sharedStorageKey])

  useEffect(() => {
    window.localStorage.setItem(personalStorageKey, JSON.stringify(personalEvents))
  }, [personalEvents, personalStorageKey])

  useEffect(() => {
    const channel = new BroadcastChannel(channelName)
    channelRef.current = channel

    channel.onmessage = (event: MessageEvent<SharedPayload>) => {
      const payload = event.data
      if (!payload || payload.type !== 'calendar-shared-sync') {
        return
      }
      if (payload.sessionId !== sessionId || payload.senderId === senderIdRef.current) {
        return
      }
      setSharedEvents(payload.events)
    }

    return () => {
      channel.close()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
    }
  }, [channelName, sessionId])

  const broadcastShared = useCallback(
    (nextSharedEvents: CalendarEvent[]) => {
      channelRef.current?.postMessage({
        type: 'calendar-shared-sync',
        sessionId,
        senderId: senderIdRef.current,
        events: nextSharedEvents,
      } satisfies SharedPayload)
    },
    [sessionId],
  )

  const createEvent = useCallback(
    (event: Omit<CalendarEvent, 'id'>) => {
      const nextEvent: CalendarEvent = {
        ...event,
        id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }

      if (nextEvent.scope === 'personal') {
        setPersonalEvents((prev) => [...prev, nextEvent])
        return
      }

      setSharedEvents((prev) => {
        const next = [...prev, nextEvent]
        broadcastShared(next)
        return next
      })
    },
    [broadcastShared],
  )

  const updateEvent = useCallback(
    (eventId: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => {
      setSharedEvents((prev) => {
        let changed = false
        const next = prev.map((event) => {
          if (event.id !== eventId) {
            return event
          }
          changed = true
          return { ...event, ...patch }
        })
        if (changed) {
          broadcastShared(next)
        }
        return next
      })

      setPersonalEvents((prev) =>
        prev.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
      )
    },
    [broadcastShared],
  )

  const deleteEvent = useCallback(
    (eventId: string) => {
      setSharedEvents((prev) => {
        const next = prev.filter((event) => event.id !== eventId)
        if (next.length !== prev.length) {
          broadcastShared(next)
        }
        return next
      })

      setPersonalEvents((prev) => prev.filter((event) => event.id !== eventId))
    },
    [broadcastShared],
  )

  const toggleTaskDone = useCallback(
    (eventId: string) => {
      setSharedEvents((prev) => {
        let changed = false
        const next = prev.map((event) => {
          if (event.id !== eventId || !event.isTask) {
            return event
          }
          changed = true
          return { ...event, taskDone: !event.taskDone }
        })
        if (changed) {
          broadcastShared(next)
        }
        return next
      })

      setPersonalEvents((prev) =>
        prev.map((event) =>
          event.id === eventId && event.isTask
            ? { ...event, taskDone: !event.taskDone }
            : event,
        ),
      )
    },
    [broadcastShared],
  )

  const events = useMemo(
    () => [...sharedEvents, ...personalEvents],
    [personalEvents, sharedEvents],
  )

  useEffect(() => {
    if (!onReminder) {
      return
    }

    const interval = window.setInterval(() => {
      const now = Date.now()
      events.forEach((event) => {
        if (event.reminderMinutes == null) {
          return
        }
        const reminderAt = new Date(event.startAt).getTime() - event.reminderMinutes * 60 * 1000
        const reminderKey = `${event.id}:${reminderAt}`
        if (remindedRef.current.has(reminderKey)) {
          return
        }
        if (now >= reminderAt && now <= reminderAt + 60 * 1000) {
          remindedRef.current.add(reminderKey)
          onReminder(event)
        }
      })
    }, 30000)

    return () => window.clearInterval(interval)
  }, [events, onReminder])

  return {
    events,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleTaskDone,
  }
}
