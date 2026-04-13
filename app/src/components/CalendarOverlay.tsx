import { useMemo, useState } from 'react'
import {
  type CalendarEvent,
  type CalendarScope,
  useCalendarData,
} from '../hooks/useCalendarData'

type CalendarOverlayProps = {
  open: boolean
  onClose: () => void
  sessionId: string
  localPeerId: string
  onReminder: (event: CalendarEvent) => void
}

type CalendarView = 'month' | 'week' | 'day'

type EditorState =
  | {
      mode: 'create'
      startAt: Date
      endAt: Date
      scope: CalendarScope
    }
  | {
      mode: 'edit'
      event: CalendarEvent
    }
  | null

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 12 }, (_, idx) => idx + 8)

const SCOPE_LABELS: Record<CalendarScope, string> = {
  global: 'Global',
  team: 'Team',
  personal: 'Personal',
}

const CATEGORY_OPTIONS: Record<CalendarScope, Array<{ value: string; label: string }>> = {
  global: [
    { value: 'holiday', label: 'Holiday' },
    { value: 'townhall', label: 'Townhall' },
    { value: 'office-event', label: 'Office Event' },
    { value: 'party', label: 'Party' },
  ],
  team: [
    { value: 'meeting', label: 'Meeting' },
    { value: 'task', label: 'Task' },
    { value: 'deadline', label: 'Deadline' },
    { value: 'schedule', label: 'Schedule' },
  ],
  personal: [
    { value: 'meeting', label: 'Meeting' },
    { value: 'personal', label: 'Personal' },
    { value: 'focus', label: 'Focus' },
    { value: 'reminder', label: 'Reminder' },
  ],
}

