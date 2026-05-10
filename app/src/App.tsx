import { useMemo, useState } from 'react'
import WorkspaceApp from './WorkspaceApp'
import { AdminDashboard } from './components/AdminDashboard'
import { LoadingOverlay } from './components/LoadingOverlay'
import { NotificationToast } from './components/NotificationToast'

type AuthSession = {
  accessToken: string
  refreshToken: string
  workspaceId: string
  workspaceName: string
  userId: string
  userName: string
  roleName: string
  permissions: string[]
  mustResetPassword: boolean
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  workspace_id: string
  workspace_name: string
  user_id: string
  user_name: string
  role_name: string
  permissions: string[]
  must_reset_password: boolean
}

type AuthToast = {
  id: string
  message: string
  status: 'entering' | 'leaving'
}

const API_BASE_URL = 'http://127.0.0.1:8787'
const STORAGE_KEY = 'metaspace-auth'
const DEMO_ADMIN_USERNAMES = new Set(['abc'])
const DEMO_ADMIN_PERMISSIONS = [
  'workspace.settings.view',
  'workspace.settings.edit',
  'workspace.members.invite',
  'workspace.members.remove',
  'workspace.members.view',
  'workspace.roles.create',
  'workspace.roles.edit',
  'workspace.roles.delete',
  'workspace.roles.assign',
  'room.pm_access',
  'room.crm_access',
  'project.create',
  'project.view',
  'project.edit',
  'project.delete',
  'project.archive',
  'project.members.add',
  'project.members.remove',
  'sprint.view',
  'sprint.create',
  'sprint.manage',
  'sprint.delete',
  'task.create',
  'task.create_personal',
  'task.view',
  'task.edit_own',
  'task.edit_any',
  'task.assign_others',
  'task.delete',
  'task.log_time',
  'task.manage_status_columns',
  'milestone.view',
  'milestone.create',
  'milestone.edit',
  'milestone.delete',
  'doc.view',
  'doc.create',
  'doc.edit',
  'doc.delete',
  'doc.view_private',
  'doc.manage_access',
  'doc.approve',
  'doc.templates.view',
  'doc.templates.manage',
  'crm.view',
  'crm.edit',
  'crm.delete',
  'crm.deals.view',
  'crm.deals.edit',
  'crm.deals.delete',
  'crm.deals.convert',
  'crm.pipeline.manage',
  'crm.interactions.view',
  'crm.interactions.create',
  'crm.reports.view',
  'notification.view_all',
]

function normalizeDemoSession(payload: AuthSession): AuthSession {
  const identity = `${payload.userName} ${payload.roleName}`.toLowerCase()
  const isDemoAdmin = Array.from(DEMO_ADMIN_USERNAMES).some((name) =>
    identity.split(/\s+/).includes(name),
  )
  if (!isDemoAdmin) {
    return payload
  }

  const permissions = Array.from(new Set([...payload.permissions, ...DEMO_ADMIN_PERMISSIONS])).sort()
  return { ...payload, permissions }
}

