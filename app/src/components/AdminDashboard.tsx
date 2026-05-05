import { useEffect, useMemo, useState } from 'react'
import { BannerNotice } from './BannerNotice'

type Role = {
  id: string
  name: string
}

type AdminUser = {
  user_id: string
  workspace_member_id: string
  username: string | null
  name: string
  email: string
  role_id: string
  role_name: string
  status: string
  must_reset_password: boolean
}

type Props = {
  apiBaseUrl: string
  accessToken: string
  workspaceId: string
  workspaceName: string
  userName: string
  bannerMessage?: string
  onEnterWorkspace: () => void
  onLogout: () => void
}

export function AdminDashboard({
  apiBaseUrl,
  accessToken,
  workspaceId,
  workspaceName,
  userName,
  bannerMessage,
  onEnterWorkspace,
  onLogout,
}: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    roleId: '',
    permissions: '',
    tempPassword: '',
  })
  const [resetPassword, setResetPassword] = useState<Record<string, string>>({})

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  )

  const load = async () => {
    const [roleRes, usersRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/v1/${workspaceId}/roles`, { headers }),
      fetch(`${apiBaseUrl}/api/v1/auth/${workspaceId}/users`, { headers }),
    ])
    if (roleRes.ok) {
      const data = await roleRes.json()
      setRoles(data)
      if (!form.roleId && data.length > 0) {
        setForm((prev) => ({ ...prev, roleId: data[0].id }))
      }
    }
    if (usersRes.ok) {
      const data = await usersRes.json()
      setUsers(data)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreate = async () => {
    setStatusMessage('')
    const payload = {
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      username: form.username || null,
      role_id: form.roleId || null,
      permissions: form.permissions
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      temporary_password: form.tempPassword,
    }
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/${workspaceId}/users`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setStatusMessage(`Create failed: ${await response.text()}`)
      return
    }
    setStatusMessage('User created. Share the temporary password securely.')
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      roleId: form.roleId,
      permissions: '',
      tempPassword: '',
    })
    await load()
  }

  const handleUpdate = async (user: AdminUser, updates: Partial<AdminUser> & { permissions?: string[] }) => {
    setStatusMessage('')
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/${workspaceId}/users/${user.user_id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role_id: updates.role_id ?? user.role_id,
        status: updates.status ?? user.status,
        permissions: updates.permissions ?? null,
      }),
    })
    if (!response.ok) {
      setStatusMessage(`Update failed: ${await response.text()}`)
      return
    }
    await load()
  }

  const handleResetPassword = async (userId: string) => {
    const tempPassword = resetPassword[userId]
    if (!tempPassword) {
      setStatusMessage('Enter a temporary password first.')
      return
    }
    const response = await fetch(
      `${apiBaseUrl}/api/v1/auth/${workspaceId}/users/${userId}/reset-password`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporary_password: tempPassword }),
      },
    )
    if (!response.ok) {
      setStatusMessage(`Reset failed: ${await response.text()}`)
      return
    }
    setStatusMessage('Password reset. Share the new temporary password securely.')
    setResetPassword((prev) => ({ ...prev, [userId]: '' }))
    await load()
  }

  return (
    <div className="min-h-screen bg-[var(--pixel-bg)] px-6 py-8 text-[var(--pixel-ink)]">
      {bannerMessage ? <BannerNotice message={bannerMessage} /> : null}
      <div className="pixel-panel pixel-ui mx-auto w-full max-w-5xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Admin Dashboard</div>
            <h1 className="text-xl font-semibold">{workspaceName}</h1>
            <p className="mt-1 text-[10px] text-slate-500">Signed in as {userName}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="pixel-button px-3 py-2 text-[8px]" onClick={onEnterWorkspace}>
              Enter Workspace
            </button>
            <button type="button" className="pixel-button pixel-button--danger px-3 py-2 text-[8px]" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        {statusMessage ? <div className="mt-3 text-[10px] text-slate-600">{statusMessage}</div> : null}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="pixel-panel bg-white p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Create user</div>
            <div className="grid grid-cols-1 gap-2 text-[10px]">
              <input className="pixel-input px-3 py-2" placeholder="First name" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} />
              <input className="pixel-input px-3 py-2" placeholder="Last name" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} />
              <input className="pixel-input px-3 py-2" placeholder="Email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
              <input className="pixel-input px-3 py-2" placeholder="Username (johndoe)" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} />
              <select className="pixel-input px-3 py-2" value={form.roleId} onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <input className="pixel-input px-3 py-2" placeholder="Extra permissions (comma separated)" value={form.permissions} onChange={(event) => setForm((prev) => ({ ...prev, permissions: event.target.value }))} />
              <input className="pixel-input px-3 py-2" placeholder="Temporary password" type="password" value={form.tempPassword} onChange={(event) => setForm((prev) => ({ ...prev, tempPassword: event.target.value }))} />
              <div className="text-[9px] text-slate-500">Password policy: 8+ chars, 1 uppercase, 1 symbol.</div>
              <button type="button" className="pixel-button px-3 py-2 text-[8px]" onClick={handleCreate}>
                Create user
              </button>
            </div>
          </section>

          <section className="pixel-panel bg-white p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Users</div>
            <div className="space-y-3 text-[10px]">
              {users.map((user) => (
                <div key={user.user_id} className="border border-[var(--pixel-border)] bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-semibold">{user.name}</div>
                      <div className="text-[9px] text-slate-500">{user.username} · {user.email}</div>
                    </div>
                    <span className="pixel-pill px-2 py-1 text-[8px]">{user.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      className="pixel-input px-2 py-1"
                      value={user.role_id}
                      onChange={(event) => void handleUpdate(user, { role_id: event.target.value })}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                    <select
                      className="pixel-input px-2 py-1"
                      value={user.status}
                      onChange={(event) => void handleUpdate(user, { status: event.target.value })}
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="invited">invited</option>
                    </select>
                    {user.must_reset_password ? (
                      <span className="pixel-pill px-2 py-1 text-[8px]">reset required</span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="pixel-input px-2 py-1"
                      placeholder="New temp password"
                      type="password"
                      value={resetPassword[user.user_id] ?? ''}
                      onChange={(event) =>
                        setResetPassword((prev) => ({ ...prev, [user.user_id]: event.target.value }))
                      }
                    />
                    <button type="button" className="pixel-button px-2 py-1 text-[8px]" onClick={() => void handleResetPassword(user.user_id)}>
                      Reset
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 ? <div className="text-[10px] text-slate-500">No users yet.</div> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