const CATEGORY_COLORS: Record<string, string> = {
  holiday: 'border-l-4 border-l-rose-400 bg-rose-50 text-rose-900',
  townhall: 'border-l-4 border-l-indigo-400 bg-indigo-50 text-indigo-900',
  'office-event': 'border-l-4 border-l-cyan-400 bg-cyan-50 text-cyan-900',
  party: 'border-l-4 border-l-fuchsia-400 bg-fuchsia-50 text-fuchsia-900',
  meeting: 'border-l-4 border-l-sky-400 bg-sky-50 text-sky-900',
  task: 'border-l-4 border-l-emerald-400 bg-emerald-50 text-emerald-900',
  deadline: 'border-l-4 border-l-amber-400 bg-amber-50 text-amber-900',
  schedule: 'border-l-4 border-l-violet-400 bg-violet-50 text-violet-900',
  personal: 'border-l-4 border-l-teal-400 bg-teal-50 text-teal-900',
  focus: 'border-l-4 border-l-slate-400 bg-slate-50 text-slate-900',
  reminder: 'border-l-4 border-l-orange-400 bg-orange-50 text-orange-900',
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  return startOfDay(addDays(date, -day))
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dateToInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function dateToDateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function parseDateInput(value: string) {
  return new Date(`${value}T00:00:00`)
}

function parseDateTimeInput(value: string) {
  return new Date(value)
}

function formatHeaderDate(date: Date, view: CalendarView) {
  if (view === 'month') {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  if (view === 'week') {
    const weekStart = startOfWeek(date)
    const weekEnd = addDays(weekStart, 6)
    return `${weekStart.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })} - ${weekEnd.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function EventChip({
  event,
  onEdit,
  onToggleTask,
}: {
  event: CalendarEvent
  onEdit: () => void
  onToggleTask: () => void
}) {
  const colorClass = CATEGORY_COLORS[event.category] ?? 'border-l-4 border-l-slate-400 bg-slate-50 text-slate-900'
  return (
    <button
      type="button"
      className={`w-full rounded px-1.5 py-1 text-left text-[10px] ${colorClass}`}
      onClick={(eventClick) => {
        eventClick.stopPropagation()
        onEdit()
      }}
    >
      <div className="truncate font-semibold">{event.title}</div>
      <div className="truncate text-[9px] opacity-80">
        {event.allDay
          ? 'All day'
          : `${new Date(event.startAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`}
      </div>
      {event.isTask ? (
        <label
          className="mt-1 flex items-center gap-1 text-[9px]"
          onClick={(taskClick) => {
            taskClick.stopPropagation()
          }}
        >
          <input
            type="checkbox"
            checked={event.taskDone}
            onChange={() => onToggleTask()}
          />
          {event.taskDone ? 'Done' : 'Open'}
        </label>
      ) : null}
    </button>
  )
}

function EventEditorModal({
  state,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  state: EditorState
  onClose: () => void
  onCreate: (event: Omit<CalendarEvent, 'id'>) => void
  onUpdate: (eventId: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => void
  onDelete: (eventId: string) => void
}) {
  const source = state?.mode === 'edit' ? state.event : null
  const initialScope = state?.mode === 'create' ? state.scope : source?.scope ?? 'global'
  const [scope, setScope] = useState<CalendarScope>(initialScope)
  const [title, setTitle] = useState(source?.title ?? '')
  const [description, setDescription] = useState(source?.description ?? '')
  const [allDay, setAllDay] = useState(source?.allDay ?? false)
  const [startAt, setStartAt] = useState(
    source
      ? dateToInputValue(new Date(source.startAt))
      : dateToInputValue(state?.mode === 'create' ? state.startAt : new Date()),
  )
  const [endAt, setEndAt] = useState(
    source
      ? dateToInputValue(new Date(source.endAt))
      : dateToInputValue(state?.mode === 'create' ? state.endAt : addDays(new Date(), 0)),
  )
  const [startDate, setStartDate] = useState(
    source
      ? dateToDateInputValue(new Date(source.startAt))
      : dateToDateInputValue(state?.mode === 'create' ? state.startAt : new Date()),
  )
  const [endDate, setEndDate] = useState(
    source
      ? dateToDateInputValue(new Date(source.endAt))
      : dateToDateInputValue(state?.mode === 'create' ? state.endAt : new Date()),
  )
  const [category, setCategory] = useState(
    source?.category ?? CATEGORY_OPTIONS[initialScope][0]?.value ?? 'meeting',
  )
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    source?.reminderMinutes ?? 30,
  )
  const [isTask, setIsTask] = useState(source?.isTask ?? false)
  const [taskDone, setTaskDone] = useState(source?.taskDone ?? false)

  if (!state) {
    return null
  }

  const categories = CATEGORY_OPTIONS[scope]

  const handleSubmit = () => {
    const startDateObj = allDay ? parseDateInput(startDate) : parseDateTimeInput(startAt)
    const endDateObj = allDay ? addDays(parseDateInput(endDate), 1) : parseDateTimeInput(endAt)
    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      return
    }

    const safeEnd = endDateObj.getTime() <= startDateObj.getTime()
      ? new Date(startDateObj.getTime() + 30 * 60 * 1000)
      : endDateObj

    const payload: Omit<CalendarEvent, 'id'> = {
      scope,
      title: title.trim() || 'Untitled event',
      description,
      startAt: startDateObj.toISOString(),
      endAt: safeEnd.toISOString(),
      allDay,
      category,
      reminderMinutes,
      isTask: scope === 'team' ? isTask : false,
      taskDone: scope === 'team' ? taskDone : false,
    }

    if (state.mode === 'create') {
      onCreate(payload)
    } else {
      onUpdate(state.event.id, payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close editor"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="pixel-panel pixel-ui relative z-10 w-[92vw] max-w-[560px] bg-[rgba(250,252,255,0.98)] p-4 text-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-[0.12em]">
            {state.mode === 'create' ? 'Create Event' : 'Edit Event'}
          </h3>
          <button type="button" className="pixel-button h-7 px-2 text-[8px]" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[10px] md:grid-cols-2">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>Title</span>
            <input className="pixel-input h-8 px-2 text-[10px]" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span>Description</span>
            <textarea
              className="pixel-input min-h-16 p-2 text-[10px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>Calendar</span>
            <select
              className="pixel-input h-8 px-2 text-[10px]"
              value={scope}
              onChange={(event) => {
                const nextScope = event.target.value as CalendarScope
                setScope(nextScope)
                setCategory(CATEGORY_OPTIONS[nextScope][0]?.value ?? 'meeting')
                if (nextScope !== 'team') {
                  setIsTask(false)
                  setTaskDone(false)
                }
              }}
            >
              <option value="global">Global</option>
              <option value="team">Team</option>
              <option value="personal">Personal</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>Category</span>
            <select
              className="pixel-input h-8 px-2 text-[10px]"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />
            All-day event
          </label>

          {allDay ? (
            <>
              <label className="flex flex-col gap-1">
                <span>Start date</span>
                <input
                  type="date"
                  className="pixel-input h-8 px-2 text-[10px]"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>End date</span>
                <input
                  type="date"
                  className="pixel-input h-8 px-2 text-[10px]"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span>Start</span>
                <input
                  type="datetime-local"
                  className="pixel-input h-8 px-2 text-[10px]"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>End</span>
                <input
                  type="datetime-local"
                  className="pixel-input h-8 px-2 text-[10px]"
                  value={endAt}
                  onChange={(event) => setEndAt(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1">
            <span>Reminder</span>
            <select
              className="pixel-input h-8 px-2 text-[10px]"
              value={reminderMinutes == null ? 'none' : String(reminderMinutes)}
              onChange={(event) => {
                const value = event.target.value
                setReminderMinutes(value === 'none' ? null : Number(value))
              }}
            >
              <option value="none">None</option>
              <option value="5">5 min before</option>
              <option value="10">10 min before</option>
              <option value="30">30 min before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </label>

          {scope === 'team' ? (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isTask}
                  onChange={(event) => setIsTask(event.target.checked)}
                />
                Mark as task
              </label>
              {isTask ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={taskDone}
                    onChange={(event) => setTaskDone(event.target.checked)}
                  />
                  Task done
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            {state.mode === 'edit' ? (
              <button
                type="button"
                className="pixel-button pixel-button--danger h-8 px-3 text-[9px]"
                onClick={() => {
                  onDelete(state.event.id)
                  onClose()
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
          <button type="button" className="pixel-button h-8 px-3 text-[9px]" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function CalendarOverlay({
  open,
  onClose,
  sessionId,
  localPeerId,
  onReminder,
}: CalendarOverlayProps) {
  const [scope, setScope] = useState<CalendarScope>('global')
  const [view, setView] = useState<CalendarView>('month')
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [editorState, setEditorState] = useState<EditorState>(null)

  const { events, createEvent, updateEvent, deleteEvent, toggleTaskDone } = useCalendarData({
    sessionId,
    localPeerId,
    onReminder,
  })

  const scopedEvents = useMemo(
    () =>
      events
        .filter((event) => event.scope === scope)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [events, scope],
  )

  const monthCells = useMemo(() => {
    const first = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
    const start = addDays(startOfDay(first), -first.getDay())
    return Array.from({ length: 42 }, (_, index) => addDays(start, index))
  }, [focusDate])

  const weekDays = useMemo(() => {
    const start = startOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [focusDate])

  const navigate = (direction: -1 | 1) => {
    if (view === 'month') {
      const next = new Date(focusDate)
      next.setMonth(next.getMonth() + direction)
      setFocusDate(next)
      return
    }
    if (view === 'week') {
      setFocusDate((prev) => addDays(prev, direction * 7))
      return
    }
    setFocusDate((prev) => addDays(prev, direction))
  }

  const openCreate = (date: Date) => {
    const start = new Date(date)
    const end = new Date(start)
    end.setHours(start.getHours() + 1)
    setEditorState({
      mode: 'create',
      startAt: start,
      endAt: end,
      scope,
    })
  }

  const openEdit = (event: CalendarEvent) => {
    setEditorState({ mode: 'edit', event })
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close calendar" />
      <div className="pixel-panel pixel-ui relative z-10 h-[86vh] w-[94vw] max-w-[1220px] bg-[rgba(246,249,255,0.98)] p-4 text-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" className="pixel-button h-8 px-3 text-[9px]" onClick={() => navigate(-1)}>
              Prev
            </button>
            <button type="button" className="pixel-button h-8 px-3 text-[9px]" onClick={() => setFocusDate(new Date())}>
              Today
            </button>
            <button type="button" className="pixel-button h-8 px-3 text-[9px]" onClick={() => navigate(1)}>
              Next
            </button>
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em]">{formatHeaderDate(focusDate, view)}</div>
          <button type="button" className="pixel-button h-8 px-3 text-[9px]" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(['global', 'team', 'personal'] as CalendarScope[]).map((entry) => (
              <button
                key={entry}
                type="button"
                className={`pixel-button h-8 px-3 text-[9px] ${
                  scope === entry ? 'bg-[#cbd5f5] text-slate-900' : ''
                }`}
                onClick={() => setScope(entry)}
              >
                {SCOPE_LABELS[entry]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(['month', 'week', 'day'] as CalendarView[]).map((entry) => (
              <button
                key={entry}
                type="button"
                className={`pixel-button h-8 px-3 text-[9px] ${
                  view === entry ? 'bg-[#cbd5f5] text-slate-900' : ''
                }`}
                onClick={() => setView(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        {view === 'month' ? (
          <div className="grid h-[calc(100%-106px)] grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="pixel-panel flex items-center justify-center bg-white py-2 text-[9px] text-slate-700">
                {day}
              </div>
            ))}
            {monthCells.map((day) => {
              const dayEvents = scopedEvents.filter((event) =>
                sameDay(new Date(event.startAt), day),
              )
              const isOutsideMonth = day.getMonth() !== focusDate.getMonth()
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={`pixel-panel flex min-h-0 flex-col gap-1 overflow-hidden bg-white p-1 text-left ${
                    isOutsideMonth ? 'opacity-45' : ''
                  }`}
                  onClick={() => {
                    const start = new Date(day)
                    start.setHours(9, 0, 0, 0)
                    openCreate(start)
                  }}
                >
                  <div className="text-[9px] text-slate-700">{day.getDate()}</div>
                  <div className="space-y-1 overflow-auto">
                    {dayEvents.slice(0, 4).map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        onEdit={() => openEdit(event)}
                        onToggleTask={() => toggleTaskDone(event.id)}
                      />
                    ))}
                    {dayEvents.length > 4 ? (
                      <div className="text-[9px] text-slate-600">+{dayEvents.length - 4} more</div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        {view === 'week' ? (
          <div className="h-[calc(100%-106px)] overflow-auto">
            <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-1">
              <div className="pixel-panel bg-white p-2 text-[9px] text-slate-600">Time</div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="pixel-panel bg-white p-2 text-[9px] text-slate-700">
                  {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              ))}

              {HOURS.map((hour) => (
                <div key={`week-row-${hour}`} className="contents">
                  <div key={`h-${hour}`} className="pixel-panel bg-white px-2 py-3 text-[9px] text-slate-600">
                    {`${String(hour).padStart(2, '0')}:00`}
                  </div>
                  {weekDays.map((day) => {
                    const slotEvents = scopedEvents.filter((event) => {
                      const start = new Date(event.startAt)
                      return sameDay(start, day) && start.getHours() === hour
                    })
                    return (
                      <button
                        key={`${day.toISOString()}-${hour}`}
                        type="button"
                        className="pixel-panel min-h-[64px] bg-white p-1 text-left"
                        onClick={() => {
                          const start = new Date(day)
                          start.setHours(hour, 0, 0, 0)
                          openCreate(start)
                        }}
                      >
                        <div className="space-y-1">
                          {slotEvents.map((event) => (
                            <EventChip
                              key={event.id}
                              event={event}
                              onEdit={() => openEdit(event)}
                              onToggleTask={() => toggleTaskDone(event.id)}
                            />
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="h-[calc(100%-106px)] overflow-auto">
            <div className="grid grid-cols-[86px_1fr] gap-1">
              {HOURS.map((hour) => {
                const rowEvents = scopedEvents.filter((event) => {
                  const start = new Date(event.startAt)
                  return sameDay(start, focusDate) && start.getHours() === hour
                })
                return (
                  <div key={`day-row-${hour}`} className="contents">
                    <div key={`day-hour-${hour}`} className="pixel-panel bg-white px-2 py-3 text-[9px] text-slate-600">
                      {`${String(hour).padStart(2, '0')}:00`}
                    </div>
                    <button
                      key={`day-slot-${hour}`}
                      type="button"
                      className="pixel-panel min-h-[76px] bg-white p-2 text-left"
                      onClick={() => {
                        const start = new Date(focusDate)
                        start.setHours(hour, 0, 0, 0)
                        openCreate(start)
                      }}
                    >
                      <div className="space-y-1">
                        {rowEvents.map((event) => (
                          <EventChip
                            key={event.id}
                            event={event}
                            onEdit={() => openEdit(event)}
                            onToggleTask={() => toggleTaskDone(event.id)}
                          />
                        ))}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <EventEditorModal
        key={
          editorState == null
            ? 'none'
            : editorState.mode === 'edit'
              ? `edit-${editorState.event.id}`
              : `create-${editorState.startAt.getTime()}`
        }
        state={editorState}
        onClose={() => setEditorState(null)}
        onCreate={createEvent}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
      />
    </div>
  )
}
