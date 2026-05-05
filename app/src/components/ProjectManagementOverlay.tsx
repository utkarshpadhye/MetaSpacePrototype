import { useMemo, useState, type ReactNode } from 'react'

type PMTask = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  sprintId: string | null
  startDay: number
  durationDays: number
  estimate: number
}

type Sprint = { id: string; name: string; status: 'planned' | 'active' | 'completed' }

type Role = { id: string; name: string; color: string; permissions: string[] }
type UserOverride = { id: string; user: string; permission: string; type: 'grant' | 'revoke' }

type Props = {
  open: boolean
  onClose: () => void
  canAccessPm: boolean
}

const initialTasks: PMTask[] = [
  { id: 't1', title: 'Design board workflow', status: 'todo', sprintId: null, startDay: 1, durationDays: 3, estimate: 5 },
  { id: 't2', title: 'Implement sprint APIs', status: 'in_progress', sprintId: 's1', startDay: 2, durationDays: 4, estimate: 8 },
  { id: 't3', title: 'Write regression tests', status: 'done', sprintId: 's1', startDay: 4, durationDays: 2, estimate: 3 },
]

export function ProjectManagementOverlay({ open, onClose, canAccessPm }: Props) {
  const [tab, setTab] = useState<'board' | 'backlog' | 'timeline' | 'reports' | 'admin'>('board')
  const [tasks, setTasks] = useState<PMTask[]>(initialTasks)
  const [sprints, setSprints] = useState<Sprint[]>([
    { id: 's1', name: 'Sprint 1', status: 'planned' },
    { id: 's2', name: 'Sprint 2', status: 'planned' },
  ])
  const [selectedBacklog, setSelectedBacklog] = useState<Set<string>>(new Set())
  const [targetSprintId, setTargetSprintId] = useState('s1')
  const [showCarryOver, setShowCarryOver] = useState(false)
  const [carryOverIds, setCarryOverIds] = useState<Set<string>>(new Set())
  const [scale, setScale] = useState<'day' | 'week' | 'month'>('week')
  const [roles, setRoles] = useState<Role[]>([
    { id: 'r1', name: 'Owner', color: '#ef4444', permissions: ['*'] },
    { id: 'r2', name: 'Manager', color: '#2563eb', permissions: ['project.view', 'sprint.manage'] },
  ])
  const [overrides, setOverrides] = useState<UserOverride[]>([
    { id: 'o1', user: 'alex@test.dev', permission: 'task.edit_any', type: 'grant' },
  ])
  const [dependencies, setDependencies] = useState<Array<{ from: string; to: string }>>([{ from: 't1', to: 't2' }])
  const [newDepFrom, setNewDepFrom] = useState('t1')
  const [newDepTo, setNewDepTo] = useState('t2')
  const [depError, setDepError] = useState('')

  const activeSprint = sprints.find((s) => s.status === 'active') ?? null
  const backlog = tasks.filter((task) => task.sprintId === null)
  const sprintTasks = tasks.filter((task) => task.sprintId === (activeSprint?.id ?? 's1'))

  const columnTasks = useMemo(
    () => ({
      todo: sprintTasks.filter((task) => task.status === 'todo'),
      in_progress: sprintTasks.filter((task) => task.status === 'in_progress'),
      done: sprintTasks.filter((task) => task.status === 'done'),
    }),
    [sprintTasks],
  )

  const burndown = useMemo(() => {
    const total = sprintTasks.reduce((sum, t) => sum + t.estimate, 0)
    const done = sprintTasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + t.estimate, 0)
    return { total, done, remaining: Math.max(total - done, 0) }
  }, [sprintTasks])

  const velocity = useMemo(
    () =>
      sprints
        .filter((s) => s.status === 'completed')
        .map((sprint) => ({
          sprint: sprint.name,
          completed: tasks
            .filter((task) => task.sprintId === sprint.id && task.status === 'done')
            .reduce((sum, task) => sum + task.estimate, 0),
        })),
    [sprints, tasks],
  )

  if (!open) {
    return null
  }

  if (!canAccessPm) {
    return (
      <ModalFrame onClose={onClose} title="PM Room Locked">
        <div className="text-sm text-slate-700">You do not have room.pm_access permission. Ask an Owner/Admin to grant access.</div>
      </ModalFrame>
    )
  }

  return (
    <ModalFrame onClose={onClose} title="Projects Room">
      <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
        {['board', 'backlog', 'timeline', 'reports', 'admin'].map((value) => (
          <button
            key={value}
            type="button"
            className={`pixel-button px-2 py-1 ${tab === value ? 'bg-slate-200' : ''}`}
            onClick={() => setTab(value as typeof tab)}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'board' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {([
            ['todo', 'Todo'],
            ['in_progress', 'In Progress'],
            ['done', 'Done'],
          ] as Array<[PMTask['status'], string]>).map(([status, label]) => (
            <div
              key={status}
              className="rounded border border-slate-300 bg-white p-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const taskId = event.dataTransfer.getData('text/plain')
                setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)))
              }}
            >
              <div className="mb-2 text-xs font-semibold">{label}</div>
              <div className="space-y-2">
                {columnTasks[status].map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
                    className="cursor-move rounded border border-slate-200 bg-slate-50 p-2 text-xs"
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'backlog' ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <select className="pixel-input h-8 px-2" value={targetSprintId} onChange={(event) => setTargetSprintId(event.target.value)}>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="pixel-button px-2 py-1"
              onClick={() => {
                setTasks((prev) =>
                  prev.map((task) =>
                    selectedBacklog.has(task.id) ? { ...task, sprintId: targetSprintId } : task,
                  ),
                )
                setSelectedBacklog(new Set())
              }}
            >
              Add selected to sprint
            </button>
            <button
              type="button"
              className="pixel-button px-2 py-1"
              onClick={() => {
                setSprints((prev) => prev.map((s) => ({ ...s, status: s.id === targetSprintId ? 'active' : s.status })))
              }}
            >
              Start sprint
            </button>
            <button type="button" className="pixel-button px-2 py-1" onClick={() => setShowCarryOver(true)}>
              Complete sprint
            </button>
          </div>
          <div className="space-y-2">
            {backlog.map((task) => (
              <label key={task.id} className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedBacklog.has(task.id)}
                  onChange={(event) => {
                    setSelectedBacklog((prev) => {
                      const next = new Set(prev)
                      if (event.target.checked) next.add(task.id)
                      else next.delete(task.id)
                      return next
                    })
                  }}
                />
                <span>{task.title}</span>
              </label>
            ))}
          </div>
          {showCarryOver ? (
            <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-2 text-xs">
              <div className="mb-2 font-semibold">Carry-over incomplete tasks</div>
              {tasks.filter((task) => task.status !== 'done' && task.sprintId === targetSprintId).map((task) => (
                <label key={task.id} className="mb-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={carryOverIds.has(task.id)}
                    onChange={(event) => {
                      setCarryOverIds((prev) => {
                        const next = new Set(prev)
                        if (event.target.checked) next.add(task.id)
                        else next.delete(task.id)
                        return next
                      })
                    }}
                  />
                  <span>{task.title}</span>
                </label>
              ))}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="pixel-button px-2 py-1"
                  onClick={() => {
                    const nextSprint = sprints.find((s) => s.id !== targetSprintId && s.status !== 'completed')?.id ?? null
                    setTasks((prev) =>
                      prev.map((task) => (carryOverIds.has(task.id) ? { ...task, sprintId: nextSprint } : task)),
                    )
                    setSprints((prev) => prev.map((s) => (s.id === targetSprintId ? { ...s, status: 'completed' } : s)))
                    setCarryOverIds(new Set())
                    setShowCarryOver(false)
                  }}
                >
                  Complete with carry-over
                </button>
                <button type="button" className="pixel-button px-2 py-1" onClick={() => setShowCarryOver(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div>
          <div className="mb-2 flex gap-2">
            {(['day', 'week', 'month'] as const).map((value) => (
              <button key={value} type="button" className={`pixel-button px-2 py-1 ${scale === value ? 'bg-slate-200' : ''}`} onClick={() => setScale(value)}>
                {value}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {tasks.map((task) => {
              const unit = scale === 'day' ? 20 : scale === 'week' ? 12 : 6
              const left = task.startDay * unit
              const width = task.durationDays * unit
              const predecessor = dependencies.find((dep) => dep.to === task.id)
              const conflict = predecessor
                ? (() => {
                    const parent = tasks.find((t) => t.id === predecessor.from)
                    if (!parent) return false
                    return task.startDay < parent.startDay + parent.durationDays
                  })()
                : false

              return (
                <div key={task.id} className="rounded border border-slate-300 bg-white p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span>{task.title}</span>
                    {conflict ? <span className="text-red-600">dependency conflict</span> : null}
                  </div>
                  <div className="relative h-6 rounded bg-slate-100">
                    <div
                      className={`absolute top-1 h-4 rounded ${conflict ? 'bg-red-300' : 'bg-sky-300'}`}
                      style={{ left, width }}
                      draggable
                      onDragEnd={(event) => {
                        const delta = Math.round(event.movementX / unit)
                        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, startDay: Math.max(0, t.startDay + delta) } : t)))
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-2 text-xs">
            <div className="mb-2 font-semibold">Dependencies</div>
            <div className="mb-2 flex items-center gap-2">
              <select className="pixel-input h-8 px-2" value={newDepFrom} onChange={(event) => setNewDepFrom(event.target.value)}>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
              <span>{'->'}</span>
              <select className="pixel-input h-8 px-2" value={newDepTo} onChange={(event) => setNewDepTo(event.target.value)}>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
              <button
                type="button"
                className="pixel-button px-2 py-1"
                onClick={() => {
                  const candidate = [...dependencies, { from: newDepFrom, to: newDepTo }]
                  const adjacency = new Map<string, string[]>()
                  candidate.forEach((dep) => {
                    adjacency.set(dep.from, [...(adjacency.get(dep.from) ?? []), dep.to])
                  })
                  const visited = new Set<string>()
                  const stack = new Set<string>()
                  const hasCycle = Array.from(adjacency.keys()).some((node) => {
                    const dfs = (id: string): boolean => {
                      if (stack.has(id)) return true
                      if (visited.has(id)) return false
                      visited.add(id)
                      stack.add(id)
                      const next = adjacency.get(id) ?? []
                      for (const edge of next) {
                        if (dfs(edge)) return true
                      }
                      stack.delete(id)
                      return false
                    }
                    return dfs(node)
                  })
                  if (hasCycle) {
                    setDepError('Dependency cycle detected')
                    return
                  }
                  setDepError('')
                  setDependencies(candidate)
                }}
              >
                Add dependency
              </button>
            </div>
            {depError ? <div className="text-red-600">{depError}</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border border-slate-300 bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">Burndown</div>
            <div>Planned: {burndown.total} pts</div>
            <div>Completed: {burndown.done} pts</div>
            <div>Remaining: {burndown.remaining} pts</div>
          </div>
          <div className="rounded border border-slate-300 bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">Velocity</div>
            {velocity.length === 0 ? <div>No completed sprint yet.</div> : velocity.map((item) => <div key={item.sprint}>{item.sprint}: {item.completed} pts</div>)}
          </div>
          <div className="rounded border border-slate-300 bg-white p-3 text-xs md:col-span-2">
            <div className="mb-1 font-semibold">PM Room Objects</div>
            <div>Sprint Board, Backlog, Timeline, Reports, New Sprint</div>
          </div>
        </div>
      ) : null}

      {tab === 'admin' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border border-slate-300 bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">Roles Manager</div>
            {roles.map((role) => (
              <div key={role.id} className="mb-2 rounded border border-slate-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{role.name}</span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                </div>
                <div className="mt-1 text-[10px]">{role.permissions.join(', ')}</div>
              </div>
            ))}
            <button
              type="button"
              className="pixel-button px-2 py-1"
              onClick={() =>
                setRoles((prev) => [
                  ...prev,
                  { id: `r${prev.length + 1}`, name: `Custom ${prev.length + 1}`, color: '#14b8a6', permissions: ['task.view'] },
                ])
              }
            >
              Add role
            </button>
          </div>
          <div className="rounded border border-slate-300 bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">User Permission Overrides</div>
            {overrides.map((override) => (
              <div key={override.id} className="mb-2 rounded border border-slate-200 p-2">
                <div>{override.user}</div>
                <div className="text-[10px]">{override.type} {override.permission}</div>
              </div>
            ))}
            <button
              type="button"
              className="pixel-button px-2 py-1"
              onClick={() =>
                setOverrides((prev) => [
                  ...prev,
                  {
                    id: `o${prev.length + 1}`,
                    user: `user${prev.length + 1}@test.dev`,
                    permission: 'room.pm_access',
                    type: prev.length % 2 === 0 ? 'grant' : 'revoke',
                  },
                ])
              }
            >
              Add override
            </button>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="pixel-panel pixel-ui relative z-10 h-[88vh] w-[92vw] max-w-[1080px] overflow-auto p-4 text-[10px] text-slate-800">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--pixel-border)] pb-2">
          <div className="text-sm font-semibold">{title}</div>
          <button type="button" className="pixel-button h-7 w-7" onClick={onClose}>X</button>
        </div>
        {children}
      </div>
    </div>
  )
}
