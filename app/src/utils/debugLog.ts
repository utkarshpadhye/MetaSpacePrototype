type LogLevel = 'info' | 'warn' | 'error'

type DebugEntry = {
  timestamp: number
  level: LogLevel
  scope: string
  message: string
  data?: unknown
}

declare global {
  interface Window {
    __metaspaceLogs?: DebugEntry[]
  }
}

const MAX_LOGS = 500

function pushLog(entry: DebugEntry) {
  if (typeof window === 'undefined') {
    return
  }
  const current = window.__metaspaceLogs ?? []
  current.push(entry)
  if (current.length > MAX_LOGS) {
    current.splice(0, current.length - MAX_LOGS)
  }
  window.__metaspaceLogs = current
}

export function debugLog(
  scope: string,
  message: string,
  data?: unknown,
  level: LogLevel = 'info',
) {
  const entry: DebugEntry = {
    timestamp: Date.now(),
    level,
    scope,
    message,
    data,
  }

  pushLog(entry)

  const prefix = `[metaspace:${scope}] ${message}`
  if (level === 'error') {
    console.error(prefix, data ?? '')
  } else if (level === 'warn') {
    console.warn(prefix, data ?? '')
  } else {
    console.log(prefix, data ?? '')
  }
}

export function getSessionIdFromUrl(url: URL) {
  const querySession = url.searchParams.get('session')?.trim()
  if (querySession) {
    return querySession
  }

  const pathMatch = url.pathname.match(/\/session(?:=|\/)([^/]+)/i)
  if (pathMatch && pathMatch[1]) {
    return decodeURIComponent(pathMatch[1])
  }

  return null
}