function readStoredSession() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const normalized = normalizeDemoSession(JSON.parse(raw) as AuthSession)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession())
  const [view, setView] = useState<'login' | 'signup' | 'reset' | 'dashboard' | 'workspace'>(() => {
    if (!session) {
      return 'login'
    }
    if (session.mustResetPassword) {
      return 'reset'
    }
    return session.roleName === 'Owner' || session.roleName === 'Admin' ? 'dashboard' : 'workspace'
  })
  const [loginForm, setLoginForm] = useState({ workspaceName: '', username: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    workspaceName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  })
  const [resetForm, setResetForm] = useState({ currentPassword: '', newPassword: '' })
  const [loginStatus, setLoginStatus] = useState('')
  const [signupStatus, setSignupStatus] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [toasts, setToasts] = useState<AuthToast[]>([])
  const [bannerMessage, setBannerMessage] = useState('')
  const [entryLoading, setEntryLoading] = useState(false)
  const [entryMessage, setEntryMessage] = useState('')

  const isAdmin = session?.roleName === 'Owner' || session?.roleName === 'Admin'
  const permissions = useMemo(() => new Set<string>(session?.permissions ?? []), [session])

  const saveSession = (payload: AuthSession) => {
    const normalized = normalizeDemoSession(payload)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    setSession(normalized)
  }

  const pushToast = (message: string) => {
    const id = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, status: 'entering' }])
    window.setTimeout(() => {
      setToasts((prev) =>
        prev.map((toast) => (toast.id === id ? { ...toast, status: 'leaving' } : toast)),
      )
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
      }, 220)
    }, 3600)
  }

  const pushBanner = (message: string) => {
    setBannerMessage(message)
    window.setTimeout(() => setBannerMessage(''), 4200)
  }

  const startEntryLoading = (message: string, nextView: 'dashboard' | 'workspace' | 'reset') => {
    setEntryMessage(message)
    setEntryLoading(true)
    window.setTimeout(() => {
      setEntryLoading(false)
      setView(nextView)
    }, 3400)
  }

  const toSession = (payload: TokenResponse): AuthSession => ({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    workspaceId: payload.workspace_id,
    workspaceName: payload.workspace_name,
    userId: payload.user_id,
    userName: payload.user_name,
    roleName: payload.role_name,
    permissions: payload.permissions,
    mustResetPassword: payload.must_reset_password,
  })

  const clearSession = async () => {
    if (session) {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      })
    }
    window.localStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setView('login')
  }

  const handleLogin = async () => {
    setLoginStatus('')
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_name: loginForm.workspaceName,
        username: loginForm.username,
        password: loginForm.password,
      }),
    })
    if (!response.ok) {
      const message = await response.text()
      setLoginStatus(`Login failed: ${message}`)
      pushToast(`Login failed: ${message}`)
      return
    }
    const data = (await response.json()) as TokenResponse
    const next = toSession(data)
    saveSession(next)
    pushToast(`Welcome back, ${next.userName}.`)
    pushBanner(`Welcome back, ${next.userName}.`)
    const nextView = next.mustResetPassword
      ? 'reset'
      : next.roleName === 'Owner' || next.roleName === 'Admin'
        ? 'dashboard'
        : 'workspace'
    startEntryLoading('Loading your workspace...', nextView)
  }

  const handleSignup = async () => {
    setSignupStatus('')
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/admin-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_name: signupForm.workspaceName,
        first_name: signupForm.firstName,
        last_name: signupForm.lastName,
        email: signupForm.email,
        password: signupForm.password,
      }),
    })
    if (!response.ok) {
      const message = await response.text()
      setSignupStatus(`Signup failed: ${message}`)
      pushToast(`Signup failed: ${message}`)
      return
    }
    const data = (await response.json()) as TokenResponse
    const next = toSession(data)
    saveSession(next)
    pushToast(`Workspace created. Welcome ${next.userName}.`)
    pushBanner(`Workspace created. Welcome ${next.userName}.`)
    startEntryLoading('Preparing admin dashboard...', 'dashboard')
  }

  const handleReset = async () => {
    if (!session) {
      return
    }
    setResetStatus('')
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/${session.workspaceId}/reset-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: resetForm.currentPassword,
        new_password: resetForm.newPassword,
      }),
    })
    if (!response.ok) {
      const message = await response.text()
      setResetStatus(`Reset failed: ${message}`)
      pushToast(`Reset failed: ${message}`)
      return
    }
    const next = { ...session, mustResetPassword: false }
    saveSession(next)
    pushToast('Password updated.')
    setView(isAdmin ? 'dashboard' : 'workspace')
  }

  if (entryLoading) {
    return <LoadingOverlay visible message={entryMessage} variant="entry" />
  }

  if (session && view === 'workspace') {
    return (
      <WorkspaceApp
        workspaceId={session.workspaceId}
        userId={session.userId}
        userName={session.userName}
        permissions={permissions}
        bannerMessage={bannerMessage}
      />
    )
  }

  if (session && view === 'dashboard') {
    return (
      <AdminDashboard
        apiBaseUrl={API_BASE_URL}
        accessToken={session.accessToken}
        workspaceId={session.workspaceId}
        workspaceName={session.workspaceName}
        userName={session.userName}
        bannerMessage={bannerMessage}
        onEnterWorkspace={() => setView('workspace')}
        onLogout={clearSession}
      />
    )
  }


  if (session && view === 'reset') {
    return (
      <div className="auth-shell min-h-screen bg-[var(--pixel-bg)] px-6 py-10 text-[var(--pixel-ink)]">
        <NotificationToast toasts={toasts} />
        <div className="pixel-panel pixel-ui auth-panel mx-auto w-full max-w-md p-6">
          <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Password Reset</div>
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="mt-2 text-[10px] text-slate-500">Your account requires a password update before continuing.</p>
          {resetStatus ? <div className="mt-3 text-[10px] text-red-500">{resetStatus}</div> : null}
          <div className="mt-4 space-y-3 text-[10px]">
            <input
              className="pixel-input w-full px-3 py-2"
              placeholder="Current password"
              type="password"
              value={resetForm.currentPassword}
              onChange={(event) => setResetForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            />
            <input
              className="pixel-input w-full px-3 py-2"
              placeholder="New password"
              type="password"
              value={resetForm.newPassword}
              onChange={(event) => setResetForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            />
            <button type="button" className="pixel-button w-full px-3 py-2" onClick={handleReset}>
              Update password
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell min-h-screen bg-[var(--pixel-bg)] px-6 py-10 text-[var(--pixel-ink)]">
      <NotificationToast toasts={toasts} />
      <div className="pixel-panel pixel-ui auth-panel mx-auto w-full max-w-4xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="auth-card">
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">MetaSpace</div>
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="mt-2 text-[10px] text-slate-500">
              Employee login uses the workspace name you set on signup.
            </p>
            {loginStatus ? <div className="mt-3 text-[10px] text-red-500">{loginStatus}</div> : null}
            <div className="mt-4 space-y-3 text-[10px]">
              <input
                className="pixel-input w-full px-3 py-2"
                placeholder="Workspace name"
                value={loginForm.workspaceName}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, workspaceName: event.target.value }))}
              />
              <input
                className="pixel-input w-full px-3 py-2"
                placeholder="Username (johndoe)"
                value={loginForm.username}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
              />
              <input
                className="pixel-input w-full px-3 py-2"
                placeholder="Password"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button type="button" className="pixel-button w-full px-3 py-2" onClick={handleLogin}>
                Log in
              </button>
            </div>
          </div>

          <div className="auth-card auth-card--delay">
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Admin signup</div>
            <h2 className="text-xl font-semibold">Create your workspace</h2>
            <p className="mt-2 text-[10px] text-slate-500">Create a new org workspace for your team.</p>
            <p className="mt-1 text-[10px] text-slate-500">Org names must be unique.</p>
            {signupStatus ? <div className="mt-3 text-[10px] text-red-500">{signupStatus}</div> : null}
            <div className="mt-4 space-y-3 text-[10px]">
              <input
                className="pixel-input w-full px-3 py-2"
                placeholder="Workspace name"
                value={signupForm.workspaceName}
                onChange={(event) => setSignupForm((prev) => ({ ...prev, workspaceName: event.target.value }))}
              />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  className="pixel-input px-3 py-2"
                  placeholder="First name"
                  value={signupForm.firstName}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, firstName: event.target.value }))}
                />
                <input
                  className="pixel-input px-3 py-2"
                  placeholder="Last name"
                  value={signupForm.lastName}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>
              <input
                className="pixel-input w-full px-3 py-2"
                placeholder="Email"
                value={signupForm.email}
                onChange={(event) => setSignupForm((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                className="pixel-input w-full px-3 py-2"
                placeholder="Password"
                type="password"
                value={signupForm.password}
                onChange={(event) => setSignupForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button type="button" className="pixel-button w-full px-3 py-2" onClick={handleSignup}>
                Create admin workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
